# 记忆与知识规格

## 1. 定位

记忆与知识层负责为 AgentWorld 提供长期上下文、可复用能力、执行经验和人工反馈沉淀。默认记忆服务为 AgentWorld 知识引擎，平台通过 `agentworld://knowledge/` URI 组织资源、Agent 可加载知识和用户记忆空间。

记忆读取属于 Agent 调用准备阶段，记忆写入属于调用收尾或人工反馈阶段。调度层只解析 Task Blueprint 中的记忆声明和权限，不直接拼接检索内容进入 Provider 请求。

## 2. 设计目标

- 使用 AgentWorld 知识引擎 `agentworld://knowledge/` URI 作为稳定记忆地址。
- 区分资源上下文、Agent 可加载知识和用户反馈记忆。
- 支持 TaskBlueprint 声明 readScopes、writeScopes 和 knowledgeRefs；旧 skillRefs 仅作为兼容字段读取。
- 将 Finding、人工反馈和任务总结写回可检索空间。
- 支持远端 AgentWorld 知识引擎 不可用时的受控降级和本地影子索引。

## 3. URI 空间

AgentWorld 默认使用三类 AgentWorld 知识引擎 URI：

```text
agentworld://knowledge/resources/agentworld/...
agentworld://knowledge/agent/knowledge/agentworld/...
agentworld://knowledge/user/memories/agentworld/...
```

语义如下：

- `agentworld://knowledge/resources/agentworld/...`：项目、仓库、规范、接口、历史报告等相对客观资源。
- `agentworld://knowledge/agent/knowledge/agentworld/...`：Agent 可加载知识，包括检查方法、输出规范、领域提示和示例。
- `agentworld://knowledge/user/memories/agentworld/...`：人工反馈、偏好、误报判断、风险接受记录和团队经验。

平台不得将 Secret 明文写入任何记忆空间。

## 4. Knowledge Space 与绑定

AgentWorld 在 AgentWorld 知识引擎 URI 之上增加平台级 Knowledge Space：

- `global`：全局知识，默认只读加载。
- `team`：业务团队知识，归属于某个业务团队。
- `project`：项目知识，绑定项目 key、仓库或服务。
- `agent_team`：AgentTeam 的可加载知识、方法论和输出约束。

Knowledge Space 保存稳定 `agentworld://knowledge/` 根 URI，Knowledge Binding 将空间授权给业务团队、项目、AgentTeam、任务蓝图或 Agent 定义。绑定声明 `read`、`write`、`archive` 三类访问级别和加载顺序。

任务实例化时，平台生成 Knowledge Context：

1. 解析业务团队可见的全局 / 团队空间。
2. 按输入项目、仓库或 `project_key` 加载项目空间。
3. 按 AgentTeam 加载团队编排专属知识空间。
4. 合并 TaskBlueprint `memoryPolicy` 和 Environment `memoryLayerRefs`。
5. 写入 Environment Snapshot，并在任务事件中记录 `memory.context_resolved`。

## 5. 记忆层级

建议采用以下层级：

- L0 Task Context：单次 TaskRun 的输入、节点输出、Artifact 和事件摘要，生命周期较短。
- L1 Team Resources：业务团队、仓库、项目和服务相关资源。
- L2 Global Knowledge：跨团队复用的知识、规则、检查清单和最佳实践。
- L3 User Feedback：人工判断、误报、修复反馈、接受风险和解释改进记录。

TaskBlueprint 可以声明读取层级，ProviderAdapter 在调用前通过记忆服务获取内容摘要或原文引用。

## 6. Agent 可加载知识模型

Agent 可加载知识是可版本化能力单元：

```yaml
apiVersion: agentworld.io/v1
kind: Knowledge
metadata:
  id: knowledge-code-inspection-security
  name: 代码安全检视知识
  version: 1.0.0
spec:
  uri: agentworld://knowledge/agent/knowledge/agentworld/code-inspection/security
  domain: code-inspection
  inputContractRef: schema-code-inspection-input
  outputContractRef: schema-finding-list
  promptSections:
    - objective
    - method
    - evidence-policy
  findingTaxonomyRefs:
    - code-inspection-security
  examplesRef:
    uri: agentworld://knowledge/resources/agentworld/code-inspection/examples/security
```

Agent 可加载知识必须声明输入输出契约、适用领域、Finding 分类和版本。知识内容存储在 AgentWorld 知识引擎，平台注册表保存索引和权限元数据。

## 7. TaskBlueprint 记忆声明

```yaml
memory:
  readScopes:
    - agentworld://knowledge/resources/agentworld/code-inspection/repositories
    - agentworld://knowledge/agent/knowledge/agentworld/code-inspection/security
  writeScopes:
    - agentworld://knowledge/user/memories/agentworld/code-inspection/feedback
  knowledgeRefs:
    - knowledge-code-inspection-security@1.0.0
  retrieval:
    mode: scoped-summary
    maxItems: 12
    includeCitations: true
```

读取范围必须显式声明。写入范围必须经过权限评估。知识引用应绑定版本，避免历史 TaskRun 因知识更新而语义漂移。

## 8. 读写流程

读取流程：

1. 调度器校验 Blueprint 的 URI 范围和权限。
2. 调用层根据节点角色和知识引用生成 retrieval request。
3. AgentWorld 知识引擎 返回摘要、引用或结构化片段。
4. ProviderAdapter 将允许的内容注入调用上下文。
5. 事件流记录 memory.read 事件和引用，不记录敏感原文。

写入流程：

1. 节点生成总结、Finding、Artifact 或反馈。
2. 平台评估 memory.write 权限。
3. allow 时写入 AgentWorld 知识引擎；ask 时等待人工确认；deny 时拒绝写入。
4. 远端失败时按可靠性策略写入本地影子索引并标记 degraded。
5. 事件流记录 memory.write、memory.sync 或 memory.degraded。

## 9. Finding 与反馈写回

Finding 处理结果应写入用户记忆空间：

```text
agentworld://knowledge/user/memories/agentworld/code-inspection/feedback/correct
agentworld://knowledge/user/memories/agentworld/code-inspection/feedback/incorrect
agentworld://knowledge/user/memories/agentworld/code-inspection/feedback/unclear
agentworld://knowledge/user/memories/agentworld/code-inspection/feedback/accepted-risk
```

写回内容应包含 Finding 引用、人工判断、证据摘要、适用范围、时间和处理人引用。不得写入未脱敏 Secret、私钥或访问令牌。

## 10. 权限与隔离

记忆权限同样采用 allow / ask / deny：

- `memory.read`：读取指定 URI 范围。
- `memory.write`：写入指定 URI 范围。
- `knowledge.use`：使用指定知识。
- `knowledge.update`：更新知识内容或版本。

历史权限名 `skill.use`、`skill.update` 可作为兼容别名迁移到 `knowledge.use`、`knowledge.update`，新配置不得再使用旧名。

业务团队私有记忆默认只允许本团队读取。跨团队读取必须通过服务目录、访问授权或显式 TaskBlueprint 配置完成。

## 11. 降级策略

AgentWorld 知识引擎 远端不可用时：

- 读取失败不得伪造记忆内容。
- 可按 Blueprint 策略继续无记忆执行、等待人工处理或失败。
- 写入可以落到本地影子索引，并记录 `remote_pending` 或 `remote_failed`。
- 恢复后由同步任务重试，成功时记录 `remote_synced`。

降级状态必须进入 TaskRun 可靠性状态机和看板。

## 12. 完成条件

- 所有记忆地址使用 `agentworld://knowledge/` URI。
- TaskBlueprint 可声明读写范围和知识引用。
- 调用层能将记忆读取结果与具体节点、事件和输出关联。
- Finding 和人工反馈可写回用户记忆空间。
- AgentWorld 知识引擎 不可用时，平台能显式进入 degraded，而不是静默丢失记忆。
