# 环境与 Secret 规格

## 1. 定位

Environment Template 描述任务可运行所需的代码仓、分支、执行人、工作目录、Secret 引用、网络边界、文件边界、Provider 环境变量和记忆依赖。Environment Snapshot 是 TaskRun 实例化时生成的不可变运行环境快照。

环境层连接 Agent 调度与 Agent 调用：调度层负责选择和固化 Environment Snapshot；调用层只能使用该 Snapshot 中授权的资源。

## 2. 设计目标

- 通过 Environment Template 复用环境配置。
- 通过 Environment Snapshot 保证每次 TaskRun 可回放、可审计。
- Secret 只以引用形式出现在配置、快照和事件中。
- 明确 allow / ask / deny 对环境动作、Secret 使用和文件访问的约束。
- 为未来沙箱、远端执行器和多仓任务保留扩展空间。

## 3. Environment Template

```yaml
apiVersion: agentworld.io/v1
kind: EnvironmentTemplate
metadata:
  id: env-template-merge-request-check
  name: 合并请求检视环境
  version: 1.0.0
spec:
  repositories:
    - id: target-repo
      provider: builtin.repo.git
      urlRef: repo-url-ref
      defaultBranch: main
      checkout:
        mode: merge-request
  actor:
    type: service-account
    ref: svc-code-inspection
  workdir:
    mode: per-run
    basePathRef: workspace-root
  secrets:
    - ref: secret.git.readonly
      purpose: repo.read
    - ref: secret.git.comment
      purpose: repo.comment.write
  network:
    outbound:
      default: deny
      allowDomains: []
  filesystem:
    read:
      - workspace
    write:
      - artifacts
  memoryDependencies:
    - viking://resources/agentworld/code-inspection/repositories
  sandbox:
    mode: reserved
```

Template 可以由插件贡献，但必须由平台校验后才能被 TaskBlueprint 引用。

## 4. Environment Snapshot

Environment Snapshot 在 TaskRun 创建时生成：

```yaml
id: envsnap_001
taskRunId: run_001
templateId: env-template-merge-request-check
templateVersion: 1.0.0
resolved:
  repositories:
    - id: target-repo
      commit: abc123
      branch: feature/example
      diffRef: mr_123
  workdir:
    pathRef: workspace/run_001
  secrets:
    - ref: secret.git.readonly
      purpose: repo.read
      resolvedAt: 2026-05-16T00:00:00Z
  memoryDependencies:
    - viking://resources/agentworld/code-inspection/repositories
status: ready
```

Snapshot 不保存 Secret 明文。`pathRef` 可以指向平台内部工作区标识，不要求暴露宿主机绝对路径给插件。

## 5. Secret 模型

Secret 标准字段：

- `id`：Secret 引用 ID。
- `type`：token、private_key、password、api_key、certificate、oauth。
- `ownerTeamId`：归属业务团队。
- `purpose`：用途，如 repo.read、repo.comment.write、provider.invoke。
- `rotationPolicy`：轮换策略。
- `status`：active、rotating、disabled、expired。
- `lastUsedAt`：最近使用时间。

Secret 值只由 Secret Store 持有。ProviderAdapter 和插件通过受控句柄使用 Secret，不能把 Secret 明文写入事件、日志、Artifact、Finding 或 OpenViking。

## 6. 权限规则

环境和 Secret 权限采用 allow / ask / deny：

- `repo.read`：读取仓库内容或 diff。
- `repo.write`：推送代码或创建分支。
- `repo.comment.write`：写入代码平台评论。
- `secret.use`：使用 Secret 引用。
- `filesystem.read`：读取工作区文件。
- `filesystem.write`：写入工作区、Artifact 或补丁。
- `network.outbound`：访问外部网络。

权限评估顺序：

1. 租户空间策略。
2. 业务团队策略。
3. 插件 manifest 请求。
4. TaskBlueprint 权限。
5. Environment Template 限制。
6. Runtime 动作上下文。

后续策略只能收紧，不能放宽前序策略的 deny。

## 7. 预检流程

TaskRun 进入 ready 前必须完成环境预检：

1. 校验 Template 状态和版本。
2. 解析仓库、分支、提交、MR 或资源集合。
3. 校验 Secret 引用存在且状态可用。
4. 校验工作目录配额和清理策略。
5. 校验网络、文件和沙箱策略。
6. 校验记忆依赖 URI 可访问或具备降级策略。
7. 生成 Environment Snapshot。

预检失败时 TaskRun 进入 waiting_environment 或 failed，具体由 Blueprint 可靠性策略决定。

## 8. 环境状态机

Environment Template 状态：

```text
draft -> validated -> active -> deprecated -> archived
```

Environment Snapshot 状态：

```text
creating -> ready -> in_use -> cleanup_pending -> cleaned
creating -> invalid
in_use -> degraded
```

`invalid` 表示快照无法用于调用。`degraded` 表示环境可用但存在受控缺陷，例如某个非关键记忆依赖不可用。

## 9. 配置样例

### 9.1 MR 检视环境

```yaml
metadata:
  id: env-template-merge-request-check
spec:
  repositories:
    - id: target-repo
      checkout:
        mode: merge-request
  secrets:
    - ref: secret.repo.readonly
      purpose: repo.read
    - ref: secret.repo.comment
      purpose: repo.comment.write
  filesystem:
    read: [workspace]
    write: [artifacts]
```

### 9.2 每日仓库集合扫描环境

```yaml
metadata:
  id: env-template-repository-collection
spec:
  repositories:
    - id: repository-set
      checkout:
        mode: branch-list
        branches: [main]
  secrets:
    - ref: secret.repo.readonly
      purpose: repo.read
  filesystem:
    read: [workspace]
    write: [artifacts, reports]
```

以上均为配置样例，不构成平台硬编码业务系统。

## 10. 完成条件

- TaskRun 必须引用 Environment Snapshot，而不是只引用可变 Template。
- Secret 明文不得进入 Blueprint、Snapshot、事件、日志、Artifact、Finding 或记忆。
- 调用层所有文件、网络和 Secret 动作都经过 allow / ask / deny。
- 环境预检结果可见于事件流和看板。
- Snapshot 能支撑历史任务回放和审计。
