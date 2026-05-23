# Case Blueprint 规格

## 1. 定位

Case Blueprint 是面向业务场景的配置包。它将 Task Blueprint、Environment Template、插件依赖、Skill、记忆 URI、看板视图、报告模板和权限策略组合为可导入、可试运行、可发布的场景配置。

Case Blueprint 不等同于平台硬编码模块。平台不应在主干中判断“神盾计划”或“每日全量安全检视”并执行特殊逻辑；这些名称只能作为配置包 metadata、展示名称或样例出现。

## 2. 设计目标

- 用配置方式表达完整任务场景。
- 降低部署方接入代码平台、通知渠道、Provider 和记忆空间的成本。
- 让案例可复制到不同业务团队并覆盖环境、权限和 Secret 引用。
- 保证案例导入后仍遵守统一 Task Blueprint、ProviderAdapter、插件、环境、记忆和事件规格。
- 使案例可在 dev、staging、prod 间提升，并保留版本审计。

## 3. Case Blueprint 模型

```yaml
apiVersion: agentworld.io/v1
kind: CaseBlueprint
metadata:
  id: case-code-inspection-shield
  name: 神盾计划 MR 检视样例
  version: 1.0.0
  ownerTeamId: team-platform
spec:
  dependencies:
    plugins:
      - enterprise.repo.git@1.x
      - builtin.notify.email@1.x
    providerAdapters:
      - agentworld-runtime-adapter
    skills:
      - skill-code-inspection-security@1.0.0
  imports:
    taskBlueprints:
      - task-template-shield-mr-check
    environmentTemplates:
      - env-template-merge-request-check
    scheduleTemplates: []
    boardViews:
      - board-code-inspection-findings
  defaults:
    permissions:
      default: ask
    memory:
      readScopes: []
      writeScopes: []
  promotion:
    stages: [dev, staging, prod]
```

Case Blueprint 导入后生成或更新标准对象。运行时仍由 TaskBlueprint 驱动。

## 4. 导入流程

1. 校验 Case Blueprint schema。
2. 校验插件、ProviderAdapter、Skill 和版本依赖。
3. 校验 TaskBlueprint、Environment Template、Schedule Template 和 Board View。
4. 检查权限默认值，不允许未声明的敏感能力。
5. 绑定业务团队、Secret 引用和环境覆盖项。
6. 生成 validated 状态的配置对象。
7. 执行 dry-run，创建非生产 TaskRun。
8. 人工确认后发布为 active。

导入流程必须可重复执行。重复导入同版本不得创建冲突对象。

## 5. 案例与统一 Task Blueprint 的关系

Case Blueprint 只能组织配置，不能绕过 Task Blueprint：

- 触发入口由 TaskBlueprint 声明。
- Agent 团队由 TaskBlueprint 引用。
- Provider 选择由 TaskBlueprint 和 ProviderAdapter 规格处理。
- 环境由 Environment Template/Snapshot 处理。
- 权限由 allow / ask / deny 统一决策。
- 记忆读写由 OpenViking URI 范围约束。
- 事件、Finding 和看板由任务事件规格约束。

## 6. 样例一：MR 检视配置包

该样例可以使用“神盾计划”作为展示名称，但不得成为平台特殊分支。

```yaml
metadata:
  id: case-code-inspection-shield
  name: 神盾计划 MR 检视样例
spec:
  dependencies:
    plugins:
      - enterprise.repo.git@1.x
    providerAdapters:
      - agentworld-runtime-adapter
    skills:
      - skill-code-inspection-security@1.0.0
      - skill-code-inspection-quality-test@1.0.0
      - skill-code-inspection-data-api@1.0.0
  imports:
    taskBlueprints:
      - task-template-shield-mr-check
    environmentTemplates:
      - env-template-merge-request-check
    boardViews:
      - board-code-inspection-findings
  defaults:
    permissions:
      tools:
        repo.diff.read: allow
        repo.comment.write: ask
        repo.write: deny
    memory:
      readScopes:
        - viking://resources/agentworld/code-inspection/repositories
        - viking://agent/skills/agentworld/code-inspection/security
      writeScopes:
        - viking://user/memories/agentworld/code-inspection/feedback
```

预期输出：

- MR 评论草稿或评论写入请求。
- Finding 列表。
- 任务事件流。
- Artifact 报告。
- 人工反馈写回用户记忆空间。

## 7. 样例二：每日全量安全检视配置包

该样例表达一个定时扫描场景，不代表平台内置定时任务。

```yaml
metadata:
  id: case-daily-security-scan
  name: 每日全量安全检视样例
spec:
  dependencies:
    plugins:
      - enterprise.repo.git@1.x
      - builtin.notify.email@1.x
    providerAdapters:
      - agentworld-runtime-adapter
    skills:
      - skill-code-inspection-security@1.0.0
  imports:
    taskBlueprints:
      - task-template-daily-security-scan
    environmentTemplates:
      - env-template-repository-collection
    scheduleTemplates:
      - schedule-daily-security-scan
    boardViews:
      - board-security-inspection-daily
  defaults:
    permissions:
      tools:
        repo.read: allow
        notify.email.send: ask
        repo.write: deny
    memory:
      readScopes:
        - viking://agent/skills/agentworld/code-inspection/security
        - viking://user/memories/agentworld/code-inspection/feedback
      writeScopes:
        - viking://resources/agentworld/code-inspection/global
```

预期输出：

- 每日风险报告。
- Finding 聚合看板。
- 邮件摘要发送请求。
- 长期安全经验写回。

## 8. 覆盖与参数化

部署方可以覆盖：

- 业务团队 ID。
- 仓库集合。
- 分支或 MR 来源。
- ProviderAdapter 和模型约束。
- Secret 引用。
- 通知渠道。
- 记忆 URI 前缀。
- 权限策略。
- 看板过滤器。

覆盖必须生成新的配置版本或环境覆盖记录，不能直接修改已运行 TaskRun 的历史快照。

## 9. 发布与回滚

Case Blueprint 发布状态：

```text
draft -> validated -> dry_run_passed -> active -> deprecated -> archived
```

回滚要求：

- 可回滚到上一 active 版本。
- 回滚不删除历史 TaskRun。
- 回滚后新 TaskRun 使用旧版本配置。
- 已运行任务继续按原版本解释。

## 10. 完成条件

- 案例包导入后只产生标准 TaskBlueprint、Environment Template、插件依赖、Skill、看板和权限配置。
- 平台主干不包含针对案例名称的条件分支。
- 两个样例均可作为配置导入、试运行和发布。
- 案例输出统一使用 Finding、Artifact、事件流和 OpenViking 记忆写回。
- 覆盖、发布和回滚过程可审计。
