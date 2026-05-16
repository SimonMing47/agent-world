# AgentWorld 系统概要设计（全量）

## 1. 系统定位

AgentWorld 定位为团队级 Agent 平台。它不是单人聊天框，而是把 Provider、Agent、工具、团队编排、任务执行、业务团队、环境和记忆统一起来的可治理任务执行系统。

核心主线：
- 业务团队通过 World / Kingdom 管理权限、预算、可见性和跨团队调用。
- AgentTeam 是可运营的服务单元，包含 Leader/Captain 与协作 Agent。
- Quest 是任务执行实体，支持一次性、定时、webhook 和合约调用。
- Harness 负责工具权限、审批、预算、输出和安全策略。
- OpenViking 负责分层分域记忆，并向 Agent / CLI 暴露读取接口。
- IM、邮件、代码仓、Provider 都通过插件协议扩展，主干只保留开放协议和默认清单。

## 2. 九层架构

1. Provider 执行层：统一执行网关，默认支持 opencode SDK，预留 claude code、openclaw 等 CLI Provider 插件。
2. Agent 定义层：定义 Agent 的角色、提示词、权限、工具集、模型、记忆范围和团队归属。
3. 工具 / Skill 管理层：管理工具与 skill，权限模型与 Harness 对齐，默认能力通过插件声明。
4. 多 Agent 编排层：定义 Leader、协作 Agent、任务目标、交互提示词和 DAG 依赖。
5. Agent 团队任务执行层：每个 AgentTeam 接收 Quest，任务空间展示对话、thinking、tool use、tool result、人工操作。
6. 业务团队管理层：World / Kingdom 支撑多团队分权，Agent 与 AgentTeam 支持个人、团队、全局可见。
7. 任务执行展示层：按业务团队、任务类别、触发方式和状态组织全局看板。
8. 环境层：管理代码仓、执行人、PRIVATE_KEY 引用、执行路径、沙箱预留和任务记忆依赖。
9. 记忆层：基于 OpenViking 做全局、团队、任务、skill、反馈记忆的分层分域管理。

## 3. 前后端排布

前端按“治理、定义、执行、观察、配置”组织：
- 总览和大屏：展示所有任务、团队、触发类型、成本和运行状态。
- AgentTeam：展示 Leader、协作 Agent、角色、工具集、模型和记忆范围。
- Quest：展示任务列表和任务空间，任务空间保留完整执行交互记录。
- Harness / Knowledge / Runtime / Settings：分别承接权限、记忆、Provider 和环境配置。
- 九层架构页：把设计层、代码映射、API 边界、扩展点和案例配置放在一个对照视图中。

后端按“领域核心 + 外部边界 + API”组织：
- `src/server/*-core.ts`：主干领域逻辑，如调度、执行、权限、租户、环境、插件、记忆。
- `src/server/*-adapter.ts`：Provider 或外部系统适配，如 opencode。
- `src/app/api/**`：面向页面、CLI、webhook 和插件的接口。
- SQLite：保存团队、Agent、Quest、事件、环境、记忆索引和检视记录。

## 4. 可靠性与扩展性原则

- 幂等：Quest 提交、webhook 入口、节点推进和反馈写入都要能安全重试。
- 可观测：每个 Quest 都有 trace id、event log、节点状态、成本、策略命中和人工干预记录。
- 最小主干：开源主干只承载协议、编排、治理和默认清单；外部系统接入通过插件扩展。
- Secret 安全：主干保存 secret ref，不保存明文 KEY 或 PRIVATE_KEY。
- 降级可用：OpenViking 不可用时写入本地影子索引；代码平台 token 缺失时 MR 评论 dry-run。
- 分权治理：任务全局可见，但工具使用、跨团队调用和写操作受 Harness / Contract 控制。

## 5. 标准案例

### 5.1 神盾计划：MR webhook 代码检视

配置项：
- 任务模板：`template-shield-mr-review`
- 执行环境：`env-shield-mr-review`
- AgentTeam：`PR Vanguard`
- 插件：代码仓插件、Provider 插件
- 记忆层：仓库上下文、全局检视经验、安全、测试、契约 skill

流程：
1. webhook 接收 MR diff。
2. 系统生成可观测 Quest，并记录 review 上下文。
3. Agent 团队按 skill 分层检视。
4. 结果生成 MR 评论，token 存在时回写代码平台。
5. 用户反馈写回 OpenViking，沉淀为后续检视记忆。

### 5.2 每日全量安全检视

配置项：
- 任务模板：`template-daily-security-review`
- 执行环境：`env-daily-security-scan`
- 插件：代码仓插件、Provider 插件、邮件插件
- 记忆层：安全 skill、正确反馈、误报反馈

流程：
1. 调度器按每日定时模板生成 Quest。
2. 环境层选择仓库集合、执行人、私钥引用和工作路径。
3. 安全检视 Agent 读取 OpenViking skill 与历史反馈。
4. 输出风险报告并归档记忆。
5. 邮件插件发送日报。
