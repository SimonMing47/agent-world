# ProviderAdapter 规格

## 1. 定位

ProviderAdapter 是 AgentWorld 中 Agent 调用层的标准适配接口。它屏蔽 OpenCode SDK、Claude Code、OpenClaw、HTTP 模型服务、企业内部 CLI 或其他执行器的差异，使调度层只面对能力、状态、成本和事件，而不直接依赖具体 Provider 实现。

ProviderAdapter 不负责创建任务、修改调度状态或决定业务流程。它只执行调度器分派的 Agent 调用节点。

## 2. 设计目标

- 将 Provider 选择、模型调用、工具协议、流式输出、取消、重试分类和成本统计收敛到统一接口。
- 保持 Agent 调度与 Agent 调用边界清晰：调度层提交节点，调用层执行节点。
- 支持 SDK、CLI、本地进程、远端服务和插件 Provider。
- 支持 allow / ask / deny 权限决策，不允许 Adapter 自行绕过平台策略。
- 为任务事件流、Trace Span 和看板提供统一观测数据。

## 3. 边界

调度层可以读取 ProviderAdapter 的以下信息：

- adapter id、名称、版本和健康状态。
- 支持的模型、工具协议、输入输出模式和成本模型。
- 是否支持流式事件、取消、恢复、并发限制和本地文件访问。

调度层不得读取或生成：

- Provider 密钥明文。
- CLI 拼接命令细节。
- Provider 私有缓存路径。
- Adapter 内部重试实现。

ProviderAdapter 可以执行：

- 将 Agent 调用上下文转换为具体 Provider 请求。
- 发起模型、工具、CLI 或 SDK 调用。
- 将 Provider 输出转换为标准事件、Artifact、Finding 或结构化结果。
- 对可重试错误进行分类并返回给调度器。

ProviderAdapter 不得执行：

- 创建 TaskRun。
- 跳过 Environment Snapshot。
- 直接持久化未脱敏密钥。
- 绕过权限服务调用工具或写入外部系统。

## 4. Adapter Manifest

ProviderAdapter 必须通过插件或内置注册表声明 manifest：

```yaml
apiVersion: agentworld.io/v1
kind: ProviderAdapter
metadata:
  id: opencode.default
  name: OpenCode Default Adapter
  version: 1.0.0
spec:
  runtime:
    type: sdk
    packageRef: opencode-sdk
  capabilities:
    streaming: true
    cancel: true
    structuredOutput: true
    toolCalling: true
    fileContext: true
  models:
    - id: default
      family: configurable
      contextWindow: unknown
  toolProtocol:
    mode: platform-mediated
  cost:
    unit: token
    estimator: adapter-reported
  permissions:
    required:
      - provider.invoke
    optional:
      - filesystem.read
      - network.outbound
```

CLI 型 Adapter 必须额外声明可执行文件发现方式、版本命令、超时、工作目录策略和标准输出解析协议。HTTP 型 Adapter 必须声明 endpoint ref、认证 secret ref 和请求限制。

## 5. 调用输入

标准调用输入为不可变对象：

```yaml
taskRunRef:
  id: run_001
nodeRef:
  id: node_review_security
agentRef:
  id: agent_security_reviewer
environmentSnapshotRef:
  id: envsnap_001
providerPolicy:
  preferredAdapters: [opencode.default]
permissionSnapshot:
  default: ask
memoryContext:
  readScopes: []
  skillRefs: []
input:
  type: object
  payload: {}
trace:
  traceId: trace_001
```

Adapter 必须将该输入作为事实来源。运行时如需读取额外配置，只能读取已注册 Provider 配置、Environment Snapshot 和 Secret 引用解析结果。

## 6. 调用输出

ProviderAdapter 输出包括：

- `result`：节点最终结构化结果。
- `events`：调用过程中产生的标准事件。
- `artifacts`：报告、补丁、评论草稿、日志摘要等产物。
- `findings`：结构化 Finding。
- `usage`：token、耗时、工具调用次数、成本估算。
- `retryAdvice`：none、retryable、non_retryable、rate_limited、needs_human。

Adapter 不直接决定 TaskRun 是否成功。它返回节点结果，由调度器聚合节点状态并推进 TaskRun 状态机。

## 7. 生命周期

ProviderAdapter 生命周期为：

```text
registered -> discovered -> configured -> healthy -> degraded -> unavailable -> disabled
```

- `registered`：manifest 已导入。
- `discovered`：运行时依赖存在，如 SDK 包、CLI 二进制或 HTTP endpoint 可达。
- `configured`：所需 secret ref、模型和 endpoint 已配置。
- `healthy`：健康检查通过，可接收调用。
- `degraded`：可部分工作，但存在能力缺失、限流或远端异常。
- `unavailable`：不可调用。
- `disabled`：被管理员停用。

调度器只能向 healthy 或经过策略允许的 degraded Adapter 分派节点。

## 8. 权限协议

ProviderAdapter 必须通过平台权限服务处理敏感动作：

```text
action request -> policy evaluation -> allow | ask | deny
```

典型动作包括：

- 调用 Provider。
- 读取或写入文件。
- 访问网络域名。
- 调用工具。
- 使用 Secret 引用。
- 写入代码平台评论、邮件或 IM。
- 写入 OpenViking 记忆空间。

`allow` 动作必须记录 permission_decision 事件。`ask` 动作必须返回 needs_human，并由调度器创建人工处理项。`deny` 动作必须停止对应动作，并向事件流写入拒绝原因。

## 9. Provider 选择

Provider 选择按以下顺序执行：

1. TaskBlueprint 的 `providerPolicy`。
2. Agent 团队或 Agent 的模型约束。
3. Environment Snapshot 的运行时约束。
4. 租户空间和业务团队 Provider 白名单。
5. ProviderAdapter 健康状态和并发限制。
6. 成本、延迟和能力匹配。

选择结果必须写入 provider_selected 事件，包含候选列表、最终选择、排除原因和降级说明。

## 10. 可观测性

ProviderAdapter 必须输出以下事件或等价事件：

- `invocation.started`
- `provider.selected`
- `provider.health_checked`
- `provider.stream_delta`
- `tool.requested`
- `permission.decision`
- `tool.completed`
- `finding.created`
- `artifact.created`
- `usage.recorded`
- `invocation.completed`
- `invocation.failed`

事件 payload 必须脱敏。Secret 值、完整私钥、访问令牌和未授权外部数据不得进入事件流。

## 11. 可靠性要求

- 调用必须支持超时。
- 可取消 Adapter 必须响应调度器 cancel 信号。
- 失败必须分类为可重试、不可重试、限流、配置错误、权限错误或需要人工处理。
- Adapter 不得无限内部重试；重试预算由 TaskBlueprint 和调度器控制。
- CLI 型 Adapter 必须捕获退出码、stderr 摘要和超时原因。
- HTTP 型 Adapter 必须记录状态码族、限流头和 request id。

## 12. 验收标准

- 新增 Provider 不需要修改调度器核心状态机。
- 调度器可以基于 manifest 和健康状态完成 Provider 选择。
- 所有工具、Secret 和外部写操作都经过 allow / ask / deny 权限协议。
- Adapter 输出可被任务事件流、Trace Span、看板和成本统计统一消费。
- Adapter 失败不会破坏 TaskRun 历史解释能力。
