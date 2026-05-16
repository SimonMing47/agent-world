# AgentWorld

AgentWorld 不是一个“再包一层聊天框”的 Agent 项目。

它更像一个可以运营的 Agent 世界：有 World 作为租户边界，有 Kingdom 作为团队边界，有 AgentTeam 作为服务单元，有 Tavern 作为市场，有 Contract 作为跨团队调用协议，有 Quest 作为真正被调度和执行的任务。

AgentWorld is not another chat wrapper.

It is a single-service TypeScript platform for operating agents as teams, services, and execution units. Worlds isolate tenants. Kingdoms isolate teams. AgentTeams expose runnable capabilities. Tavern acts as the marketplace. Contracts govern cross-kingdom access. Quests are the jobs that actually get planned, dispatched, executed, observed, and settled.

## Why This Project Exists

团队一旦真的开始把 Agent 用到日常工作里，问题很快就不再是“模型够不够强”，而是：

- 任务是谁提交的
- 这个任务属于哪个团队
- 运行前有没有过预算和权限校验
- 任务是单 Agent 还是 DAG
- 过程中谁能人工接管
- 跨团队调用到底有没有授权
- 成本、成功率、耗时到底算到谁头上

AgentWorld 就是针对这些问题来设计的。

## What Makes AgentWorld Different

- 单体 TypeScript 服务，前后端一体，没有额外编排系统依赖
- 嵌入式 SQLite，本地就能跑，不依赖 Redis、PostgreSQL、Kafka、Temporal
- 支持 World、Kingdom、AgentTeam、Quest、Contract、Tavern 这套完整领域模型
- 调度、规划、执行、观察、人工干预都在一条清晰链路里
- 用 Harness 工程原则约束 Agent，不靠“提示词自觉”
- 兼容 OpenAI 风格模型接口，也支持通过 OpenCode SDK 发现 runtime
- 默认中文界面和默认中文输出，更适合直接给中文团队落地试跑
- 支持用可导入案例包配置 MR/PR 检视、安全巡检等团队级任务，而不是把业务流程写死进主干

## Architecture Direction

当前仓库已经收敛到下面这条路线：

- Monolith: `Next.js + TypeScript`
- DB: embedded SQLite
- Artifact store: local filesystem
- Memory: SQLite tables + FTS
- Scheduler: in-process tick loop + SQLite lease
- DAG executor: in-process worker slots
- Trace: internal event log + span tables
- Provider gateway: OpenAI-compatible adapters
- Runtime discovery: OpenCode SDK

## Plan First, Execute Second

AgentWorld 的 Quest 不应该从“收到请求”直接跳到“执行工具”。标准链路是：

1. 用户提交目标，或导入 task template / webhook / schedule case pack。
2. Planner 生成 plan、DAG、节点依赖、Agent 分工和交互提示词。
3. Harness 校验工具权限、预算、secret ref、输出策略和人工审批点。
4. Contract 校验跨 Kingdom 调用边界。
5. 用户或团队可以审阅、修改、批准、暂停或接管。
6. Scheduler / Executor 推进节点执行。
7. Trace、tool use、tool result、thinking summary、人工操作和 OpenViking 记忆归档全部写回。

## Platform Capabilities

- AgentTeam / Agent definition: Leader、协作 Agent、角色、Prompt、模型、工具集、记忆范围和状态支持在线编辑。
- Quest execution: 一次性、定时、Webhook、Contract 任务统一进入 Quest，并保留完整任务空间记录。
- Provider gateway: 默认 opencode SDK，claude code、openclaw 等 CLI Agent 引擎通过 provider 插件接入。
- Harness: 工具 allow/deny/approval、预算、输出、安全扫描和人工门禁。
- Plugin registry: Provider、工具、Skill、IM、邮件、代码仓都通过 manifest 注册，权限与 Harness 对齐。
- Execution environment: 代码仓、执行人、PRIVATE_KEY secret ref、工作路径、沙箱预留、依赖记忆和产出归档。
- OpenViking memory: resources / agent skills / user feedback 三类 URI 作用域，支持 L0/L1/L2 读取。
- Task board: 按业务团队、任务类别、触发方式和状态展示全局任务执行情况。

## Docs

- 文档入口 / Documentation Index: [docs/README.md](./docs/README.md)
- 系统概要设计（中文）: [docs/system-design.zh-CN.md](./docs/system-design.zh-CN.md)
- 系统详细设计（中文）: [docs/system-design-detailed.zh-CN.md](./docs/system-design-detailed.zh-CN.md)

## Quick Start

1. `pnpm install`
2. `pnpm bootstrap`
3. `pnpm dev`

默认会创建本地 `.env.local` 和 SQLite 数据文件，适合先跑一个单机、可演示、可继续开发的版本。

## Importable Case Packs

神盾计划和每日安全检视是默认案例包，不是主干硬编码流程。一个案例包由这些对象组成：

- `plugin manifest`: 代码仓、Provider、邮件、IM 等外部能力声明。
- `task template`: 团队目标、Planner 模式、节点 DAG、输入 schema、输出目标和 webhook parser ref。
- `execution environment`: 代码仓、执行人、私钥引用、工作路径、沙箱策略和记忆依赖。
- `schedule/webhook template`: 一次性、定时或 Webhook 触发配置。
- `knowledge bindings`: OpenViking skill、仓库上下文、全局经验和反馈记忆。

默认内置两个配置：

- `task-template-shield-mr-review` + `template-shield-mr-review`: MR diff 进入检视 AgentTeam，读取 Skill 后生成 MR 评论。
- `task-template-daily-security-review` + `template-daily-security-review`: 每日拉取仓库集合做安全检视，并通过邮件插件发送结果。

企业 Git、Gitea、GitLab、内部 MR 系统、企业邮箱、IM 都应该通过 `POST /api/plugins/manifests` 导入扩展包。主干只负责注册 manifest、解析模板、调度 Quest、校验权限和记录 trace。

## Extension Import Example

可以从 AgentWorld 导入企业代码仓插件和任务模板：

```bash
curl -X POST http://localhost:3002/api/plugins/manifests \
  -H 'Content-Type: application/json' \
  -d '{
    "id": "enterprise-git-review",
    "source": "enterprise-git-plugin",
    "plugins": [{
      "id": "enterprise.repo.git",
      "name": "Enterprise Git Connector",
      "version": "1.0.0",
      "capability": "code_repo",
      "lifecycle": "declared",
      "mountPoint": "execution-environment",
      "configSchema": "{ baseUrl, privateKeyRef, diffApiPath, commentApiPath }",
      "requiredSecretRefs": ["secret:enterprise-git-private-key", "secret:enterprise-git-token"],
      "permissions": ["repo:read", "repo:mr:comment"],
      "healthCheck": "connector self-check",
      "extensionOnly": true
    }]
  }'
```

Settings 页面会展示当前 registry、扩展点、导入示例、任务模板和执行环境。

## Try The Default MR Review Case

启动后可以先用默认案例包里的 `github-pr` webhook 跑一个本地 dry run。这个入口只是默认样例；企业代码仓应导入自己的 repo 插件、webhook parser 和 task template。

```bash
curl -X POST http://localhost:3002/api/webhooks/github-pr \
  -H 'Content-Type: application/json' \
  -d '{
    "repository": { "full_name": "demo/agentworld", "clone_url": "https://example.com/demo/agentworld.git" },
    "pull_request": {
      "number": 12,
      "title": "Add webhook review flow",
      "html_url": "https://example.com/demo/agentworld/pull/12",
      "head": { "ref": "feature/review", "sha": "abc123" },
      "base": { "ref": "main" },
      "user": { "login": "reviewer" }
    },
    "diff": "diff --git a/src/server/example.ts b/src/server/example.ts\n+++ b/src/server/example.ts\n@@ -0,0 +1,3 @@\n+const token = process.env.SECRET_TOKEN;\n+export function run(input: string) { return eval(input); }\n"
  }'
```

没有配置代码平台 token 时，AgentWorld 只生成评论内容，不会真的回写代码平台。评论里的反馈链接会写回本地 OpenViking 影子知识库。

## What Must Not Be Hardcoded

- 不把神盾计划写成固定代码路径；它必须来自 task template、environment 和 plugin manifest。
- 不把每日安全检视写成固定 cron 逻辑；它必须来自 schedule template。
- 不把 GitHub、GitLab、Gitea、企业 Git、邮件、IM、Provider 写进 Quest 主流程。
- 不保存明文 token、API key 或 PRIVATE_KEY，只保存 secret ref。
- 新增代码平台、通知渠道或 Provider 时，应新增插件 manifest / adapter / template，而不是修改调度、执行、Quest 主流程。

## Real OpenViking Knowledge Base

现在 AgentWorld 已经接入真实 OpenViking。第一次使用时执行：

```bash
pnpm openviking:install
pnpm openviking:start
```

另开一个终端验证真实写入和读取：

```bash
pnpm openviking:smoke
```

默认 OpenViking 服务地址是 `http://127.0.0.1:1933`。AgentWorld 会把知识写入官方 URI 作用域：

- `viking://resources/agentworld/...` 保存仓库、MR 上下文和全局经验
- `viking://agent/skills/agentworld/...` 保存检视 skill 知识
- `viking://user/memories/agentworld/...` 保存人工反馈记忆

控制台里的 `知识库` 页面可以看到 OpenViking 健康状态、知识层、最近条目和远端树。

OpenViking 不是某个案例专属存储，而是所有案例包复用的记忆层。神盾计划和每日安全检视只通过配置绑定对应 skill、仓库上下文和反馈记忆。

## Current Delivery Rhythm

1. 先拆解目标，明确平台能力、插件边界、配置案例和风险规避。
2. 再把领域模型、调度核、调用核、追踪核和导入协议落到代码里。
3. 每一步本地验证后再提交并推送到 GitHub。

## Design References

- Anthropic Managed Agents
- Harness engineering principles
- Multica
- 你给出的 World / Kingdom / AgentTeam / Tavern / Contract / Quest 设计方向

AgentWorld 最终想做的，不是一个“聪明聊天 UI”，而是一个真正能被团队拿来运营 Agent 服务的系统。
