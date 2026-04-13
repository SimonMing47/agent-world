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

- 文档入口 / Documentation Index: [docs/README.md](/Users/mac/projects/未命名文件夹/docs/README.md)
- 中文详细设计 / Chinese Detailed Design: [docs/detailed-design.zh-CN.md](/Users/mac/projects/未命名文件夹/docs/detailed-design.zh-CN.md)
- English Detailed Design: [docs/detailed-design.en.md](/Users/mac/projects/未命名文件夹/docs/detailed-design.en.md)

## Quick Start

1. `pnpm install`
2. `pnpm bootstrap`
3. `pnpm dev`

默认会创建本地 `.env.local` 和 SQLite 数据文件，适合先跑一个单机、可演示、可继续开发的版本。

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
