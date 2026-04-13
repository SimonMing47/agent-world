# AgentHelix

AgentHelix 是一个给团队用的 Agent 平台。

它不是一个单纯的聊天窗口，也不是一个只会跑脚本的调度器。它更像一个统一的工作台：团队可以分空间管理任务、定时任务可以稳定触发、Agent 运行过程可以被看见、人在关键时刻可以随时接手。

AgentHelix is an agent platform built for real teams.

It is not just a chat box, and it is not just a scheduler. It is a shared operating surface where teams can organize work by space, run scheduled jobs, discover runtimes, inspect traces, and step in when a human decision is needed.

## Why It Exists

当团队真的开始用 Agent 做事情时，最常见的问题不是“模型够不够聪明”，而是：

- 任务到底有没有排上
- 现在是谁在执行
- 运行过程中发生了什么
- 出问题时人能不能接管
- 不同团队能不能各管各的任务和模型配置

AgentHelix 就是为这些问题设计的。

## What Makes It Different

- 全栈 TypeScript，前后端一体，安装和二次开发都更直接
- 使用嵌入式 SQLite，适合本地和单机快速部署
- 基于 OpenCode SDK 做 runtime 发现与调用
- 把“调度”和“调用”分开设计，任务流更清晰
- 执行过程有完整 trace，thinking、execution、text output 都能看
- 每个任务都支持人工干预，而不是只能干等结果
- 支持 team space、schedule、webhook、wallboard、provider 配置

## Docs

- 文档入口 / Documentation Index: [docs/README.md](/Users/mac/projects/未命名文件夹/docs/README.md)
- 中文详细设计 / Chinese Detailed Design: [docs/detailed-design.zh-CN.md](/Users/mac/projects/未命名文件夹/docs/detailed-design.zh-CN.md)
- English Detailed Design: [docs/detailed-design.en.md](/Users/mac/projects/未命名文件夹/docs/detailed-design.en.md)

## Current Build Plan

1. 完成仓库初始化
2. 完成中英双语详细设计
3. 落地全栈 TypeScript 骨架
4. 接入 SQLite、OpenCode SDK、调度和 trace 基础能力
5. 继续补齐 webhook、人工干预和 wallboard

## Design References

- Anthropic Managed Agents
- Multica

AgentHelix 会借鉴它们的长处，但实现目标会更偏向：

- 单机可装
- TypeScript 全栈
- 团队协作
- 调度清晰
- 调用可观测
