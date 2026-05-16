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
- 新增 MR/PR 自动检视闭环：Webhook 进来、拉 diff、分层 skill 检视、生成评论、反馈回写 OpenViking 风格知识库

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

## Docs

- 文档入口 / Documentation Index: [docs/README.md](./docs/README.md)
- 核心架构（中文）: [docs/core-architecture.zh-CN.md](./docs/core-architecture.zh-CN.md)

当前文档聚焦一份“九层架构 + 插件化扩展 + 典型场景”的核心设计，避免历史文档冗余。

## Quick Start

1. `pnpm install`
2. `pnpm bootstrap`
3. `pnpm dev`

默认会创建本地 `.env.local` 和 SQLite 数据文件，适合先跑一个单机、可演示、可继续开发的版本。

## Try The MR Review Loop

启动后可以先用默认的 `github-pr` webhook 跑一个本地 dry run：

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

没有配置 `CODE_PLATFORM_TOKEN` 时，AgentWorld 只生成评论内容，不会真的回写代码平台。评论里的反馈链接会写回本地 OpenViking 影子知识库。

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

## Current Delivery Rhythm

1. 设计先收敛成可落地的单体方案
2. 再把领域模型、调度核、调用核、追踪核落到代码里
3. 每一步都提交到 GitHub

## Design References

- Anthropic Managed Agents
- Harness engineering principles
- Multica
- 你给出的 World / Kingdom / AgentTeam / Tavern / Contract / Quest 设计方向

AgentWorld 最终想做的，不是一个“聪明聊天 UI”，而是一个真正能被团队拿来运营 Agent 服务的系统。
