# 任务事件与可观测性规格

## 1. 定位

任务事件流是 AgentWorld 的执行事实记录。TaskRun 从提交、排队、计划、环境预检、Agent 调用、工具动作、权限决策、人工处理、Finding 生成、Artifact 生成到终态，都必须写入标准事件。

看板、Trace、审计、运行统计、可靠性状态机和历史回放都以事件流为基础。

## 2. 设计目标

- 为调度层和调用层提供统一事件模型。
- 支持完整追踪 planning、thinking、tool use、tool result、permission、human、retry、finding 和 artifact。
- 让任务看板能够按团队、模板、状态、Provider、严重级别和人工处理维度聚合。
- 保证事件可排序、可脱敏、可审计、可回放。
- 将可靠性状态机变化作为显式事件，而不是隐式字段更新。

## 3. 事件模型

标准事件字段：

```yaml
id: evt_001
taskRunId: run_001
nodeId: node_security
sequence: 42
timestamp: 2026-05-16T00:00:00Z
source: scheduler
phase: invocation
type: invocation.started
severity: info
actor:
  type: system
  id: scheduler
trace:
  traceId: trace_001
  spanId: span_004
visibility:
  tenant: true
  team: true
payload: {}
redaction:
  applied: true
```

`sequence` 在单个 TaskRun 内必须单调递增。事件写入必须幂等，支持通过 `idempotencyKey` 去重。

## 4. 事件类型

### 4.1 调度事件

- `task.submitted`
- `task.queued`
- `task.planning_started`
- `task.plan_created`
- `task.ready`
- `task.state_changed`
- `scheduler.dispatched`
- `scheduler.lease_expired`
- `task.succeeded`
- `task.failed`
- `task.canceled`
- `task.degraded`

### 4.2 环境事件

- `environment.preflight_started`
- `environment.snapshot_created`
- `environment.ready`
- `environment.invalid`
- `environment.degraded`
- `environment.cleaned`

### 4.3 调用事件

- `invocation.started`
- `provider.selected`
- `provider.stream_delta`
- `invocation.thinking`
- `invocation.completed`
- `invocation.failed`
- `usage.recorded`

`invocation.thinking` 可以根据策略折叠、摘要化或隐藏，但其存在和处理方式必须可审计。

### 4.4 工具与权限事件

- `tool.requested`
- `permission.evaluated`
- `permission.allowed`
- `permission.asked`
- `permission.denied`
- `tool.started`
- `tool.completed`
- `tool.failed`

权限事件必须包含 action、resource、decision、policyRefs 和 reason 摘要。

### 4.5 人工处理事件

- `human.requested`
- `human.assigned`
- `human.resolved`
- `human.expired`
- `human.canceled`

人工处理结果必须是 allow、deny 或 modify。modify 必须引用新的输入快照或补丁 Artifact。

### 4.6 记忆事件

- `memory.read_requested`
- `memory.read_completed`
- `memory.write_requested`
- `memory.write_completed`
- `memory.sync_pending`
- `memory.sync_failed`
- `memory.synced`

记忆事件记录 URI、范围、摘要和引用，不记录未脱敏原文。

### 4.7 输出事件

- `finding.created`
- `finding.updated`
- `artifact.created`
- `report.generated`
- `notification.requested`
- `notification.sent`
- `notification.skipped`

Finding 和 Artifact 必须具有可追溯引用。

## 5. Trace Span

Trace Span 用于表达耗时和调用链：

- TaskRun 一个 root span。
- 每个 TaskRunNode 一个 node span。
- Provider 调用、工具调用、记忆读写和外部通知可以创建子 span。

事件通过 traceId/spanId 关联到 Span。看板可以基于 Span 计算关键路径、等待时间、Provider 耗时和人工处理耗时。

## 6. 看板模型

任务看板至少包含以下视图：

- 全局运行视图：运行中、排队、等待人工、失败、降级、成功。
- 业务团队视图：按 team、TaskBlueprint、AgentTeam 聚合。
- Blueprint 视图：展示每个模板的触发次数、成功率和平均耗时。
- Provider 视图：展示 Adapter 健康、调用量、失败率和限流。
- 人工处理视图：展示 ask 队列、过期项、处理人和等待时长。
- Finding 视图：按 severity、category、status、来源任务和处理状态聚合。
- 可靠性视图：展示重试、降级、环境失败、记忆同步失败和插件健康。

看板数据可以由事件流投影生成。投影可以重建，不能成为唯一事实来源。

## 7. Finding 模型观测

Finding 创建时必须记录：

- Finding ID。
- 生成节点和 Agent。
- 证据来源。
- 使用的知识和记忆引用。
- 分类、严重级别和置信度。
- 关联 Artifact 或代码位置。

Finding 状态变化必须写入 `finding.updated` 事件。人工反馈写回 AgentWorld 知识引擎 时必须关联 Finding ID。

## 8. 可靠性状态机事件

任何 TaskRun 或 TaskRunNode 状态变化都必须写入 `*.state_changed` 事件，payload 至少包括：

- `from`
- `to`
- `reason`
- `actor`
- `retryAttempt`
- `isTerminal`
- `relatedEventIds`

状态变化不得只更新数据库字段而不写事件。

## 9. 脱敏与留存

- Secret 明文、私钥、token、Cookie 和未授权个人信息不得进入事件 payload。
- 大型输出应保存为 Artifact，事件只保留摘要和引用。
- thinking 类事件可按租户策略隐藏、折叠或摘要化。
- 事件留存期由租户和业务团队策略决定，但终态、Finding 和审计事件应长期保留。

## 10. 完成条件

- TaskRun 从 submitted 到终态的每个关键阶段都有事件。
- 看板可由事件流和投影重建。
- 权限、人工处理、记忆读写和 Finding 都有标准事件。
- 事件 payload 脱敏且可审计。
- 状态机迁移与事件流一致。
