# AgentWorld

AgentWorld 是一个团队级 Agent 平台，核心目标是把 Agent 从“单次对话”升级为可治理、可配置、可观测、可扩展的团队任务执行系统。

系统默认使用严肃标准术语：租户空间、业务团队、Agent、Agent 团队、服务目录、跨团队授权、任务执行、运行约束、执行环境、记忆层。产品名称保留 AgentWorld；风格化叙事不再作为默认表达。需要行业化或企业化命名时，可通过 `AGENTWORLD_TERMINOLOGY_JSON` / `NEXT_PUBLIC_AGENTWORLD_TERMINOLOGY_JSON` 做全局术语皮肤覆盖。

## 主线方向

AgentWorld 的主线不是再包装一个聊天框，而是建立团队级 Agent 平台的核心闭环：

1. 团队治理：业务团队是一切工作、资产、权限和任务归属的核心。
2. Agent 治理：Agent 是系统第一公民，也是调度的最小单位；Agent Team 是完成复杂任务的调度单元。
3. Task Blueprint：所有一次性、定时、Webhook、跨团队调用都先收敛为统一任务蓝图，并归属于业务团队。
4. Agent 调度：任务蓝图实例化为 TaskRun、TaskRunPlan、TaskRunNode、环境快照、权限快照和事件流。
5. Agent 调用：节点执行前经过 AI Provider、运行约束、跨团队授权、工具权限、执行环境和记忆层解析。
6. 执行观测：任务空间记录 plan、reasoning summary、tool use、tool result、approval、retry、cost、policy hit、Finding 和 artifact。
7. 插件扩展：触发器、邮件、IM、代码仓、输出发布和看板指标只通过插件清单、任务蓝图和环境配置接入。
8. 记忆沉淀：OpenViking 作为开箱即用的分层记忆服务，保存检视上下文、Skill、结果、人工反馈和归档记忆。

## 平台能力域

- Provider 执行层：控制台只暴露 AI Provider 配置，包括 Base URL、API Key 引用、默认模型、能力参数和健康状态；底层 Agent Runtime 由系统内置。
- Agent 定义层：在线编辑 Agent 的角色、默认系统提示词、Harness 权限、模型、工具集和记忆范围。
- 工具 / Skill 管理层：工具权限采用 allow / deny / approval 模型，与运行约束对齐。
- 多 Agent 编排层：Agent 团队定义 Leader、成员、目标、交互提示词和依赖关系。
- Agent 团队任务执行层：每个团队接受任务并在任务空间中展示全量执行过程。
- 业务团队管理层：租户空间和业务团队管理预算、可见性、创建者、编辑者、使用者和跨团队调用。
- 任务执行展示层：按业务团队、任务蓝图、触发方式、任务类别、状态、Finding、成本和优先级展示全局任务看板。
- 环境层：管理 Environment Template、Environment Snapshot、代码仓、执行人、PRIVATE_KEY 引用、执行路径、记忆依赖和未来沙箱。
- 记忆层：基于 OpenViking 做分层、分域、分团队记忆管理，并给 OpenViking CLI 提供访问配置。

## 当前实现

- Next.js + TypeScript 单服务应用。
- React 19 + Radix UI 组件层，提供自适应后台布局、可收缩左侧导航、移动端抽屉侧栏，以及以摘要条、数据表、定义列表和表单工作台为核心的控制台界面。
- SQLite 本地持久化，启动时自动初始化领域模型、任务蓝图、AI Provider、基础配置、团队治理资产和两个核心案例配置。
- 左侧导航已收敛为四个域：总览、智能体治理、团队治理、基础配置。
- AI Provider 配置：`/runtimes`，支持 OpenAI Compatible、OpenAI Responses、OpenAI Chat / Completions、Anthropic、Azure OpenAI 等接口风格，控制台不暴露底层运行框架配置。
- Agent 定义中心：`/agents`，支持按默认系统提示词定义 Agent，配置默认 Provider、模型、工具、记忆范围，并附带 Agent Harness 配置，包括审批模式、Thinking 强度、人工介入、允许 / 禁止工具、仓库权限、记忆权限和 Secret 权限。
- Agent Team 编排中心：`/agent-teams`，支持从 Agent 定义目录选择成员、指定 Leader、定义 Team 结构与工作流、设置团队目标 / 编排提示词，并把 Team 共享给不同业务团队，分别授予查看、执行或编辑权限。
- Agent 定义测试与优化：可直接调用当前 Provider 优化 Agent 提示词和职责描述，并在保存前做真实模型测试，查看输出、thinking 和工具调用结果；测试会按 Agent 自身的 Harness 权限边界执行。
- 交互实验台：`/interactions`、`/interactions/:id`，用于真实模型对话、Team 会话、thinking / tool call 轨迹和人工介入；它保留为 human-in-the-loop 实验面，不再承担任务内核建模职责。单 Agent 会话可直接选择 Agent 定义并继承默认系统提示词与 Harness 画像。
- 任务定义中心：`/task-blueprints`、`/task-blueprints/:id`，支持把任务与 Agent Team、执行环境和触发方式绑定起来，并保留 Task Blueprint 内核的高级策略能力。
- 团队治理：`/business-teams`、`/team-members`、`/team-permissions`、`/team-assets`，支持组织结构、成员、权限和团队资产治理；团队成员支持从 Excel 复制粘贴批量导入。
- 基础配置：`/skills`、`/mcp`、`/connectors`、`/codebases`、`/knowledge`、`/environments`、`/webhooks`、`/runtime-bindings`、`/settings`。Skill 可归属团队、打标签、优化润色并同步到 OpenViking；MCP 管理 server/transport/tool allowlist；Connector 管理 IM、邮件、Web Push；Codebase 管理代码仓和多个操作者 token；执行环境、Webhook 和 Provider 执行配置均可表格化维护。
- 任务蓝图 API：`GET /api/task-blueprints`、`GET /api/task-blueprints/:id`、`POST /api/task-blueprints/:id/submit`、`GET /api/task-blueprints/:id/permission-preview`。
- 任务模板和定时模板只作为兼容视图存在，主读取路径由 `task_blueprints` 派生，避免 `task_templates` / `schedule_templates` 形成第二套任务模型。
- 插件清单和扩展包导入 API：`GET/POST /api/plugins/manifests`，支持导入插件、执行环境、Webhook endpoint、任务蓝图和兼容模板；`plugins/official/*` 目录用于承载主干自带的官方插件包。
- 任务提交与执行 API：`POST /api/task-runs/submit`、`POST /api/task-runs/:id/tick`、`POST /api/task-runs/:id/resume`。
- 输出发布链路：TaskRun 完成后按蓝图 `outputPolicy` 统一发布 Finding，可走插件输出发布器、看板、邮件报告草稿和 artifact 归档草稿。
- 任务空间 API：成本、依赖图、执行看板、策略命中和人工干预解析。
- Finding API：`GET /api/findings`。
- Agent 定义 API：`GET /api/agent-definitions`、`POST /api/agent-definitions`、`PATCH /api/agent-definitions`、`POST /api/agent-definitions/optimize`、`POST /api/agent-definitions/test`。
- 基础配置 API：`/api/provider-profiles`、`/api/provider-runtime-bindings`、`/api/skills`、`/api/mcp-servers`、`/api/connectors`、`/api/codebases`、`/api/environments`、`/api/webhooks`、`/api/knowledge/spaces`、`/api/knowledge/entries`，均按资源方式支持查询、新增、编辑和删除。
- 团队治理 API：`/api/tenant-spaces`、`/api/business-teams`、`/api/team-members`、`/api/team-permissions`、`/api/team-assets`、`/api/execution-policies`、`/api/service-catalog`、`/api/access-grants`，均按资源方式支持查询、新增、编辑和删除。
- Webhook 入口：`POST /api/webhooks/:pathKey`。
- OpenViking 记忆接口：`/api/knowledge/layers`、`/api/knowledge/spaces`、`/api/knowledge/entries`、`/api/knowledge/context`、`/api/knowledge/read`、`/api/knowledge/skills`。

## 配置资源治理原则

控制台中出现的配置对象都必须是可持久化资源，不能把页面当作架构说明书或静态示例。当前后台页面统一采用“表格列表 + 详情弹窗 + 新增 / 编辑弹窗 + 删除动作”的形态，配置写入 SQLite，任务运行时再从数据库读取：

- 基础配置：AI Provider、Provider 执行配置、Skill、MCP Server、Connector、Codebase、Codebase 操作者 Token、执行环境、Webhook、知识空间、知识条目。
- 团队治理：租户空间、业务团队、团队成员、团队权限、团队资产、执行策略、服务目录、跨团队授权。
- 智能体治理：Agent 定义、Agent Team 定义、Agent Team 成员与共享关系。
- 任务治理：Task Blueprint、触发方式、执行环境、权限策略、记忆策略和输出策略。

删除策略按资源性质区分：有 `status` 生命周期的资源优先软删除并从列表中过滤；纯关系型授权或成员关系可以硬删除。这样既满足控制台增删查改，也避免历史任务运行记录被配置删除动作破坏。

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

OpenViking 不通过容器运行时集成。AgentWorld 启动时会自动检查 `/health`。如果本地 OpenViking 不可用且 `AGENTWORLD_OPENVIKING_AUTO_START=1`，会拉起服务端二进制：

```text
thirdparty/openviking/bin/openviking-server
```

也可以通过环境变量指定外部二进制：

```bash
OPENVIKING_SERVER_BIN=/opt/openviking/openviking-server
```

自动启动顺序：

1. 如果 `OPENVIKING_BASE_URL` 已经健康，直接复用现有服务。
2. 如果是本地地址，优先使用 `OPENVIKING_SERVER_BIN`。
3. 然后查找 `thirdparty/openviking/bin/openviking-server`。
4. 再查找 `thirdparty/openviking/bin/openviking-server-${platform}-${arch}`。
5. 开发模式最后 fallback 到 `.venv-openviking/bin/openviking-server`。

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
- `agentworld` 与 `openviking-server` 两个启动脚本。默认执行 `./agentworld` 时会自动拉起 OpenViking；`./openviking-server` 仅作为手动诊断入口。

## 知识管理

AgentWorld 在 OpenViking 之上建立团队级知识管理模型：

- Knowledge Space：全局、团队、项目、AgentTeam 四类知识空间，每个空间都有稳定 `viking://` URI。
- Knowledge Binding：把知识空间绑定到业务团队、项目、AgentTeam、任务蓝图或 Agent 定义，并声明 read / write / archive 权限。
- Knowledge Context：任务蓝图实例化时，系统会按业务团队、项目、AgentTeam、环境和 `memoryPolicy` 解析可读知识与归档目标，并写入 Environment Snapshot。
- Task Event：任务节点执行 `memory.retrieve` 时会记录 `memory.read_requested`、`memory.read_completed` 或 `memory.degraded`，用于任务空间展示和审计。

页面入口：

```text
/knowledge
```

API：

```text
GET  /api/knowledge/spaces
POST /api/knowledge/spaces
PATCH /api/knowledge/spaces
DELETE /api/knowledge/spaces
GET  /api/knowledge/entries
POST /api/knowledge/entries
PATCH /api/knowledge/entries
DELETE /api/knowledge/entries
GET  /api/knowledge/context?teamId=...&blueprintId=...
GET  /api/knowledge/layers
GET  /api/knowledge/read?uri=...&level=L0|L1|L2
```

## 插件扩展

AgentWorld 开源主干只定义协议、清单、任务蓝图、权限校验和观测记录。企业 Git、GitLab、Gitea、内部 MR 系统、企业邮箱、IM 等差异通过扩展包导入：

```http
POST /api/plugins/manifests
```

扩展包和官方插件可以声明：

- 插件清单：Provider、触发器、通知、代码仓、工具、Skill、输出发布器、看板指标。
- 执行环境：代码仓地址、执行人、私钥引用、工作目录、记忆依赖。
- Webhook endpoint：path key、验签入口、请求 schema 和启用状态。
- 任务蓝图：触发器、输入 schema、环境选择器、Agent 编排、权限、输出、看板、可靠性策略。
- 兼容模板：旧导入包仍可携带 task template / schedule template，但主干读取时会转换为 Task Blueprint 派生视图。
- 触发模板：一次性、定时、Webhook、事件触发。

主干不需要为了企业代码仓软件差异修改代码。

当前官方插件目录约定：

```text
plugins/official/<plugin-id>/plugin.json
```

当前仓库已内置一个可执行官方插件样例：

- `official.codehub`
  - Repository Connector
  - Webhook Parser
  - Merge Request Review Publisher
  - Tool Bundle

插件运行时 SDK 位于：

```text
src/server/plugin-sdk-core.ts
src/server/plugins/official/codehub.ts
```

## 核心案例

### 代码检视：MR 分层检视

平台默认保留一个通用 MR 检视蓝图样例，同时提供可导入的企业代码仓插件样例。核心运行路径始终是 Task Blueprint：

- 任务蓝图：`shield_mr_review`
- 环境：`env-shield-mr-review`
- 团队：`PR Vanguard`
- 插件：`builtin.repo.git`
- 记忆层：`repository/code-review`、`global/code-review`、`security`、`quality/test`、`data-interface`

Webhook 把 MR diff 给到系统后，会先进入 `shield_mr_review` 任务蓝图，校验幂等键，生成环境快照和权限快照，再由检视 Agent 团队读取 Skill 和记忆层，完成代码质量、安全、测试等分层检视。结果统一写入 Finding，再通过 MR 评论、看板和归档发布。没有配置代码平台 token 时只生成评论内容，不回写外部系统。

作为企业代码仓样例，仓库现已提供 `official.codehub` 官方插件与 `codehub-review` 导入样例。导入后会同时写入：

- `official.codehub` 插件清单
- `env-codehub-mr-review` 执行环境
- `webhook:codehub-mr` Webhook endpoint
- `codehub_mr_review` 任务蓝图

`codehub_mr_review` 会使用插件 Webhook Parser 标准化 MR 输入，使用插件 Review Publisher 生成或回写 MR 评论。没有配置 `CODEHUB_HOST` / `CODEHUB_TOKEN` 时，发布结果保持为 draft；配置完成后才对外部 CodeHub 发起真实回写。这样企业代码检视是配置和插件导入结果，不是主干硬编码分支。

### 每日全量安全检视

已内置全局配置：

- 任务蓝图：`daily_security_review`
- 环境：`env-daily-security-scan`
- 通知插件：`builtin.notify.email`
- 记忆层：`security`、`feedback/correct`、`feedback/incorrect`

调度器每天按仓库集合实例化 `daily_security_review` 任务蓝图。执行策略支持按仓库分片、幂等键、重试、全量环境快照、Finding 去重、邮件报告草稿、看板发布和 artifact 归档。邮件连接器未配置时不外发，只生成可审计的发布草稿。

## 设计文档

- [系统概要设计](docs/system-design.zh-CN.md)
- [系统详细设计](docs/system-design-detailed.zh-CN.md)
- [8 个核心规格](docs/specs/)

## 环境变量

参考 `.env.example`。关键变量：

```text
AGENTWORLD_GLM_API_KEY=
OPENAI_API_KEY=
CODE_PLATFORM_TOKEN=
CODE_PLATFORM_WEBHOOK_SECRET=
OPENVIKING_BASE_URL=http://127.0.0.1:1933
AGENTWORLD_OPENVIKING_AUTO_START=1
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
