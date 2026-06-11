# AgentWorld 插件开发指南

本文是后续开发插件的主入口。AgentWorld 核心只提供通用扩展协议、权限、生命周期和任务编排能力；任何外部系统差异都应放在插件、Agent 可加载知识、任务蓝图或知识库内容中。

## 1. 插件和知识的边界

优先使用知识表达判断规则、经验、提示词和领域方法。只有需要访问外部系统、提供运行时代码、扩展页面或接管特定协议时，才开发插件。

适合知识：

- 检视维度、判断规则、误报经验、修复建议模板。
- 代码仓专有知识、领域知识、通用方法论。
- Agent 的工作方式、输出格式和证据要求。

适合插件：

- Webhook 验签和 payload 解析。
- 外部仓库、工单、通知、身份、密钥、知识源等系统 I/O。
- ProviderAdapter、工具包、发布器、代码库引擎。
- 插件页面、设置面板、任务详情附加面板。

适合任务蓝图：

- 业务流程阶段顺序。
- 哪些 Agent 执行哪些节点。
- 节点加载哪些知识。
- 哪个阶段调用哪个插件贡献项。
- 输出发布策略和反馈闭环。

## 2. 当前通用插件点

| 扩展点 | Manifest 贡献项 | 宿主 | 用途 |
| --- | --- | --- | --- |
| 身份认证 | `authAdapters` | server | SSO 登录、回调、身份标准化 |
| Provider 运行时 | `providerAdapters` | server | 模型服务、CLI 或远端执行器接入 |
| 工具与知识 | `toolBundles`, `knowledgeAssets` | server | 任务节点工具、可加载知识包导入 |
| 知识来源 | `knowledgeSources`, `knowledgeAssets` | server | 外部知识同步、转换、检索 |
| 代码平台 | `repositoryConnectors`, `webhookParsers`, `outputPublishers`, `toolBundles` | server | Git 类系统 webhook、diff、评论、文件读取 |
| 代码库引擎 | `codebaseEngines` | server | 代码索引、图谱、增量同步和查询 |
| 通知通道 | `notificationChannels`, `outputPublishers` | server | IM、邮件、工单、外部通知 |
| 执行环境模板 | `environmentTemplates` | server | worktree、沙箱、清理、快照 |
| 任务触发器 | `webhookParsers` | server | webhook、事件总线、定时事件解析 |
| 编排块 | `workflowBlocks`, `toolBundles`, `outputPublishers` | server | 可配置任务阶段 |
| 输出发布器 | `outputPublishers` | server | 评论、通知、归档、外部引用 |
| 看板组件 | `dashboardWidgets` | client | 受控看板指标与组件 |
| 导航与设置面板 | `navigationItems`, `settingsPanels` | client | 插件页面和配置入口 |
| 任务蓝图包 | `taskBlueprints`, `workflowBlocks` | both | 可导入任务定义和依赖声明 |
| 任务运行面板 | `taskRunPanels` | client | 任务详情页附加视图 |
| Agent 详情页签 | `agentDetailTabs` | client | Agent 附加视图 |
| Secret Provider | `secretProviders` | server | secret ref 解析 |

新增业务能力时，先在这张表里找到最接近的插件点。找不到时，先补通用插件点，再通过配置组合业务流程。

历史 manifest 中的 `skills` 视为 `knowledgeAssets` 的兼容别名；新插件应使用 `knowledgeAssets`，并把内容落入知识库的全局知识、领域知识或代码仓知识空间。

## 3. Manifest 基线

插件包使用 `agentworld.plugin.json` 或兼容的 `plugin.json`。Manifest 必须能静态校验，不得把 token、私钥、密码等明文写入配置。

```json
{
  "apiVersion": "agentworld.io/v1",
  "kind": "AgentWorldPlugin",
  "metadata": {
    "id": "example.repo-platform",
    "name": "Example Repository Platform",
    "version": "1.0.0",
    "description": "Repository webhook, diff tools, and output publishers."
  },
  "spec": {
    "runtime": {
      "type": "node",
      "entry": "dist/server.js"
    },
    "permissions": {
      "requested": [
        "repo.read",
        "repo.issue.comment",
        "webhook.receive",
        "secret.use",
        "tool.finding.create"
      ]
    },
    "contributions": {
      "repositoryConnectors": [{ "id": "example.repo" }],
      "webhookParsers": [{ "id": "example.merge_request.webhook" }],
      "toolBundles": [{ "id": "example.review.tools" }],
      "outputPublishers": [{ "id": "example.issue.comment" }]
    },
    "configSchema": {
      "type": "object",
      "properties": {
        "baseUrl": { "type": "string" },
        "tokenRef": { "type": "string" },
        "webhookSecretRef": { "type": "string" }
      },
      "required": ["baseUrl", "tokenRef"]
    }
  }
}
```

Contribution id 建议使用 `<pluginId>.<capability>` 风格。任务蓝图可以直接引用 contribution id；当某插件在某类贡献项下只有一个实现时，也可以引用 plugin id 作为别名。

## 4. Server Runtime 接口

Server 插件当前支持四类可执行贡献项。

```ts
export const executablePlugin = {
  manifest,
  repositoryConnectors: [
    {
      id: "example.repo",
      async getProject(input, ctx) {},
      async getMergeRequestChanges(input, ctx) {},
      async getRepoFile(input, ctx) {}
    }
  ],
  webhookParsers: [
    {
      id: "example.merge_request.webhook",
      async verify(args) {},
      async parse(args) {},
      buildIdempotencyKey(input) {}
    }
  ],
  toolBundles: [
    {
      id: "example.review.tools",
      tools: [{ id: "example.pull_request.rule_scan", title: "...", description: "..." }],
      async executeTool(toolId, input, ctx) {}
    }
  ],
  outputPublishers: [
    {
      id: "example.issue.comment",
      async publish(input, ctx) {}
    }
  ]
};
```

运行时只能通过 `PluginRuntimeContext` 访问平台能力：

- `readTaskContext()`
- `readEnvironment()`
- `resolveSecretRef(ref)`
- `requestPermission({ resource, scope })`
- `emitEvent(event)`
- `createFinding(input)`
- `createArtifact(input)`

`resolveSecretRef(ref)` 只能解析插件配置、知识配置或页面配置中保存的密钥值；不得使用 `env:` 环境变量引用，也不得要求 AgentWorld 主进程注入第三方系统 token。

插件不得直接访问数据库、读取 `.env`、写入明文密钥或绕过权限模型。

## 5. 代码平台插件要求

接入任意代码平台时，核心平台不关心平台名称。插件只需要把外部系统字段映射成标准上下文。

Webhook parser 输出建议包含：

- `repo_id`
- `repo_url`
- `pull_request_index` 或 `mr_id`
- `source_branch`
- `target_branch`
- `diff_ref`
- `author`
- `raw_payload`
- `plugin_idempotency_key`

工具包建议提供：

- 读取项目信息。
- 读取合并请求变更文件。
- 读取指定提交下的文件内容。
- 基于节点加载的知识规则生成 Finding。

发布器建议提供：

- 发布汇总评论。
- 发布逐条 Finding 评论。
- 如外部系统支持，更新已有评论。
- 返回外部评论 id、URL 和发布状态。

## 6. UI 插件要求

UI 插件只能挂载到受控插槽：

- `navigationItems`
- `settingsPanels`
- `dashboardWidgets`
- `taskRunPanels`
- `agentDetailTabs`

插件页面路径必须位于 `/plugins/<pluginId>/<pageId>` 下。插件不能覆盖核心路由，不能读取未授权数据，不能把外部脚本直接注入核心页面。

## 7. 配置业务流程

开发插件后，通过界面或 API 配置任务蓝图，把业务流程拼起来：

1. Webhook 或手动触发创建任务。
2. 准备执行环境或代码 worktree。
3. Agent 节点加载知识库中的可加载知识和代码仓知识。
4. `plugin_tool` 节点调用插件工具产出 Finding。
5. `publisher` 节点调用发布器输出结果。
6. 反馈入口写回知识库，后续任务按标签和代码仓范围检索。

业务名称、报告名称、流程阶段名称都应保存在数据库配置或插件包 metadata 中，不应写入 AgentWorld 主干代码。

## 8. 本地验证清单

- `GET /api/plugins/manifests` 能看到插件 manifest、扩展点和 runtimeRegistry。
- Manifest 中声明的贡献项和 runtime 实现一致。
- 插件缺少 secret ref 时返回可解释错误，不输出明文。
- Webhook parser 可以生成稳定幂等 key。
- 工具调用前执行 `requestPermission()`。
- Finding 包含文件、行号、规则、证据和知识引用。
- 发布器返回外部引用或草稿状态。
- 禁用插件后，新的任务蓝图不能继续选择该插件贡献项。
- 历史 TaskRun 仍能查看事件、Finding 和 Artifact。
