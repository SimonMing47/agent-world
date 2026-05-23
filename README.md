# AgentWorld

AgentWorld 是一个团队级 Agent 平台，核心目标是把 Agent 从“单次对话”升级为可治理、可配置、可观测、可扩展的团队任务执行系统。

系统默认使用严肃标准术语：租户空间、业务团队、Agent、Agent 团队、服务目录、跨团队授权、任务执行、运行约束、执行环境、记忆层。产品名称保留 AgentWorld；风格化叙事不再作为默认表达。界面文字、术语、状态枚举和常用短语默认从内置 `zh-CN` 语言包加载，后续可通过系统配置页或 `AGENTWORLD_LANGUAGE_PACK_JSON` / `NEXT_PUBLIC_AGENTWORLD_LANGUAGE_PACK_JSON` 做语言包覆盖；新旧页面的可见文本、表单提示、按钮、弹窗和常用辅助属性都会走同一套语言包短语解析。

## 主线方向

AgentWorld 的主线不是再包装一个聊天框，而是建立团队级 Agent 平台的核心闭环：

1. 团队治理：业务团队是一切工作、资产、权限和任务归属的核心。
2. Agent 治理：Agent 是系统第一公民，也是调度的最小单位；Agent 团队是完成复杂任务的调度单元。
3. Task Blueprint：所有一次性、定时、Webhook、跨团队调用都先收敛为统一任务蓝图，并归属于业务团队。
4. Agent 调度：任务蓝图实例化为 TaskRun、TaskRunPlan、TaskRunNode、环境快照、权限快照和事件流。
5. Agent 调用：节点执行前经过模型服务、运行约束、跨团队授权、工具权限、执行环境和记忆层解析。
6. 执行观测：任务空间记录 plan、reasoning summary、tool use、tool result、approval、retry、cost、policy hit、Finding 和 artifact。
7. 插件扩展：触发器、邮件、IM、代码仓、输出发布和看板指标只通过插件清单、任务蓝图和环境配置接入。
8. 记忆沉淀：OpenViking 作为开箱即用的分层记忆服务，保存检视上下文、Skill、结果、人工反馈和归档记忆。

## 平台能力域

- 模型服务执行层：控制台只暴露模型服务配置，包括 Base URL、API Key 引用、默认模型、能力参数和健康状态；底层执行接口由系统内置。
- Agent 定义层：在线编辑 Agent 的角色、默认系统提示词、运行约束、模型、工具集和记忆范围。
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
- SQLite 本地持久化，启动时只初始化数据库 schema，不预置租户、业务团队、Agent、Agent 团队、任务蓝图、模型服务、执行环境、知识空间或案例数据；所有可配置资源必须从控制台或资源 API 新增后入库。
- 语言包治理：内置 `src/locales/zh-CN.ts` 作为默认语言包，页面标题、面板、表格头、表单字段、按钮、弹窗、状态枚举和术语均通过语言包加载；运行时还会对剩余可见短语做语言包精确覆盖，系统配置页提供语言包 JSON 覆盖，配置写入 SQLite 的 `system_settings`。
- 左侧导航已收敛为四个域：总览、智能体治理、团队治理、基础配置。侧边栏只放高频治理入口；执行环境、Webhook、执行配置、租户、执行策略、服务目录和跨团队授权等长尾配置统一从系统配置进入。
- 模型服务配置：`/runtimes`，支持 OpenAI Compatible、OpenAI Responses、OpenAI Chat / Completions、Anthropic、Azure OpenAI 等接口风格，控制台只暴露可治理的模型服务。
- Agent 目录：`/agents`，支持按默认系统提示词定义 Agent，配置默认模型服务、模型、工具、记忆范围，并附带运行约束，包括审批模式、推理强度、人工介入、允许 / 禁止工具、仓库权限、记忆权限和密钥权限。
- Agent 团队目录：`/agent-teams`，支持从 Agent 目录选择成员、指定 Leader、定义团队结构与工作流、设置团队目标 / 编排提示词，并把 Agent 团队共享给不同业务团队，分别授予查看、执行或编辑权限。
- Agent 定义验证与优化：可直接调用当前模型服务优化 Agent 提示词和职责描述，并在保存前做真实模型验证，查看输出、推理摘要和工具调用结果；验证会按 Agent 自身的运行约束执行。
- 交互工作台：`/interactions`、`/interactions/:id`，用于真实模型对话、Agent 团队会话、推理摘要 / tool call 轨迹和人工介入；它保留为 human-in-the-loop 验证面，不再承担任务内核建模职责。单 Agent 会话可直接选择 Agent 定义并继承默认系统提示词与运行约束，会话目录支持打开和删除，运行中的会话会被后端保护避免误删。
- 任务定义中心：`/task-blueprints`、`/task-blueprints/:id`，支持把任务与 Agent 团队、执行环境和触发方式绑定起来，并保留 Task Blueprint 内核的高级策略能力。
- 块式任务编排：任务蓝图编辑器支持通过界面添加 Agent 执行、Agent 团队执行、脚本 Hook、HTTP Hook、通知 Hook 等执行块；块的依赖、工具、动作、脚本、URL、通知通道和 Payload 模板都会落库到 `agent_team_run_plan_json`，实例化后生成 TaskRunNode 和事件流。
- Finding 治理：`/findings`，支持对代码检视、安全检视和其他任务产出的标准化 Finding 做误报、忽略、修复、发布状态跟踪，并可编辑证据、建议和分类。
- 团队治理：`/business-teams`、`/team-members`、`/team-permissions`、`/team-assets`，支持组织结构、成员、权限和团队资产治理；团队成员支持从 Excel 复制粘贴批量导入。
- 身份与访问：`/signin`、`/access-request`、`/identity-access` 提供通用企业级登录入口层、团队白名单闸门、员工身份同步视图和访问申请处理；当前内置 Development Preview 入口用于联调，后续企业可在同一套适配器接口上接入自有 SSO。
- 基础配置：`/runtimes`、`/skills`、`/mcp`、`/connectors`、`/codebases`、`/knowledge`、`/settings`。Skill 可归属团队、打标签、优化润色并同步到 OpenViking；MCP 管理 server/transport/tool allowlist；Connector 管理 IM、邮件、Web Push；Codebase 管理代码仓和多个操作者 token；系统配置页继续提供执行环境、Webhook 和模型执行配置等长尾入口。
- 任务蓝图 API：`GET /api/task-blueprints`、`POST /api/task-blueprints`、`PATCH /api/task-blueprints/:id`、`DELETE /api/task-blueprints/:id`、`POST /api/task-blueprints/:id/submit`、`POST /api/task-blueprints/scheduler/tick`、`GET /api/task-blueprints/:id/permission-preview`。
- 任务模板和定时模板只作为兼容视图存在，主读取路径由 `task_blueprints` 派生，避免 `task_templates` / `schedule_templates` 形成第二套任务模型。
- 插件清单和扩展包导入 API：`GET/POST /api/plugins/manifests`，支持导入插件、执行环境、Webhook endpoint、任务蓝图和兼容模板；`plugins/official/*` 目录用于承载主干自带的官方插件包。
- 任务提交与执行 API：`POST /api/task-runs/submit`、`POST /api/task-runs/:id/tick`、`POST /api/task-runs/:id/resume`。
- 输出发布链路：TaskRun 完成后按蓝图 `outputPolicy` 统一发布 Finding，可走插件输出发布器、看板、邮件报告草稿和 artifact 归档草稿。
- 插件运行时上下文：可执行插件通过 `readTaskContext`、`readEnvironment`、`resolveSecretRef`、`requestPermission`、`emitEvent`、`createFinding`、`createArtifact` 与平台内核交互；插件不直接访问核心数据库，产出统一进入任务事件流、Finding 和 artifact 事件。
- 任务空间 API：成本、依赖图、执行看板、策略命中和人工干预解析。
- Finding API：`GET /api/findings`、`POST /api/findings`、`PATCH /api/findings`、`DELETE /api/findings`。
- Agent 定义 API：`GET /api/agent-definitions`、`POST /api/agent-definitions`、`PATCH /api/agent-definitions`、`POST /api/agent-definitions/optimize`、`POST /api/agent-definitions/test`。
- 基础配置 API：`/api/provider-profiles`、`/api/provider-runtime-bindings`、`/api/skills`、`/api/mcp-servers`、`/api/connectors`、`/api/codebases`、`/api/environments`、`/api/webhooks`、`/api/knowledge/spaces`、`/api/knowledge/entries`，均按资源方式支持查询、新增、编辑和删除。
- 身份与访问 API：`/api/auth/dev-login`、`/api/auth/logout`、`/api/auth/session`、`/api/auth/providers`、`/api/access-whitelist`、`/api/access-requests`、`/api/identity-access/settings`。系统管理员通过这些资源接口管理通用 SSO 入口、团队白名单和访问申请；非白名单员工只会看到访问申请入口，不会直接进入系统内容。
- 通用设置 API：`GET/PUT /api/system-settings/language-pack`，用于读取和保存当前语言包、术语和短语覆盖。
- 团队治理 API：`/api/tenant-spaces`、`/api/business-teams`、`/api/team-members`、`/api/team-permissions`、`/api/team-assets`、`/api/execution-policies`、`/api/service-catalog`、`/api/access-grants`，均按资源方式支持查询、新增、编辑和删除。
- Webhook 入口：`GET /api/webhooks/:pathKey`、`POST /api/webhooks/:pathKey`。保存 Webhook 类型任务蓝图时会按 `trigger.webhookPathKey` 自动创建或更新对应 endpoint，外部系统可以直接调用自定义路径调入任务。
- OpenViking 记忆接口：`/api/knowledge/layers`、`/api/knowledge/spaces`、`/api/knowledge/entries`、`/api/knowledge/context`、`/api/knowledge/read`、`/api/knowledge/skills`。

## 配置资源治理原则

控制台中出现的配置对象都必须是可持久化资源，不能把页面当作架构说明书或静态示例。当前后台页面统一采用“表格列表 + 详情弹窗 + 新增 / 编辑弹窗 + 删除动作”的形态，配置写入 SQLite，任务运行时再从数据库读取：

- 主干不允许通过 seed、简单配置文件或页面常量预置业务数据；租户、团队、Agent、Agent 团队、任务、Provider、Codebase、Skill、Connector、Webhook、知识空间都必须由用户显式配置。
- 页面可以提供空表、创建入口、结构化表单和必要的枚举选项，但不能替用户选择数据库第一条记录作为默认配置，也不能把“代码检视”“每日安全检视”等 case 写成主干默认数据。
- 插件代码可以作为扩展能力存在，但插件清单、凭据、环境、Webhook 和任务蓝图必须导入或配置后才进入数据库；未安装、未导入、未启用的插件不应出现在业务配置列表里。

- 基础配置：模型服务、模型执行配置、Skill、MCP Server、Connector、Codebase、Codebase 操作者 Token、执行环境、Webhook、知识空间、知识条目。
- 团队治理：租户空间、业务团队、团队成员、团队权限、团队资产、执行策略、服务目录、跨团队授权。
- 智能体治理：Agent 定义、Agent 团队定义、Agent 团队成员与共享关系。
- 任务治理：Task Blueprint、触发方式、执行环境、权限策略、记忆策略和输出策略。
- Finding 治理：标准化问题输出、严重度、状态、证据、建议、发布结果、误报和修复闭环。

删除策略按资源性质区分：有 `status` 生命周期的资源优先软删除并从列表中过滤；纯关系型授权或成员关系可以硬删除。这样既满足控制台增删查改，也避免历史任务运行记录被配置删除动作破坏。

## 商用化控制台原则

- 页面语言面向业务治理和运行管理，避免把底层框架、过程态术语或演示型文案放到主界面。
- 页面可见文案必须从语言包加载。新增页面或组件时，应复用 `PageHeader`、`PanelHeader`、`SummaryStrip`、`DataTableHead`、`FieldGroup`、`Button`、`DialogTitle` 等已接入语言包的共享组件，新增枚举文案放入语言包 `labels`，新增固定短语放入语言包 `phrases`；已有页面里的直接短语也可以通过 `phrases` 精确覆盖，避免企业定制时遗漏。
- 高频入口保持四个域：总览、智能体治理、团队治理、基础配置；长尾系统配置统一收敛到系统配置页。
- 配置页优先使用表格、表单、详情弹窗和明确操作按钮；看板页优先展示状态、趋势、风险和待处理事项。
- “模型服务、运行约束、推理摘要、Agent 团队、业务团队”是默认产品术语；底层适配器和运行接口只在规格、插件协议和扩展开发文档中出现。
- 所有新增能力必须落库、可编辑、可删除、可审计，并能被任务蓝图、Agent 或 Agent 团队引用。

## 快速开始

```bash
pnpm install
pnpm bootstrap
pnpm dev
```

`pnpm dev` 会先检查本地 OpenViking `/health`。如果 `AGENTWORLD_OPENVIKING_AUTO_START` 未关闭且本地服务不可用，会先拉起 OpenViking，再启动 Next dev server。

默认访问地址：

```text
http://localhost:7369
```

常用校验：

```bash
pnpm config-data:audit
pnpm quality:audit
pnpm security:audit
pnpm typecheck
pnpm lint
pnpm build
```

工程交付基线：

- `config-data:audit`：检查是否有可配置业务数据被 seed、首条默认值或示例 case 写回主干。
- `i18n:audit`：检查是否把中文文案直接写回 `src`，绕过语言包。
- `quality:audit`：输出仓库复杂度热点、`TODO/FIXME`、`any` 和 `eslint-disable` 使用情况，避免大文件和临时性代码继续扩张。
- `security:audit`：检查危险执行、原始 HTML 注入、私钥材料、硬编码密钥和本地 secret 文件兜底等基础安全风险。

生产启动：

```bash
pnpm build
pnpm start
```

`pnpm start` 会运行 `.next/standalone/server.js`，不会走 `next start`，以匹配 `output: standalone` 发布方式。

## OpenViking 二进制集成

OpenViking 不通过容器运行时集成。AgentWorld 的启动脚本会自动检查 `/health`。如果本地 OpenViking 不可用且 `AGENTWORLD_OPENVIKING_AUTO_START=1`，会先拉起服务端二进制，再启动 AgentWorld：

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

- Knowledge Space：全局、团队、项目、Agent 团队四类知识空间，每个空间都有稳定 `viking://` URI。
- Knowledge Binding：把知识空间绑定到业务团队、项目、Agent 团队、任务蓝图或 Agent 定义，并声明 read / write / archive 权限。
- Knowledge Context：任务蓝图实例化时，系统会按业务团队、项目、Agent 团队、环境和 `memoryPolicy` 解析可读知识与归档目标，并写入 Environment Snapshot。
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

- 插件清单：模型服务、触发器、通知、代码仓、工具、Skill、输出发布器、看板指标。
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

当前仓库保留一个可执行官方插件代码样例，但不会自动安装、启用或写入数据库；只有用户通过插件导入接口或控制台显式导入后，插件清单才会进入业务配置：

- `official.codehub`
  - Repository Connector
  - Webhook Parser
  - Merge Request Comment Publisher
  - Tool Bundle

插件运行时 SDK 位于：

```text
src/server/plugin-sdk-core.ts
src/server/plugins/official/codehub.ts
```

SDK 给插件提供受控句柄：

- `readTaskContext`：读取 TaskRun、Task Blueprint、输入载荷和权限快照。
- `readEnvironment`：读取脱敏后的 Environment Snapshot。
- `resolveSecretRef`：只解析平台授权的 secret ref，不允许插件自行读取本地配置文件。
- `requestPermission`：按 allow / ask / deny 规则申请代码仓、输出、Finding、artifact 和 secret 使用权限。
- `emitEvent`：把插件事件写入统一 `event_logs` 和 `task_events`。
- `createFinding` / `createArtifact`：把插件产出写回标准 Finding 和 artifact 事件。

## 核心案例

### 代码检视：MR 分层检视

平台不默认创建 MR 检视蓝图、代码仓环境、Webhook endpoint 或检视团队。代码检视能力需要通过控制台完成配置，核心运行路径始终是 Task Blueprint：

- 导入或配置代码仓插件。
- 配置代码仓、操作者 token、Webhook secret 和 MR 评论回写权限。
- 创建业务团队、Agent、Agent 团队和检视 Skill。
- 创建 Webhook 触发的任务蓝图，绑定 Agent 团队、执行环境、权限策略、记忆策略和输出策略。
- 启用 Webhook endpoint 后，由外部代码平台调用用户自定义 path key。

Webhook 把 MR diff 给到系统后，会先进入用户配置的任务蓝图，校验幂等键，生成环境快照和权限快照，再由检视 Agent 团队读取 Skill 和记忆层，完成代码质量、安全、测试等分层检视。结果统一写入 Finding，再通过用户配置的输出发布器写回 MR、进入看板或归档。没有配置代码平台 token 时不应对外部系统发起真实回写。

作为企业代码仓样例，仓库提供 `official.codehub` 插件代码。导入后可以按用户选择写入：

- 插件清单。
- 执行环境。
- Webhook endpoint。
- 任务蓝图。

CodeHub 类型的任务蓝图会使用插件 Webhook Parser 标准化 MR 输入，使用插件 Comment Publisher 生成或回写 MR 评论。CodeHub 插件只能通过 SDK 的 `resolveSecretRef` 和 `requestPermission` 使用密钥与代码仓能力，不读取 `~/.config/opencode` 等本地文件。这样企业代码检视是配置和插件导入结果，不是主干硬编码分支。

### 每日全量安全检视

平台不内置每日安全检视全局配置。安全检视需要通过同一套 Task Blueprint 能力配置：

- 配置代码仓集合和操作者 token。
- 配置安全检视 Skill、知识空间和误报基线。
- 创建安全检视 Agent 团队。
- 创建定时触发任务蓝图，选择按仓库分片、重试、超时、Finding 去重和输出发布策略。
- 配置邮件、IM 或 Web Push Connector 作为输出通道。

调度器按用户配置的 Cron 表达式实例化任务蓝图。执行策略支持按仓库分片、幂等键、重试、全量环境快照、Finding 去重、邮件报告草稿、看板发布和 artifact 归档。邮件连接器未配置时不外发，只生成可审计的发布草稿。

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
AGENTWORLD_LANGUAGE_PACK_JSON=
NEXT_PUBLIC_AGENTWORLD_LANGUAGE_PACK_JSON=
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
