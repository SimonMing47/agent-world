export type ArchitectureLayer = {
  id: string;
  name: string;
  objective: string;
  backend: string[];
  frontend: string[];
  capabilities: string[];
  extensibility: string[];
};

export type ArchitectureCase = {
  id: string;
  name: string;
  trigger: "webhook" | "scheduled" | "manual";
  steps: string[];
  output: string[];
};

export function getArchitectureLayers(): ArchitectureLayer[] {
  return [
    { id: "provider", name: "Provider 执行层", objective: "统一封装模型与 CLI Agent 引擎执行", backend: ["src/server/provider-core.ts", "src/server/runtime-core.ts", "src/server/opencode-adapter.ts", "src/app/api/runtimes/discover/route.ts"], frontend: ["src/app/runtimes/page.tsx"], capabilities: ["默认支持 opencode SDK", "可发现运行时并形成 Provider 选择理由", "执行前支持策略检查与降级路线"], extensibility: ["通过 adapter 新增 CLI/SDK Provider", "新增 Provider 不改任务主流程"] },
    { id: "agent", name: "Agent 定义层", objective: "定义 Agent 角色、权限、工具集与归属关系", backend: ["src/server/registry-core.ts", "src/server/tenant-core.ts", "src/server/db.ts"], frontend: ["src/app/agent-teams/page.tsx", "src/app/kingdoms/page.tsx"], capabilities: ["团队 Captain + 成员 Agent 模型", "可关联默认 Harness 与权限边界"], extensibility: ["后续可扩展 Agent 版本管理与发布审批"] },
    { id: "tool-skill", name: "工具 / Skill 管理层", objective: "统一管理工具与 skill 使用策略", backend: ["src/server/harness-core.ts", "src/server/openviking-core.ts", "src/app/api/knowledge/read/route.ts"], frontend: ["src/app/harness/page.tsx", "src/app/knowledge/page.tsx"], capabilities: ["工具 allow/deny 策略", "Skill 读写与记忆联动"], extensibility: ["IM/邮件/代码仓以插件能力注册", "与 Harness 权限模型对齐"] },
    { id: "orchestration", name: "多 Agent 编排层", objective: "组织 Leader 与协作 Agent 的执行拓扑", backend: ["src/server/planner-core.ts", "src/server/executor-core.ts", "src/server/invocation-core.ts"], frontend: ["src/app/quests/[id]/page.tsx", "src/components/quest-ops-console.tsx"], capabilities: ["Quest 规划、节点依赖、重试", "执行图、成本与策略命中追踪"], extensibility: ["支持由线性流程扩展到 DAG 协作拓扑"] },
    { id: "team-execution", name: "Agent 团队任务执行层", objective: "承接任务并提供全量执行空间可观测性", backend: ["src/server/trace-core.ts", "src/app/api/quests/[id]/execution-board/route.ts", "src/app/api/interventions/[id]/resolve/route.ts"], frontend: ["src/app/quests/page.tsx", "src/components/trace-group.tsx"], capabilities: ["执行时间线", "人工干预与恢复", "工具调用与结果记录"], extensibility: ["可扩展 thinking 摘要、tool raw logs 分级展示"] },
    { id: "biz-team", name: "业务团队管理层", objective: "多团队分权与可见性治理", backend: ["src/server/tenant-core.ts", "src/server/contract-core.ts"], frontend: ["src/app/worlds/page.tsx", "src/app/contracts/page.tsx"], capabilities: ["World/Kingdom 多层隔离", "跨团队合约授权"], extensibility: ["可扩展创建者/编辑者/使用者 ACL 细粒度策略"] },
    { id: "task-board", name: "任务执行展示层", objective: "按团队与任务类型统一展示执行状态", backend: ["src/server/queries.ts", "src/server/scheduler-core.ts", "src/app/api/quests/[id]/costs/route.ts"], frontend: ["src/app/page.tsx", "src/app/wallboard/page.tsx"], capabilities: ["总览指标", "优先级看板", "定时调度到点诊断"], extensibility: ["可扩展按任务类别和团队维度钻取分析"] },
    { id: "environment", name: "环境层", objective: "管理仓库、执行人、凭据与执行路径", backend: ["src/server/db.ts", "src/server/runtime-core.ts", "src/app/api/webhooks/[pathKey]/route.ts"], frontend: ["src/app/settings/page.tsx", "src/app/runtimes/page.tsx"], capabilities: ["仓库与开发者配置", "Webhook 入口与路径映射"], extensibility: ["预留沙箱、执行容器与多环境模板"] },
    { id: "memory", name: "记忆层", objective: "基于 OpenViking 的分域分层记忆服务", backend: ["src/server/openviking-core.ts", "src/app/api/knowledge/layers/route.ts", "src/app/api/knowledge/sync/route.ts"], frontend: ["src/app/knowledge/page.tsx"], capabilities: ["知识层读取与同步", "反馈回流", "skill 记忆挂载"], extensibility: ["可扩展跨团队记忆共享策略与生命周期归档"] },
  ];
}

export function getArchitectureCases(): ArchitectureCase[] {
  return [
    { id: "shield", name: "神盾计划：MR webhook 代码检视", trigger: "webhook", steps: ["配置全局 webhook 任务模板", "接收 MR diff 并映射至检视 Agent 团队", "按 skill 分层执行：安全/架构/风格/性能", "汇总评论并回写到 MR", "在看板实时展示进度、成本、策略命中"], output: ["MR 评论", "任务执行轨迹", "记忆层沉淀"] },
    { id: "security-daily", name: "安全检视：每日定时全量扫描", trigger: "scheduled", steps: ["配置每日定时任务", "按仓库集合与执行人拉取代码", "并行运行安全检视流程", "汇总风险并生成团队报告", "通过邮件插件发送日报"], output: ["团队风险报告", "邮件通知", "安全记忆沉淀"] },
  ];
}
