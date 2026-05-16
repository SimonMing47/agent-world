# AgentWorld 系统详细设计（全量）

## 1. 分层详细设计

### 1.1 Provider 执行层
- 统一 Provider 选择：根据 world/kingdom/agent/runtime 计算最优执行路径。
- 默认实现：opencode SDK。
- 扩展实现：可插入 claude code/openclaw 类 CLI Provider。
- 失败策略：主 Provider 失败时可降级到备用 Provider。

### 1.2 Agent 定义层
- Agent 基本属性：角色、能力、权限、工具集、所属团队。
- 团队属性：Leader（Captain）+ 协作成员。
- 版本策略：后续扩展 Agent 版本与灰度发布。

### 1.3 工具/Skill 管理层
- 工具策略：allow/deny + 参数约束 + 审计记录。
- Skill 来源：内置 + 记忆层动态读取。
- 插件机制：工具以声明方式注册，不改主流程。

### 1.4 多 Agent 编排层
- 任务规划：将任务拆分为可执行节点。
- 节点依赖：支持 DAG 依赖与并行执行。
- 交互模型：Leader 负责任务分配与结果汇总。

### 1.5 Agent 团队任务执行层
- 任务空间：对话、tool use、tool result、thinking summary。
- 干预机制：人工审批、暂停、恢复、节点重试。
- 追踪机制：完整事件流归档。

### 1.6 业务团队管理层
- 多租治理：World/Kingdom 边界。
- 可见性：个人可见 / 团队可见 / 全局可见。
- 权限角色：创建者、编辑者、使用者。

### 1.7 任务执行展示层
- 展示维度：按团队、按类型、按状态、按成本。
- 类型覆盖：一次性、定时、Webhook。
- 看板能力：实时状态、吞吐、成功率、成本曲线。

### 1.8 环境层
- 环境对象：代码仓、执行路径、执行人、私钥。
- 调度绑定：任务模板选择环境。
- 未来扩展：沙箱模板、容器镜像、隔离级别。

### 1.9 记忆层
- 技术底座：OpenViking。
- 分层分域：全局/团队/任务记忆。
- 对外接口：供 Agent 与 CLI 读取和写入。

## 2. 数据与接口映射（当前仓库）

- 调度与任务：`scheduler-core.ts`、`executor-core.ts`、`planner-core.ts`
- 调用与追踪：`invocation-core.ts`、`trace-core.ts`
- 团队与治理：`tenant-core.ts`、`contract-core.ts`
- Provider 与运行时：`provider-core.ts`、`runtime-core.ts`、`opencode-adapter.ts`
- 记忆：`openviking-core.ts` + `api/knowledge/*`
- Webhook/MR 检视：`api/webhooks/[pathKey]/route.ts`、`code-review-core.ts`

## 3. 增量实现策略

1. 先保证九层映射完整可见（文档 + 页面 + API）。
2. 再按插件协议补齐外部系统接入（IM/邮件/代码仓）。
3. 最后强化运维能力（告警、审计、回放、容量策略）。

## 4. 覆盖性对照清单

- [x] 九层系统定位
- [x] 前后端分层排布
- [x] Provider 默认 + 扩展方向
- [x] Agent 定义与多 Agent 团队
- [x] 工具/skill 与权限策略
- [x] 执行空间与全过程记录
- [x] 团队分权与可见性
- [x] 任务看板与多类型任务
- [x] 环境配置与未来沙箱
- [x] 记忆层设计与 OpenViking 对接
- [x] 神盾计划案例
- [x] 每日安全检视案例
