# AgentWorld 系统详细设计（全量）

## 1. 设计目标

AgentWorld 的详细设计以“团队级 Agent 平台”为唯一主线：用稳定开源主干提供编排、治理、观测和协议，用插件承接 Provider、IM、邮件、代码仓等外部系统。设计和实现必须能支撑神盾计划 MR 检视与每日全量安全检视两类案例。

## 2. 九层详细设计

### 2.1 Provider 执行层

- 职责：统一封装模型调用、opencode SDK、未来 CLI Agent 引擎。
- 当前实现：`provider-core.ts` 负责 Provider 选择，`opencode-adapter.ts` 负责 runtime 发现，`runtime-core.ts` 负责运行时摘要。
- 前端：`/runtimes` 展示 runtime 健康与能力目录；`/settings` 展示 Provider key 的 secret ref。
- 扩展点：`provider-runtime`，用于 claude code、openclaw 等 Provider 插件。
- 约束：主干只保存 `env:OPENAI_API_KEY`、`env:OPENCODE_API_KEY` 等引用，不保存明文 key。

### 2.2 Agent 定义层

- 职责：定义 Agent 的角色、提示词、模型、权限、工具集、记忆范围和所属 AgentTeam。
- 当前实现：`agents`、`agent_teams` 表保存定义；`/agent-teams` 展示 Leader、成员、工具集和记忆范围。
- 编排关系：AgentTeam 通过 `captain_agent_id` 定义 Leader，通过 `workflow_type` 定义 single/sequential/parallel/DAG。
- 可见性：AgentTeam 现有 public/private 能力，设计预留 personal/team/global。
- 后续扩展：Agent 版本、灰度发布、审批流、创建者/编辑者/使用者 ACL。

### 2.3 工具 / Skill 管理层

- 职责：管理工具、skill、权限、审计、OpenViking skill 访问。
- 当前实现：`harness-core.ts` 做 allow/deny/approval，`plugin-core.ts` 描述插件清单，`openviking-core.ts` 管理 skill 和知识层。
- 前端：`/harness` 展示权限策略；`/knowledge` 展示知识层和 Skill Registry；`/settings` 展示插件扩展点。
- API：`/api/knowledge/skills`、`/api/knowledge/read`、`/api/plugins/manifests`。
- 约束：新增工具只能通过插件声明挂载，执行前必须经过 Harness 决策。

### 2.4 多 Agent 编排层

- 职责：把任务拆成节点，定义 Leader 与协作 Agent 的依赖、交互和目标。
- 当前实现：`planner-core.ts` 做计划摘要，`queries.ts` 的 `submitQuest` 生成节点，`executeQuestTick` 推进依赖。
- 执行模型：节点状态从 submitted -> ready -> running -> completed/awaiting/failed。
- 可靠性：失败节点可独立 retry，人工审批后可 resume。
- 后续扩展：由 Captain Agent 动态生成 DAG，并在执行前做结构和权限校验。

### 2.5 Agent 团队任务执行层

- 职责：每个 AgentTeam 接受 Quest，提供任务空间与全量交互记录。
- 当前实现：`quests`、`quest_nodes`、`event_logs`、`quest_interventions` 表保存执行过程。
- 前端：`/quests` 展示任务列表；`/quests/[id]` 展示任务空间、调用阶段、节点、事件、成本和策略命中。
- 事件类型：planning、thinking、tool_result、approval_required、policy_violation、contract_violation、timeout、approval_result。
- 约束：任务空间必须展示 thinking 摘要、tool use、tool result、人工操作和 metadata，不能只展示最终结论。

### 2.6 业务团队管理层

- 职责：多团队共同使用多 Agent 时的权限、预算、可见性与跨团队调用治理。
- 当前实现：World / Kingdom / Contract / Tavern 模型。
- 可见性策略：Agent、AgentTeam 和环境支持个人、团队、全局的设计目标；任务本身保持全局可见。
- 权限策略：跨 Kingdom 调用必须有 Contract，工具动作必须过 Harness。
- 后续扩展：ACL 表、组织目录同步、创建者/编辑者/使用者角色。

### 2.7 任务执行展示层

- 职责：按业务团队、任务类别、触发方式和状态展示所有 Quest。
- 当前实现：`environment-core.ts` 生成任务类别看板，`scheduler-core.ts` 判断定时模板状态，`/` 与 `/wallboard` 展示全局视图。
- 任务类型：manual、schedule、webhook、contract；模板类型：cron、event、webhook。
- 指标：运行中、等待人工、公开 AgentTeam、生效 Contract、类别分布、团队分布、成本、优先级。
- 后续扩展：SSE/WebSocket 实时刷新、容量预测、成本曲线和团队 drill-down。

### 2.8 环境层

- 职责：管理任务执行对象和执行环境。
- 当前实现：`execution_environments` 表和 `environment-core.ts`，字段覆盖代码仓 provider/name/url、默认分支、执行人、PRIVATE_KEY 引用、工作目录、沙箱配置、记忆依赖。
- 前端：`/settings` 展示执行环境。
- 案例环境：`env-shield-mr-review`、`env-daily-security-scan`。
- 约束：主干只保存 `private_key_ref`，真实 PRIVATE_KEY 由外部 secret 管理。
- 后续扩展：沙箱模板、容器镜像、远程执行环境、代码仓插件多平台适配。

### 2.9 记忆层

- 职责：基于 OpenViking 做分层、分域、分团队记忆，并提供 skill 访问能力。
- 当前实现：`knowledge_layers`、`openviking_knowledge_entries`、`code_review_skills`，以及 OpenViking 远端写入 + 本地影子索引。
- API：`/api/knowledge/read?uri=&level=L0|L1|L2`、`/api/knowledge/layers`、`/api/knowledge/skills`。
- 分层：resources 保存仓库和全局经验，agent 保存 skill 知识，user 保存人工反馈。
- 约束：OpenViking 不可用时不能丢数据，本地 shadow 必须保留。

## 3. 插件化设计

插件协议字段：
- `id`、`name`、`version`、`capability`
- `mountPoint`：provider-runtime、tool-skill-registry、notification-channel、execution-environment
- `configSchema`：配置结构
- `requiredSecretRefs`：secret 或 env 引用
- `permissions`：与 Harness 对齐的权限
- `healthCheck`：健康检查方式
- `extensionOnly: true`：明确只能扩展，不能修改主干

默认插件清单：
- `builtin.provider.opencode`
- `builtin.notify.email`
- `builtin.notify.im`
- `builtin.repo.git`

导入协议：
- `POST /api/plugins/manifests` 可导入插件 manifest、任务模板、执行环境和触发模板组成的扩展包。
- 企业 Git、企业邮箱、IM、私有 Provider 只需要提供插件 manifest 和 adapter 引用，不修改 Quest 主流程。
- Webhook 入口先解析到 schedule/template，再解析到 task template，最后调用通用 `submitQuest()`。

主干边界：
- 主干负责读取清单、展示配置、保存引用、做权限决策。
- 插件负责外部 SDK、认证、网络调用、平台差异。
- 新增插件不需要修改任务主流程。

## 4. 数据模型映射

- 租户和团队：`worlds`、`kingdoms`
- Agent 定义：`agent_teams`、`agents`
- 权限：`harness_profiles`、`contracts`
- Provider / Runtime：`provider_profiles`、`runtime_endpoints`
- 任务：`task_templates`、`schedule_templates`、`quests`、`quest_plans`、`quest_nodes`
- 执行记录：`trace_spans`、`event_logs`、`quest_interventions`
- 环境：`execution_environments`、`repository_profiles`、`developer_profiles`
- 记忆：`knowledge_layers`、`openviking_knowledge_entries`、`code_review_skills`
- 检视案例：`webhook_endpoints`、`merge_request_reviews`、`review_findings`、`review_feedback`

## 5. 两个案例的实现对照

### 5.1 神盾计划

- Webhook：`/api/webhooks/[pathKey]`
- 检视核心：`code-review-core.ts`
- Quest 生成：Webhook 先解析任务模板，再调用 `submitQuest`
- 任务模板：`task-template-shield-mr-review`
- 触发模板：`template-shield-mr-review`
- 环境：`env-shield-mr-review`
- Skill：MR 结构、安全敏感、测试影响、数据契约
- 输出：MR 评论、review finding、Quest trace、OpenViking 记忆

### 5.2 每日全量安全检视

- 任务模板：`task-template-daily-security-review`
- 调度模板：`template-daily-security-review`
- 环境：`env-daily-security-scan`
- 仓库选择：按 Kingdom 和默认分支选择仓库集合
- Skill：安全检视 + 反馈记忆
- 通知：邮件插件 `builtin.notify.email`
- 输出：风险报告、邮件摘要、长期安全记忆

## 6. 覆盖性清单

- [x] 团队级 Agent 平台定位
- [x] 九层架构和前后端排布
- [x] opencode SDK 默认 Provider 与 CLI Provider 扩展点
- [x] Agent 角色、工具集、Leader 和团队展示
- [x] 工具 / skill 管理与 Harness 权限对齐
- [x] 多 Agent 编排、节点依赖、重试、人工干预
- [x] 任务空间完整事件记录
- [x] World / Kingdom / Contract 多团队治理
- [x] 全局任务看板和触发类别统计
- [x] 执行环境、代码仓、执行人、PRIVATE_KEY 引用和路径配置
- [x] OpenViking 记忆层、skill 管理和 CLI 读取接口
- [x] 插件化 IM、邮件、代码仓、Provider 接入边界
- [x] 神盾计划 MR 检视案例
- [x] 每日安全检视案例
