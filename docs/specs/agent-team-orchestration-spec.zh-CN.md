# Agent 团队编排规格

## 1. 定位

Agent 团队是 AgentWorld 的可运营服务单元。Task Blueprint 通过 `agentTeamRef` 引用 Agent 团队，调度器根据编排策略生成 TaskRunPlan 和 TaskRunNode，调用层再逐个执行节点。

Agent 团队编排不等同于 Provider 调用。编排描述任务分解、角色分工、依赖关系和人工处理位置；ProviderAdapter 负责具体模型、SDK、CLI 或工具调用。

## 2. 设计目标

- 支持 single、sequential、parallel、dag、human-gate 等编排模式。
- 使 Leader、成员 Agent、检查 Agent 和汇总 Agent 的职责可配置。
- 为 Task Blueprint 提供稳定可验证的执行计划。
- 支持人机协作、权限 ask 暂停、节点重试和部分降级。
- 将节点状态、事件、Finding 和 Artifact 汇总到任务看板。

## 3. Agent 调度与 Agent 调用边界

编排属于 Agent 调度层，负责：

- 读取 TaskBlueprint、AgentTeam 和输入快照。
- 生成 TaskRunPlan。
- 计算 DAG 依赖和 ready 节点。
- 分派节点租约。
- 管理节点状态、重试、跳过、取消和人工处理。

调用属于 Agent 调用层，负责：

- 根据节点上下文调用 ProviderAdapter。
- 读取 Skill、记忆和 Environment Snapshot。
- 执行工具并处理权限决策。
- 生成节点输出、Finding、Artifact 和调用事件。

编排层可以要求某个节点使用特定能力或角色，但不得直接绑定 Provider 命令。调用层可以返回失败分类，但不得自行改变 DAG 结构，除非通过标准 replanning 请求交回调度器处理。

## 4. AgentTeam 模型

```yaml
apiVersion: agentworld.io/v1
kind: AgentTeam
metadata:
  id: agent-team-code-inspection
  name: 代码检视团队
  version: 1.0.0
spec:
  leader:
    agentRef: agent-inspection-leader
  members:
    - role: security-inspectioner
      agentRef: agent-security-inspectioner
    - role: test-inspector
      agentRef: agent-test-inspector
  orchestration:
    mode: dag
    planner: static
    nodes: []
  inputContractRef: schema-code-inspection-input
  outputContractRef: schema-code-inspection-output
  service:
    visibility: team
    sla:
      timeoutSeconds: 3600
```

AgentTeam 必须声明版本。TaskRunPlan 必须引用具体版本。

## 5. 编排模式

- `single`：单 Agent 完成任务。
- `sequential`：按固定顺序执行多个节点。
- `parallel`：多个节点并行执行，最后汇总。
- `dag`：以依赖图表达复杂流程。
- `human-gate`：在关键节点后插入人工处理或检查节点。

平台可以允许插件贡献 planner，但 planner 只输出标准 TaskRunPlan，不得直接执行 Provider 调用。

## 6. TaskRunPlan

TaskRunPlan 是调度器生成的不可变或受控可变计划：

```yaml
taskRunId: run_001
blueprintVersion: 1.0.0
agentTeamVersion: 1.0.0
nodes:
  - id: node_security
    type: agent
    role: security-inspectioner
    dependsOn: []
    inputMap: {}
    outputMap: {}
    permissions:
      inherit: true
  - id: node_summary
    type: agent
    role: leader
    dependsOn: [node_security]
edges:
  - from: node_security
    to: node_summary
```

节点类型包括：

- `agent`
- `tool`
- `human`
- `plugin`
- `aggregate`
- `condition`
- `report`

## 7. 节点可靠性状态机

TaskRunNode 标准状态为：

```text
pending
ready
leased
invoking
waiting_human
blocked
retrying
degraded
succeeded
failed
skipped
canceled
```

状态规则：

- `pending` 表示依赖尚未满足。
- `ready` 表示可被调度器分派。
- `leased` 表示已被 worker 获取，需设置租约过期时间。
- `invoking` 表示进入 ProviderAdapter 或插件调用。
- `waiting_human` 表示 ask 权限或人工节点暂停。
- `blocked` 表示依赖失败或环境不可用。
- `retrying` 必须消耗重试次数。
- `degraded` 表示节点以降级方式完成，例如跳过非关键通知。
- `succeeded`、`failed`、`skipped`、`canceled` 为节点终态。

节点终态聚合决定 TaskRun 状态。关键节点失败通常导致 TaskRun failed；非关键节点 degraded 可导致 TaskRun degraded 或 succeeded_with_warnings，具体由 Blueprint 可靠性策略定义。

## 8. 人工处理

人工处理由以下来源触发：

- 权限决策为 ask。
- TaskRunPlan 中显式 human 节点。
- ProviderAdapter 返回 needs_human。
- Finding 达到配置的严重级别门槛。
- 环境或 Secret 预检需要人工修复。

人工处理项必须包含请求动作、风险说明、可选操作、过期时间、处理人范围和审计事件。人工处理结果只能是 allow、deny 或 modify，其中 modify 必须产生新的受控输入快照。

## 9. 共享上下文

Agent 团队共享以下上下文：

- TaskRun 输入快照。
- Environment Snapshot。
- Blueprint 权限快照。
- AgentWorld 知识引擎 记忆读取结果。
- 上游节点输出。
- Finding 和 Artifact 引用。
- 事件流和 Trace Span。

共享上下文必须可追溯。节点不得依赖不可记录的进程内全局状态。

## 9.1 会话隔离与上下文路由

多 Agent 会话不得把用户输入直接广播给全体成员。团队运行时必须以 Leader 为唯一的人类指令入口：

- 用户消息先进入 Leader inbox。
- 如果团队正在运行，新消息进入 Leader 队列，不得对所有活跃 Agent 执行 steer 或 cancel。
- Leader 根据系统提示词、团队目标和当前用户指令生成路由计划。
- SubAgent 默认不可见完整会话 transcript。
- 只有当 Leader 使用成员的精确 `@handle` 时，被 @ 的 SubAgent 才会收到一个上下文包。
- 上下文包必须包含最小必要信息，例如 Context、Task、Expected output。
- SubAgent 之间协作同样使用 `@handle` handoff；未被 @ 的成员不会收到同伴上下文。
- 汇总阶段由 Leader 接收 SubAgent 输出并生成面向用户的结果。

运行时应区分三类上下文：

```text
leader transcript
  人类消息、Leader 自身历史、必要的会话摘要

delegation packet
  Leader 显式 @ 某个 SubAgent 时给出的局部上下文

peer handoff packet
  SubAgent 显式 @ 另一个 SubAgent 时给出的局部上下文
```

SubAgent 调用的初始 transcript 应为空或只包含与该成员相关的受控摘要。任何跨成员上下文传递都必须通过可审计的消息、事件或上下文包完成。

## 10. 看板聚合

Agent 团队编排必须向看板提供：

- 当前运行节点。
- 阻塞节点和阻塞原因。
- 等待人工处理节点。
- 失败节点和重试次数。
- 关键路径耗时。
- Agent 角色维度的成功率和 Finding 数量。

看板不得只展示任务终态，必须能定位到具体节点和事件。

## 11. 完成条件

- TaskBlueprint 可引用 AgentTeam 版本并生成确定的 TaskRunPlan。
- 调度器能够独立推进 DAG，不依赖 Provider 私有实现。
- 节点 ask、retry、cancel、degraded 和 failed 均有明确状态迁移。
- 多 Agent 输出可以聚合为统一 Artifact 和 Finding。
- 编排结果完整进入任务事件流和看板。
