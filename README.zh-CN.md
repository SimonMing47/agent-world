# AgentWorld

AgentWorld 是团队级 Agent 治理控制台，用于管理 Agent 目录、Agent 团队、任务定义、运行绑定、知识空间、Skill、代码库、连接器和执行轨迹。

本仓库面向内网部署。运行资源、字体和知识存储都保留在仓库或部署数据目录中。安装阶段默认只需要 npm 包，不需要额外随包运行时。

## 运行前提

- 目标机器已安装 Node.js 20+。
- 已安装 pnpm 9+，或可以通过 Corepack 启用 pnpm。
- SQLite 使用 Node 内置的 `node:sqlite`。
- CLI 默认启动生产模式，开发模式必须显式指定。
- 不需要随包运行时目录、不随包携带 Node.js、不需要外部知识服务二进制、Python wheelhouse 或 Docker 服务。

## 知识引擎

AgentWorld 使用内置知识引擎，不再启动外部知识服务进程。

内置知识引擎提供：

- 全局、团队、项目、Agent 团队范围的知识空间。
- Markdown 知识条目和本地版本历史。
- L0/L1/L2 本地检索视图：空间摘要、空间概览、原文读取。
- Skill 和任务知识写回到 SQLite，并生成本地 shadow 文件。
- 支持从文件、目录和 URL 导入知识。
- 通过 `pnpm knowledge:*` 执行本地 smoke 和 doctor 检查。

知识存储默认创建在：

```bash
data/knowledge-engine/
```

## 安装

```bash
pnpm install --frozen-lockfile
pnpm bootstrap
pnpm build
```

也可以使用 CLI：

```bash
node scripts/agentworld-cli.mjs install
```

## 启动

默认是真实部署模式：

```bash
pnpm start
```

或：

```bash
node scripts/agentworld-cli.mjs start
```

服务默认监听 `PORT`，未设置时使用 `7369`。

开发模式必须显式启动：

```bash
pnpm dev
```

或：

```bash
node scripts/agentworld-cli.mjs dev
```

## 升级

```bash
node scripts/agentworld-cli.mjs upgrade
```

升级命令要求 git 工作区干净，会使用 `--ff-only` 拉取代码，按 lockfile 重装依赖，执行 bootstrap，准备本地知识存储，并重新构建应用。

## 检查

```bash
pnpm typecheck
pnpm lint
pnpm i18n:audit
pnpm knowledge:smoke
```

常用 CLI 检查：

```bash
node scripts/agentworld-cli.mjs doctor
pnpm knowledge:prepare
pnpm knowledge:doctor
```

## Linux 打包

在 Linux 上执行：

```bash
pnpm package:linux
```

发布包包含 standalone Next.js 应用、静态资源、文档和空的本地知识引擎目录。发布包不携带 Node.js，也不携带开发机数据；目标主机必须在 `PATH` 中提供 `node`。

解压后启动：

```bash
./agentworld
```

## 环境变量

常用变量：

| 变量 | 用途 |
| --- | --- |
| `PORT` | HTTP 端口，默认 `7369`。 |
| `HOSTNAME` | 生产包监听地址，默认 `0.0.0.0`。 |
| `AGENTWORLD_DATA_DIR` | 可选数据目录覆盖。 |
| `KNOWLEDGE_ENGINE_MODEL_DEFAULTS_FILE` | 可选的内容理解和 Embedding 默认模型 JSON。 |
| `KNOWLEDGE_ENGINE_VLM_PROVIDER` | 可选内容理解 provider。 |
| `KNOWLEDGE_ENGINE_VLM_MODEL` | 可选内容理解模型。 |
| `KNOWLEDGE_ENGINE_EMBEDDING_PROVIDER` | 可选 Embedding provider。 |
| `KNOWLEDGE_ENGINE_EMBEDDING_MODEL` | 可选 Embedding 模型。 |

## 项目结构

```text
src/app                     Next.js 页面和 API 路由
src/components              UI 组件
src/server                  服务端领域逻辑和 SQLite 访问
src/locales                 内置语言包
scripts                     CLI、bootstrap、审计、知识引擎和打包脚本
public                      本地静态资源和字体
data/knowledge-engine       本地知识 shadow 存储
docs                        架构与产品规格文档
```

## 关键页面

| 路径 | 用途 |
| --- | --- |
| `/overview` | 整体任务大盘。 |
| `/team-wallboard` | 按任务定义聚合的任务大盘。 |
| `/agents` | Agent 目录。 |
| `/agent-teams` | Agent 团队编排。 |
| `/task-blueprints` | 任务定义和触发。 |
| `/knowledge` | 内置知识工作区。 |
| `/skills` | Skill 目录与导入。 |
| `/settings` | 系统配置。 |
