# Task Blueprint 规格

## 1. 定位

Task Blueprint 是 AgentWorld 的统一任务配置契约。平台中所有手动触发、定时触发、Webhook 触发、跨团队服务调用和案例包导入，都必须先收敛为 Task Blueprint，再由调度器实例化为 TaskRun。

Task Blueprint 不代表某个固定业务系统，也不包含硬编码流程。具体业务名称和“每日全量安全检视”只能作为配置样例或案例包出现，其本质是 Task Blueprint、Environment Template、插件声明、记忆空间和看板视图的组合。

## 2. 设计目标

- 以统一 Task Blueprint 描述任务入口、输入、Agent 团队、执行环境、权限、记忆、输出和可观测要求。
- 明确 Agent 调度与 Agent 调用边界，避免调度层直接耦合 Provider 命令、CLI 参数或具体模型实现。
- 支持配置化扩展：新增业务场景时增加 Blueprint、插件和环境模板，不修改平台主干流程。
- 保证任务可运行、可回放、可审计、可观察和可迁移。
- 将 Finding、事件流、人工处理、重试和可靠性状态纳入一等模型。

## 3. Agent 调度与 Agent 调用边界

Agent 调度负责“何时、为何、由谁执行”：

- 接收 manual、schedule、webhook、access-grant 等触发。
- 校验 Task Blueprint 和输入数据。
- 生成 TaskRun、TaskRunPlan、TaskRunNode 和初始事件。
- 解析 Agent 团队编排策略，生成可执行 DAG 或顺序计划。
- 分派可运行节点，维护队列、优先级、租户并发和看板状态。
- 处理 waiting_human、retrying、canceled、degraded 等状态迁移。

Agent 调用负责“如何执行一次 Agent 节点”：

- 基于 ProviderAdapter 选择模型、SDK、CLI 或远端执行器。
- 读取 Environment Snapshot、记忆上下文、知识和权限决策。
- 进行工具调用、Provider 流式输出和结果解析。
- 在工具或写操作触发 ask 时暂停并等待人工处理。
- 写入 invocation、tool、permission、finding、artifact 等事件。

调度层不得直接拼接 Provider 命令、读取密钥明文或调用业务插件内部 API。调用层不得创建新的 TaskRun，也不得绕过调度状态机修改任务生命周期。

## 4. 核心对象

### 4.1 TaskBlueprint

TaskBlueprint 是可版本化配置对象，建议字段如下：

```yaml
apiVersion: agentworld.io/v1
kind: TaskBlueprint
metadata:
  id: task-template-example
  name: 示例任务模板
  version: 1.0.0
  ownerTeamId: team-platform
  labels:
    domain: code-inspection
spec:
  trigger:
    modes: [manual, webhook, schedule]
    webhookRef: optional-webhook-id
    scheduleRef: optional-schedule-id
  inputSchema:
    type: object
    required: []
    properties: {}
  agentTeamRef:
    id: agent-team-inspection
    orchestration: dag
  environmentRef:
    templateId: env-template-inspection
    snapshotPolicy: per-run
  providerPolicy:
    preferredAdapters: [agentworld-runtime-adapter]
    fallbackAdapters: []
    modelConstraints: {}
  permissions:
    default: ask
    tools: {}
    network: ask
    filesystem: ask
    secrets: deny
  memory:
    readScopes: []
    writeScopes: []
    knowledgeRefs: []
  outputs:
    artifacts: []
    findings:
      enabled: true
      taxonomyRefs: []
  observability:
    eventLevel: standard
    boardViews: []
  reliability:
    maxAttempts: 2
    timeoutSeconds: 3600
    retryPolicy: bounded-exponential
```

### 4.2 TaskRun

TaskRun 是 TaskBlueprint 的一次实例化结果。它必须保存 Blueprint 版本、输入快照、Environment Snapshot 引用、Agent 团队版本、权限快照、记忆范围快照和可观测配置。TaskRun 不得依赖运行时重新读取可变配置来解释历史结果。

### 4.3 TaskRunNode

TaskRunNode 是调度器可分派的最小执行单元。节点可对应单个 Agent 调用、人工处理、插件动作、报告汇总或分支合并。节点状态必须进入事件流和看板。

### 4.4 Finding

Finding 是任务输出中的结构化问题或结论，不等同于普通日志。标准字段包括：

- `id`：全局唯一标识。
- `taskRunId`、`nodeId`：来源任务和节点。
- `source`：产生来源，如 agent、plugin、human、import。
- `category`：分类，如 security、quality、data-api、operations。
- `severity`：info、low、medium、high、critical。
- `confidence`：0 到 1 的置信度。
- `title`、`summary`、`evidence`：标题、摘要和证据。
- `location`：可选位置，如仓库、文件、行号、URL、资源 ID。
- `recommendation`：建议处理方式。
- `status`：open、acknowledged、fixed、false_positive、accepted_risk、dismissed。
- `feedbackRef`：写回 AgentWorld 知识引擎 用户记忆的反馈引用。

Finding 必须可追溯到事件流、Artifact、输入和相关知识版本。

## 5. Blueprint 生命周期

TaskBlueprint 生命周期为：

```text
draft -> validated -> active -> deprecated -> archived
```

- `draft`：允许编辑，不允许生产触发。
- `validated`：通过 schema、权限、环境、Agent 团队和插件校验，可用于试运行。
- `active`：可被正式触发。
- `deprecated`：不再接收新 TaskRun，历史 TaskRun 仍可查看和重放。
- `archived`：只读归档。

版本升级必须保留历史版本。生产 TaskRun 必须引用不可变版本，不能只引用可变名称。

## 6. TaskRun 可靠性状态机

TaskRun 标准状态如下：

```text
submitted
queued
planning
waiting_environment
ready
running
waiting_human
retrying
degraded
succeeded
failed
canceled
```

状态要求：

- `submitted` 到 `queued` 由调度层完成，必须具备幂等键。
- `planning` 生成 TaskRunPlan 和节点。
- `waiting_environment` 表示 Environment Snapshot 尚未就绪或预检失败后等待修复。
- `waiting_human` 只能由 ask 权限、人工节点或风险门禁触发。
- `degraded` 表示主路径失败但存在受控降级，例如 AgentWorld 知识引擎 远端不可用并写入本地影子索引。
- `succeeded`、`failed`、`canceled` 为终态。

节点状态机由编排规格定义，但必须向 TaskRun 聚合。

## 7. 权限模型

TaskBlueprint 采用 allow / ask / deny 三态权限：

- `allow`：在约束范围内直接执行，并写入事件。
- `ask`：创建人工处理项，调度器将 TaskRun 或节点置为 waiting_human。
- `deny`：拒绝动作，写入 policy_denied 事件；如该动作必需，则节点失败。

权限可按工具、插件、网络域、文件路径、写操作、Secret 引用、跨团队服务调用和记忆写入范围细分。更靠近运行时的策略只能收紧，不能放宽 Blueprint 声明。

## 8. 配置样例

### 8.1 MR 检视样例

以下配置仅是示例，不代表平台内置业务系统：

```yaml
metadata:
  id: task-template-merge-request-review
  name: MR 检视配置样例
spec:
  trigger:
    modes: [webhook, manual]
    webhookRef: webhook-code-merge-request
  agentTeamRef:
    id: agent-team-code-inspection
    orchestration: dag
  environmentRef:
    templateId: env-template-merge-request-check
  permissions:
    default: ask
    tools:
      repo.diff.read: allow
      repo.comment.write: ask
      filesystem.write: deny
  memory:
    readScopes:
      - agentworld://knowledge/resources/agentworld/code-inspection/repositories
      - agentworld://knowledge/agent/knowledge/agentworld/code-inspection/security
    writeScopes:
      - agentworld://knowledge/user/memories/agentworld/code-inspection/feedback
  outputs:
    findings:
      enabled: true
      taxonomyRefs: [code-inspection-security, code-inspection-quality]
```

### 8.2 每日全量安全检视样例

以下配置同样只是 Task Blueprint 样例：

```yaml
metadata:
  id: task-template-daily-security-scan
  name: 每日全量安全检视
spec:
  trigger:
    modes: [schedule, manual]
    scheduleRef: schedule-daily-security-scan
  agentTeamRef:
    id: agent-team-security-inspection
    orchestration: parallel
  environmentRef:
    templateId: env-template-repository-collection
  permissions:
    default: ask
    tools:
      repo.read: allow
      notify.email.send: ask
      repo.write: deny
  memory:
    readScopes:
      - agentworld://knowledge/agent/knowledge/agentworld/code-inspection/security
      - agentworld://knowledge/user/memories/agentworld/code-inspection/feedback
    writeScopes:
      - agentworld://knowledge/resources/agentworld/code-inspection/global
  outputs:
    artifacts:
      - type: report
        format: markdown
    findings:
      enabled: true
```

## 9. 完成条件

- 任意任务入口都可以转换为 TaskBlueprint 加输入数据。
- 调度器只依赖 Blueprint、输入、环境模板和注册表，不依赖具体 Provider 实现。
- 调用层通过 ProviderAdapter 执行节点，并完整写入事件流。
- 权限决策统一使用 allow / ask / deny。
- TaskRun、TaskRunNode、Finding、Artifact、Environment Snapshot 和事件流可互相追溯。
- 案例名称仅作为配置元数据存在，不出现在平台主干条件分支中。
