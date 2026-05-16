# AgentWorld

AgentWorld 是一个团队级 Agent 平台，核心目标是把 Agent 从“单次对话”升级为可治理、可配置、可观测、可扩展的团队任务执行系统。

系统默认使用严肃标准术语：租户空间、业务团队、Agent、Agent 团队、服务目录、跨团队授权、任务执行、运行约束、执行环境、记忆层。产品名称保留 AgentWorld；风格化叙事不再作为默认表达。需要行业化或企业化命名时，可通过 `AGENTWORLD_TERMINOLOGY_JSON` / `NEXT_PUBLIC_AGENTWORLD_TERMINOLOGY_JSON` 做全局术语皮肤覆盖。

## 主线方向

AgentWorld 的主线不是再包装一个聊天框，而是建立团队级 Agent 平台的核心闭环：

1. Task Blueprint：所有一次性、定时、Webhook、跨团队调用都先收敛为统一任务蓝图。
2. Agent 调度：任务蓝图实例化为 TaskRun、TaskRunPlan、TaskRunNode、环境快照、权限快照和事件流。
3. Agent 调用：节点执行前经过 ProviderAdapter、运行约束、跨团队授权、工具权限、执行环境和记忆层解析。
4. 执行观测：任务空间记录 plan、reasoning summary、tool use、tool result、approval、retry、cost、policy hit、Finding 和 artifact。
5. 插件扩展：Provider、触发器、邮件、IM、代码仓、输出发布和看板指标只通过插件清单、任务蓝图和环境配置接入。
6. 记忆沉淀：OpenViking 作为开箱即用的分层记忆服务，保存检视上下文、Skill、结果、人工反馈和归档记忆。

## 平台能力域

- Provider 执行层：默认内置 OpenCode Provider Adapter；Claude Code、OpenClaw、企业 CLI 引擎通过 Provider 插件扩展。
- Agent 定义层：在线编辑 Agent 的角色、提示词、模型、权限、工具集和记忆范围。
- 工具 / Skill 管理层：工具权限采用 allow / deny / approval 模型，与运行约束对齐。
- 多 Agent 编排层：Agent 团队定义 Leader、成员、目标、交互提示词和依赖关系。
- Agent 团队任务执行层：每个团队接受任务并在任务空间中展示全量执行过程。
- 业务团队管理层：租户空间和业务团队管理预算、可见性、创建者、编辑者、使用者和跨团队调用。
- 任务执行展示层：按业务团队、任务蓝图、触发方式、任务类别、状态、Finding、成本和优先级展示全局任务看板。
- 环境层：管理 Environment Template、Environment Snapshot、代码仓、执行人、PRIVATE_KEY 引用、执行路径、记忆依赖和未来沙箱。
- 记忆层：基于 OpenViking 做分层、分域、分团队记忆管理，并给 OpenViking CLI 提供访问配置。

## 当前实现

- Next.js + TypeScript 单服务应用。
- SQLite 本地持久化，启动时自动初始化领域模型、任务蓝图、Provider Adapter、环境模板和两个核心案例配置。
- OpenCode Provider Adapter 基线；Claude Code、OpenClaw、自定义 CLI Provider 通过插件扩展点声明。
- 任务蓝图页面：`/task-blueprints`、`/task-blueprints/:id`。
- 任务蓝图 API：`GET /api/task-blueprints`、`GET /api/task-blueprints/:id`、`POST /api/task-blueprints/:id/submit`、`GET /api/task-blueprints/:id/permission-preview`。
- 插件清单和扩展包导入 API：`GET/POST /api/plugins/manifests`，支持导入插件、执行环境、任务模板、任务蓝图和触发模板。
- 任务提交与执行 API：`POST /api/task-runs/submit`、`POST /api/task-runs/:id/tick`、`POST /api/task-runs/:id/resume`。
- 任务空间 API：成本、依赖图、执行看板、策略命中和人工干预解析。
- Finding API：`GET /api/findings`。
- Webhook 入口：`POST /api/webhooks/:pathKey`。
- OpenViking 记忆接口：`/api/knowledge/layers`、`/api/knowledge/read`、`/api/knowledge/skills`。

## 快速开始

```bash
pnpm install
pnpm bootstrap
pnpm dev
```

默认访问地址：

```text
http://localhost:3000
```

常用校验：

```bash
pnpm typecheck
pnpm lint
pnpm build
```

## OpenViking 二进制集成

OpenViking 不通过容器运行时集成。AgentWorld 优先使用服务端二进制：

```text
thirdparty/openviking/bin/openviking-server
```

也可以通过环境变量指定外部二进制：

```bash
OPENVIKING_SERVER_BIN=/opt/openviking/openviking-server
```

准备配置：

```bash
pnpm openviking:prepare
pnpm openviking:cli-config
```

OpenViking doctor 要求 VLM provider/model 配置完整。生产部署前至少配置：

```text
OPENVIKING_VLM_PROVIDER=
OPENVIKING_VLM_MODEL=
OPENVIKING_VLM_API_BASE=
OPENVIKING_VLM_API_KEY=
```

如需覆盖默认 embedding，也可以配置 `OPENVIKING_EMBEDDING_*`。未配置 VLM 时可以先运行 `pnpm openviking:init` 使用 OpenViking 官方初始化向导。

首次初始化和诊断：

```bash
pnpm openviking:init
pnpm openviking:doctor
```

启动 OpenViking：

```bash
pnpm openviking:start
```

验证写入、读取和目录访问：

```bash
pnpm openviking:smoke
```

开发机没有二进制时，可以用 Python venv 做本地 fallback：

```bash
pnpm openviking:install
```

Linux 构建服务端二进制：

```bash
pnpm openviking:build-binary
```

构建产物会写入：

```text
thirdparty/openviking/bin/openviking-server
thirdparty/openviking/manifest.json
```

`thirdparty/openviking` 只用于标注和承载 OpenViking 第三方二进制，不属于 AgentWorld 主干源代码。

## Linux 发布包

目标部署环境不要求容器运行时。Linux 构建机上执行：

```bash
pnpm openviking:build-binary
pnpm package:linux
```

发布包会包含：

- AgentWorld standalone Next.js 服务。
- Node.js Linux runtime。
- `thirdparty/openviking/bin/openviking-server`。
- OpenViking 配置文件和 CLI 配置文件。
- `agentworld` 与 `openviking-server` 两个启动脚本。

## 插件扩展

AgentWorld 开源主干只定义协议、清单、任务蓝图、权限校验和观测记录。企业 Git、GitLab、Gitea、内部 MR 系统、企业邮箱、IM 等差异通过扩展包导入：

```http
POST /api/plugins/manifests
```

扩展包可以声明：

- 插件清单：Provider、触发器、通知、代码仓、工具、Skill、输出发布器、看板指标。
- 执行环境：代码仓地址、执行人、私钥引用、工作目录、记忆依赖。
- 任务蓝图：触发器、输入 schema、环境选择器、Agent 编排、权限、输出、看板、可靠性策略。
- 任务模板：未迁移场景的输入 schema、默认输入、节点、输出目标、Webhook parser。
- 触发模板：一次性、定时、Webhook、事件触发。

主干不需要为了企业代码仓软件差异修改代码。

## 核心案例

### 神盾计划：MR 分层检视

已内置全局配置：

- 任务蓝图：`shield_mr_review`
- 任务模板：`task-template-shield-mr-review`
- 触发模板：`template-shield-mr-review`
- 环境：`env-shield-mr-review`
- 团队：`PR Vanguard`
- 插件：`builtin.repo.git`
- 记忆层：`repository/code-review`、`global/code-review`、`security`、`quality/test`、`data-interface`

Webhook 把 MR diff 给到系统后，会先进入 `shield_mr_review` 任务蓝图，校验幂等键，生成环境快照和权限快照，再由检视 Agent 团队读取 Skill 和记忆层，完成代码质量、安全、测试等分层检视。结果统一写入 Finding，再通过 MR 评论、看板和归档发布。没有配置代码平台 token 时只生成评论内容，不回写外部系统。

### 每日全量安全检视

已内置全局配置：

- 任务蓝图：`daily_security_review`
- 任务模板：`task-template-daily-security-review`
- 触发模板：`template-daily-security-review`
- 环境：`env-daily-security-scan`
- 通知插件：`builtin.notify.email`
- 记忆层：`security`、`feedback/correct`、`feedback/incorrect`

调度器每天按仓库集合实例化 `daily_security_review` 任务蓝图。执行策略支持按仓库分片、幂等键、重试、全量环境快照、Finding 去重和邮件报告发布。

## 设计文档

- [系统概要设计](docs/system-design.zh-CN.md)
- [系统详细设计](docs/system-design-detailed.zh-CN.md)
- [8 个核心规格](docs/specs/)

## 环境变量

参考 `.env.example`。关键变量：

```text
OPENCODE_API_KEY=
OPENAI_API_KEY=
CODE_PLATFORM_TOKEN=
CODE_PLATFORM_WEBHOOK_SECRET=
OPENVIKING_BASE_URL=http://127.0.0.1:1933
OPENVIKING_SERVER_BIN=thirdparty/openviking/bin/openviking-server
OPENVIKING_CONFIG_FILE=data/openviking/ov.conf
OPENVIKING_CLI_CONFIG_FILE=data/openviking/ovcli.conf
OPENVIKING_VLM_PROVIDER=
OPENVIKING_VLM_MODEL=
OPENVIKING_VLM_API_BASE=
OPENVIKING_VLM_API_KEY=
```

## 核心规格

平台内核以 8 个规格约束实现：

1. Task Blueprint Spec
2. Provider Adapter Spec
3. Plugin SDK Spec
4. Agent Team Orchestration Spec
5. Memory & Skill Spec
6. Environment & Secret Spec
7. Task Event & Observability Spec
8. Case Blueprint Spec
