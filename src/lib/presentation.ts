const labels = {
  status: {
    active: "启用中",
    approved: "已批准",
    archived: "已归档",
    awaiting: "等待人工",
    blocked: "被阻断",
    cancelled: "已取消",
    completed: "已完成",
    created: "已创建",
    degraded: "已降级",
    disabled: "已停用",
    draft: "草稿",
    event_only: "仅事件触发",
    failed: "失败",
    healthy: "健康",
    offline: "离线",
    paused: "已暂停",
    pending: "待处理",
    planning: "规划中",
    partially_succeeded: "部分成功",
    preparing_environment: "准备环境",
    publishing_output: "发布结果",
    queued: "排队中",
    ready: "就绪",
    rejected: "已拒绝",
    retrying: "重试中",
    running: "运行中",
    scheduled: "已排程",
    submitted: "已提交",
    succeeded: "成功",
    suspended: "已暂停",
    validating: "校验中",
    waiting_approval: "等待审批",
  },
  visibility: {
    global: "全局可见",
    private: "私有",
    public: "公开",
    personal: "个人可见",
    team: "团队可见",
  },
  workflow: {
    dag: "DAG",
    parallel: "并行",
    sequential: "串行",
    single: "单节点",
  },
  recruitmentMode: {
    copy: "复制实例",
    dedicated: "专属托管",
    subscribe: "订阅共享",
  },
  scheduleState: {
    due: "到点可执行",
    event_only: "仅事件触发",
    paused: "已暂停",
    scheduled: "已排程",
  },
  executionPolicyScope: {
    AgentTeam: "Agent 团队级",
    Global: "全局级",
    BusinessTeam: "业务团队级",
    TenantSpace: "租户级",
  },
  sourceType: {
    access_grant: "跨团队授权调用",
    manual: "手动提交",
    schedule: "定时触发",
    webhook: "Webhook 触发",
  },
  runtimeKind: {
    "claude-code": "Claude Code",
    openclaw: "OpenClaw",
    opencode: "OpenCode",
  },
  foldGroup: {
    Analysis: "分析思考",
    "Human Actions": "人工操作",
    Planning: "规划阶段",
    "Research Scan": "研究扫描",
    "Review Summary": "评审摘要",
    "Signal Collection": "信号采集",
    Synthesis: "结果综合",
  },
} as const;

const demoCopyMap: Record<string, string> = {
  "Agent governance": "Agent 治理",
  "Approve repository write-back for PR #481": "批准为 PR #481 执行代码仓回写",
  "Assessing owner-facing risk": "评估对负责人可见的风险",
  "Brief delivered": "简报已交付",
  "Collected evidence": "证据已收集",
  "Collect signals first, then synthesize owner-facing incident guidance.":
    "先收集信号，再整理面向负责人的事故处理建议。",
  "Failure Analyst is comparing billing alerts with worker queue lag to explain probable blast radius.":
    "Failure Analyst 正在比对计费告警与 worker 队列积压情况，以判断可能的影响范围。",
  "Market Scout gathered product pages, engineering writeups, and adoption notes for the comparison brief.":
    "Market Scout 已收集产品页、工程文章和采用情况说明，用于生成对比简报。",
  "Planning": "规划阶段",
  "Platform reliability": "平台稳定性",
  "Release automation": "发布自动化",
  "Release Reviewer found no blocking defects and prepared a concise recommendation.":
    "Release Reviewer 未发现阻塞性缺陷，并给出了简明建议。",
  "Review finished": "评审完成",
  "Review the PR, then prepare write-back steps behind a human gate.":
    "先评审 PR，再在人工门禁之后准备回写步骤。",
  "Scanning market evidence": "扫描市场证据",
  "Schedule tick created the task and selected the Incident Observatory team.":
    "调度器时间片已生成任务，并选择 Incident Observatory 团队接手。",
  "Scout the market, then turn raw evidence into a leadership brief.":
    "先扫描市场，再把原始证据整理成管理层简报。",
  "Signal Scout clustered 5 incidents into 2 candidate reliability threads.":
    "Signal Scout 已将 5 个事故聚合成 2 条候选稳定性线索。",
  "Synthesis": "结果综合",
  "Write-back blocked": "回写被阻塞",
  "Webhook task created": "Webhook 任务已创建",
};

function translate(map: Record<string, string>, value: string) {
  return map[value] ?? value;
}

export function translateStatus(value: string) {
  return translate(labels.status, value);
}

export function translateVisibility(value: string) {
  return translate(labels.visibility, value);
}

export function translateWorkflowType(value: string) {
  return translate(labels.workflow, value);
}

export function translateRecruitmentMode(value: string) {
  return translate(labels.recruitmentMode, value);
}

export function translateScheduleState(value: string) {
  return translate(labels.scheduleState, value);
}

export function translateExecutionPolicyScope(value: string) {
  return translate(labels.executionPolicyScope, value);
}

export function translateSourceType(value: string) {
  return translate(labels.sourceType, value);
}

export function translateRuntimeKind(value: string) {
  return translate(labels.runtimeKind, value);
}

export function translateFoldGroup(value: string) {
  return translate(labels.foldGroup, value);
}

export function translateBoolean(value: boolean | number) {
  return value ? "是" : "否";
}

export function localizeDemoCopy(value: string) {
  return demoCopyMap[value] ?? value;
}
