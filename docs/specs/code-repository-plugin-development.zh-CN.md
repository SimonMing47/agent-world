# 代码仓库平台插件开发指南

本文说明如何把一个外部代码仓库平台接入 AgentWorld，并让任务编排、Agent Skill、知识库和反馈闭环组合出代码变更检视流程。平台可以是 GitHub、Gitea、CodeHub 或企业内部系统；AgentWorld 核心只依赖通用插件能力，不内置任何专用业务流程。

通用插件机制、Manifest、运行时上下文和扩展点清单见 `docs/specs/plugin-development-guide.zh-CN.md`。本文只补充代码仓库平台的字段映射和任务组合建议。

## 设计边界

- 插件负责外部系统 I/O：校验 webhook、解析事件、读取 MR/PR diff、读取文件内容、发布评论、更新评论。
- Skill 负责检视知识：关注维度、判断规则、意见模板、误报/命中经验、仓库专有知识。
- 任务蓝图负责编排：选择 Agent 团队、阶段顺序、权限、发布渠道和反馈策略。
- 知识库负责持久化：Skill 文档、代码仓知识、通用领域知识、反馈沉淀都应可检索。

不要把某个具体业务名、报告名、外部平台名写进通用执行内核。需要差异化时，通过插件 manifest、任务蓝图配置、Agent 绑定 Skill 和知识库内容表达。

## 插件最小能力

一个代码仓库平台插件建议提供四类贡献：

1. `webhookParser`

   校验平台签名或共享密钥，解析仓库、分支、MR/PR 编号、提交 SHA、作者、目标分支、原始 payload，并生成幂等 key。

2. `repositoryConnector`

   提供读取仓库元信息、读取变更文件列表、读取指定提交下文件内容、按需比较 diff 的能力。该层只做数据获取，不做业务判断。

3. `toolBundle`

   暴露可被任务节点调用的工具，例如 `pull_request.files`、`pull_request.rule_scan`。规则扫描工具应从节点加载的 Skill rules 读取规则，并把结果写成通用 Finding。

4. `outputPublisher`

   提供发布普通评论、更新已有评论、逐条 Finding 评论等能力。评论内容由任务蓝图模板和 Finding 数据生成，插件只负责调用外部平台 API。

## Skill 应承载什么

优先把易迭代、可迁移的检视知识放进 Skill：

- 安全类：凭证泄露、动态执行、注入、权限边界。
- 可靠性类：未清理定时器、错误吞噬、未等待异步、取消路径缺失。
- 数据完整性类：金额精度、schema 校验、事务边界、状态流转。
- 架构边界类：UI 直连文件系统或外部服务、跨层依赖、插件边界绕过。
- 测试影响类：跳过测试、高风险逻辑缺少回归、风险 TODO。

Skill 写入 `inspection_skills` 后同步进知识库，Agent 通过 `skill:<skillId>` 或能力画像 `skillRefs` 绑定。任务运行时会加载该 Agent 的 Skill，自动把 Skill 知识 URI 加进检索范围，并把 Skill 中的 `heuristics.rules` 注入插件工具。

## 任务蓝图如何串起来

推荐蓝图阶段如下：

1. 上下文加载阶段

   使用 `memory.retrieve` 读取 `code`、`skill`、`domain` 类知识，范围限制到当前仓库和当前任务需要的 Skill。

2. 分层扫描阶段

   多个 `plugin_tool` 节点分别绑定不同 Agent。每个 Agent 只加载自己的 Skill，调用同一个平台插件扫描工具，产出通用 Finding。

3. 逐条发布阶段

   使用 `publisher` 节点设置 `forEach: finding`，把每条 Finding 评论到外部 MR/issue，并附带公开反馈链接。

4. 汇总发布阶段

   使用 output policy 的通用 publisher 发布统一报告，列出 Finding 数、严重度、位置、反馈链接和任务运行 ID。

5. 反馈沉淀阶段

   外部评论里的反馈链接指向 AgentWorld 公共反馈页。用户反馈准确性后写入 `inspection_feedback`，并可沉淀为代码仓级知识，供后续同仓库任务检索。

## 权限建议

插件运行时权限应显式声明并由任务蓝图授权：

- `repo.read`：读取仓库、MR/PR、diff、文件内容。
- `repo.issue.comment` 或平台等价权限：发布 MR/issue 评论。
- `secret.use`：读取 token、webhook secret 等密钥引用。
- `tool.finding.create`：允许插件工具创建通用 Finding。

默认不要授予写仓库、合并 MR、删除分支等权限。确有需要时作为独立阶段配置，并进入人工审批或更严格的执行策略。

## CodeHub 接入要点

实现 CodeHub 时，不需要改 AgentWorld 通用执行内核。按平台 API 映射以下字段即可：

- webhook 解析输出：`repo_id`、`repository_owner`、`repository_name`、`pull_request_index` 或 `mr_id`、`issue_iid`、`diff_ref`、`source_commit_sha`、`target_branch`、`source_branch`。
- diff 文件：文件路径、状态、增删行数、文件 URL、head commit 下文件内容。
- 评论发布：支持按 MR/issue 编号新建评论；如平台支持更新评论，可额外接收 `commentId`。
- 认证：通过 `tokenRef` 和 `webhookSecretRef` 读取密钥，不把 token 写进蓝图明文。

CodeHub 专有字段可以保留在原始 payload 或插件 payload 中，但输出给 AgentWorld 的标准上下文应尽量使用上述通用字段。

## 验收清单

- webhook 可以触发任务，并生成稳定幂等 key。
- 任务详情页显示分层 Agent 节点全部完成。
- 每个扫描 Agent 的事件里能看到已加载的 Skill 和对应知识 URI。
- 插件工具创建的 Finding 带有文件、行号、规则 ID、commit SHA 和 Skill 引用。
- 外部 MR/issue 下出现逐条 Finding 评论和汇总评论。
- 评论中的反馈链接无需登录可访问。
- 提交准确/不准确反馈后，`inspection_feedback` 有记录，代码仓知识空间出现对应反馈知识条目。
- 后续同仓库任务能按 `code` 类知识和仓库名检索到反馈沉淀。
