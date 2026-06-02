# 插件 SDK 规格

## 1. 定位

插件 SDK 是 AgentWorld 的扩展边界。Provider、工具、Webhook parser、通知渠道、代码平台、任务模板、Environment Template、看板视图和案例包都应通过插件声明进入平台，而不是改动主干代码或写入固定业务分支。

插件是声明式 manifest 加受控生命周期回调的组合。平台主干负责校验、授权、调度和观测；插件负责提供扩展能力。

## 2. 设计目标

- 用 manifest 描述插件能力、权限、配置、生命周期和导入对象。
- 允许插件贡献 ProviderAdapter、工具、Skill、TaskBlueprint、Environment Template、Webhook 和看板视图。
- 保证插件动作受 allow / ask / deny 统一权限模型约束。
- 使插件可安装、可禁用、可升级、可审计、可回滚。
- 避免插件直接访问数据库、密钥明文或调度器内部状态。

## 3. 插件 Manifest

插件 manifest 标准结构如下：

```yaml
apiVersion: agentworld.io/v1
kind: AgentWorldPlugin
metadata:
  id: enterprise.repo.git
  name: Enterprise Git Plugin
  version: 1.0.0
  vendor: example-org
spec:
  runtime:
    type: node
    entry: dist/index.js
  permissions:
    requested:
      repo.diff.read: allow
      repo.comment.write: ask
      secret.use: ask
      network.outbound: ask
    deniedByDefault:
      - filesystem.write
  contributions:
    providerAdapters: []
    tools:
      - id: repo.diff.read
        title: 读取合并请求 Diff
    webhooks:
      - id: merge-request
        pathKey: merge-request
    environmentTemplates:
      - id: env-template-merge-request-check
    taskBlueprints:
      - id: task-template-shield-mr-check
    boardViews:
      - id: board-code-inspection-findings
  configSchema:
    type: object
    properties: {}
```

Manifest 必须可静态校验。任何未在 manifest 声明的能力不得在运行时使用。

## 4. 贡献类型

插件可以贡献以下对象：

- `providerAdapters`：ProviderAdapter manifest 和运行时实现。
- `tools`：由平台代理执行或由插件执行的工具动作。
- `skills`：Skill 定义、AgentWorld 知识引擎 URI 绑定和版本信息。
- `taskBlueprints`：可导入 Task Blueprint。
- `environmentTemplates`：可导入 Environment Template。
- `webhooks`：Webhook pathKey、验签方式和 parser。
- `scheduleTemplates`：定时触发配置。
- `secretSchemas`：插件所需 Secret 引用类型。
- `boardViews`：任务看板视图、过滤器和列定义。
- `caseBlueprints`：案例包。

插件贡献对象必须带有来源插件、版本和校验状态。

## 5. 生命周期

插件生命周期为：

```text
uploaded -> validated -> installed -> configured -> enabled -> degraded -> disabled -> uninstalled
```

- `uploaded`：插件包或 manifest 已进入平台。
- `validated`：schema、签名、版本、权限和依赖校验通过。
- `installed`：贡献对象已写入注册表，但默认不可执行。
- `configured`：必需配置和 Secret 引用已绑定。
- `enabled`：插件能力可被 TaskBlueprint 引用。
- `degraded`：插件部分能力不可用。
- `disabled`：插件停止被调度和调用。
- `uninstalled`：移除可运行能力，历史 TaskRun 仍保留引用快照。

卸载插件不得删除历史 TaskRun、事件、Finding 和 Artifact。

## 6. 生命周期回调

插件可实现以下回调，平台按需调用：

- `validateManifest(context)`
- `onInstall(context)`
- `onConfigure(context)`
- `healthCheck(context)`
- `onEnable(context)`
- `onDisable(context)`
- `onUpgrade(context)`
- `onUninstall(context)`
- `parseWebhook(context, request)`
- `executeTool(context, toolCall)`

回调上下文只包含平台授予的能力句柄、配置、Secret 引用解析句柄和事件写入句柄。插件不得获得数据库连接或未授权文件系统访问。

## 7. 权限模型

插件权限采用 allow / ask / deny：

- manifest 中的 `requested` 表示插件希望获得的默认策略。
- 租户、业务团队、TaskBlueprint 和 Environment Snapshot 可以进一步收紧。
- 运行时最终策略由平台合成，并在每次敏感动作前评估。

权限类别至少包括：

- `provider.invoke`
- `tool.execute`
- `repo.read`
- `repo.write`
- `network.outbound`
- `filesystem.read`
- `filesystem.write`
- `secret.use`
- `memory.read`
- `memory.write`
- `notification.send`
- `webhook.receive`

插件不得将 ask 视为 allow。ask 必须返回人工处理请求，由调度器进入 waiting_human。

## 8. 数据访问原则

插件访问平台数据必须通过 SDK API：

- `readTaskContext`
- `emitEvent`
- `requestPermission`
- `readEnvironmentSnapshot`
- `resolveSecretRef`
- `readMemory`
- `writeMemory`
- `createArtifact`
- `createFinding`

平台不得向插件暴露内部表结构。插件输出必须通过事件、Artifact、Finding 或工具结果返回。

## 9. 版本与兼容

- manifest 必须声明 `apiVersion` 和插件 `version`。
- 破坏性变更必须提升主版本。
- TaskRun 保存插件贡献对象的版本快照。
- 插件升级不得改变历史 TaskRun 的解释语义。
- 平台可支持迁移脚本，但迁移必须可审计并可回滚。

## 10. 安全要求

- 插件包应支持签名或校验和。
- Secret 只以引用形式出现在 manifest、Blueprint 和事件中。
- 插件日志和事件 payload 必须脱敏。
- 插件不得默认获得网络、文件写入或外部通知权限。
- 插件健康检查失败时必须进入 degraded 或 disabled，而不是继续静默执行。

## 11. 完成条件

- 任何新增集成能力都可以通过 manifest 声明和生命周期接入。
- 插件贡献的 TaskBlueprint 和 Environment Template 不需要修改平台主干代码。
- 插件敏感动作全部经过 allow / ask / deny。
- 插件禁用后不影响历史任务查看、事件回放和 Finding 审计。
- 插件 SDK 能支撑 ProviderAdapter、代码平台、通知渠道和案例包四类扩展。
