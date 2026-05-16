export type ArchitectureLayer = {
  id: string;
  name: string;
  objective: string;
  backend: string[];
  frontend: string[];
  apiSurfaces: string[];
  capabilities: string[];
  extensibility: string[];
  designCheckpoints: string[];
};

export type ArchitectureCase = {
  id: string;
  name: string;
  trigger: "webhook" | "scheduled" | "manual";
  steps: string[];
  configuration: string[];
  plugins: string[];
  memoryLayers: string[];
  output: string[];
};

export function getArchitectureLayers(): ArchitectureLayer[] {
  return [
    {
      id: "provider",
      name: "Provider 执行层",
      objective: "统一封装模型、OpenCode SDK 与 CLI Agent 引擎执行。",
      backend: ["provider-core.ts", "runtime-core.ts", "opencode-adapter.ts"],
      frontend: ["runtimes/page.tsx", "settings/page.tsx"],
      apiSurfaces: ["/api/runtimes/discover", "/api/plugins/manifests"],
      capabilities: ["默认支持 opencode SDK", "支持 Provider 选择理由", "支持 CLI Provider 插件化挂载"],
      extensibility: ["claude code/openclaw 通过 provider-runtime 扩展点接入", "主干只依赖 Provider 清单与健康状态"],
      designCheckpoints: ["执行前必须经过 World/Kingdom/Agent 模型白名单", "API Key 只保存 secret ref"],
    },
    {
      id: "agent",
      name: "Agent 定义层",
      objective: "定义 Agent 的角色、权限、工具集、提示词、记忆范围与团队归属。",
      backend: ["registry-core.ts", "tenant-core.ts", "db.ts"],
      frontend: ["agent-teams/page.tsx", "kingdoms/page.tsx"],
      apiSurfaces: ["/api/quests/submit"],
      capabilities: ["Leader/Captain 与成员 Agent", "在线展示角色、工具集、模型与记忆范围", "团队可见性治理"],
      extensibility: ["后续可增加 Agent 版本、灰度发布与审批流"],
      designCheckpoints: ["Agent 不能绕过所属团队 Harness", "AgentTeam 必须绑定业务团队边界"],
    },
    {
      id: "tool-skill",
      name: "工具 / Skill 管理层",
      objective: "统一管理工具、skill、权限和审计，并把 skill 连接到 OpenViking 记忆。",
      backend: ["harness-core.ts", "plugin-core.ts", "openviking-core.ts"],
      frontend: ["harness/page.tsx", "knowledge/page.tsx", "settings/page.tsx"],
      apiSurfaces: ["/api/knowledge/read", "/api/knowledge/skills", "/api/plugins/manifests"],
      capabilities: ["工具 allow/deny/approval", "Skill Registry", "IM/邮件/代码仓插件声明"],
      extensibility: ["工具实现独立挂载，主干只消费权限声明和审计事件"],
      designCheckpoints: ["权限与 Claude Code/Harness 模型对齐", "新增工具不能修改任务主流程"],
    },
    {
      id: "orchestration",
      name: "多 Agent 编排层",
      objective: "组织 Leader 与协作 Agent 的依赖关系、交互提示词和团队目标。",
      backend: ["planner-core.ts", "executor-core.ts", "invocation-core.ts", "extension-core.ts"],
      frontend: ["quests/[id]/page.tsx", "quest-ops-console.tsx"],
      apiSurfaces: ["/api/quests/[id]/tick", "/api/quests/[id]/nodes/[nodeId]/retry"],
      capabilities: ["规则计划与 DAG 计划", "任务模板导入", "节点依赖解锁", "失败节点独立重试"],
      extensibility: ["可从线性流程扩展到 Captain 生成 DAG"],
      designCheckpoints: ["节点执行必须记录 trace/event", "跨团队调用必须先过 Contract"],
    },
    {
      id: "team-execution",
      name: "Agent 团队任务执行层",
      objective: "承接团队任务，提供任务空间和全过程执行记录。",
      backend: ["trace-core.ts", "queries.ts", "code-review-core.ts"],
      frontend: ["quests/page.tsx", "quests/[id]/page.tsx", "trace-group.tsx"],
      apiSurfaces: ["/api/quests/[id]/execution-board", "/api/interventions/[id]/resolve"],
      capabilities: ["对话、thinking、tool use、tool result 全展开", "人工干预", "成本与策略命中"],
      extensibility: ["后续可加入原始 tool log 分级权限和回放"],
      designCheckpoints: ["任务空间不能只展示结论", "审批、失败、重试都要进入事件流"],
    },
    {
      id: "biz-team",
      name: "业务团队管理层",
      objective: "用 World/Kingdom 支撑多团队分权、多可见性和跨团队服务调用。",
      backend: ["tenant-core.ts", "contract-core.ts", "registry-core.ts"],
      frontend: ["worlds/page.tsx", "kingdoms/page.tsx", "contracts/page.tsx"],
      apiSurfaces: ["/api/quests/submit"],
      capabilities: ["World/Kingdom 隔离", "创建者/编辑者/使用者预留", "个人/团队/全局可见性"],
      extensibility: ["可扩展 ACL 表、审批链和组织目录同步"],
      designCheckpoints: ["任务全局可见但权限动作受控", "跨 Kingdom 调用走 Contract"],
    },
    {
      id: "task-board",
      name: "任务执行展示层",
      objective: "按业务团队、任务类别、触发方式和状态组织所有任务执行情况。",
      backend: ["scheduler-core.ts", "environment-core.ts", "queries.ts"],
      frontend: ["page.tsx", "quests/page.tsx", "wallboard/page.tsx"],
      apiSurfaces: ["/api/quests/[id]/costs", "/api/quests/[id]/policy-hits"],
      capabilities: ["一次性/定时/Webhook/合约任务统计", "团队看板", "优先级与成本展示"],
      extensibility: ["后续可接 WebSocket/SSE 实时刷新和容量预测"],
      designCheckpoints: ["任务展示必须全局可见", "看板要能按团队与类别钻取"],
    },
    {
      id: "environment",
      name: "环境层",
      objective: "管理执行对象、代码仓、执行人、私钥引用、执行路径和未来沙箱。",
      backend: ["environment-core.ts", "extension-core.ts", "db.ts", "api/webhooks/[pathKey]/route.ts"],
      frontend: ["settings/page.tsx", "runtimes/page.tsx"],
      apiSurfaces: ["/api/webhooks/[pathKey]", "/api/runtimes/discover", "/api/plugins/manifests", "/api/environments"],
      capabilities: ["代码仓环境配置", "执行人和 PRIVATE_KEY 引用", "环境模板导入", "沙箱配置预留"],
      extensibility: ["后续可挂载容器、远程沙箱和多代码平台插件"],
      designCheckpoints: ["主干不保存私钥明文", "任务配置必须能引用环境和记忆层"],
    },
    {
      id: "memory",
      name: "记忆层",
      objective: "基于 OpenViking 做分层、分域、分团队的记忆和 skill 访问。",
      backend: ["openviking-core.ts", "api/knowledge/layers", "api/knowledge/read"],
      frontend: ["knowledge/page.tsx"],
      apiSurfaces: ["/api/knowledge/read", "/api/knowledge/layers", "/api/knowledge/skills"],
      capabilities: ["L0/L1/L2 读取", "反馈回流", "Skill 记忆挂载"],
      extensibility: ["可扩展团队共享策略、归档策略和 CLI 访问策略"],
      designCheckpoints: ["人工反馈要进入记忆层", "OpenViking 不可用时保留本地影子索引"],
    },
  ];
}

export function getArchitectureCases(): ArchitectureCase[] {
  return [
    {
      id: "shield",
      name: "神盾计划：MR webhook 代码检视",
      trigger: "webhook",
      steps: ["Webhook 接收 MR diff", "生成可观测 Quest", "检视 Agent 团队按 skill 分层检查", "汇总评论并回写 MR", "反馈写回 OpenViking"],
      configuration: ["任务模板 task-template-shield-mr-review", "触发模板 template-shield-mr-review", "环境 env-shield-mr-review", "团队 PR Vanguard"],
      plugins: ["builtin.repo.git", "builtin.provider.opencode"],
      memoryLayers: ["repository/code-review", "global/code-review", "security", "quality/test", "contract/data-api"],
      output: ["MR 评论", "任务执行轨迹", "检视 finding", "记忆层沉淀"],
    },
    {
      id: "security-daily",
      name: "安全检视：每日定时全量扫描",
      trigger: "scheduled",
      steps: ["每日调度任务模板", "按仓库集合和执行人拉取代码", "运行安全检视 skill", "生成风险报告", "邮件插件发送日报"],
      configuration: ["任务模板 task-template-daily-security-review", "调度模板 template-daily-security-review", "环境 env-daily-security-scan", "通知插件 builtin.notify.email"],
      plugins: ["builtin.repo.git", "builtin.notify.email", "builtin.provider.opencode"],
      memoryLayers: ["security", "feedback/correct", "feedback/incorrect"],
      output: ["团队风险报告", "邮件通知", "长期安全记忆"],
    },
  ];
}
