import type { TaskRun } from "@/server/db";

export type TeamActionQueueKind =
  | "blocked_run"
  | "waiting_gate"
  | "high_risk_finding"
  | "overdue_owner"
  | "unassigned_owner"
  | "running_run";

export type TeamActionQueuePriority = "critical" | "high" | "medium" | "low";

export type TeamActionQueueWorkflowProgress = {
  percent: number;
  currentStep: {
    id: string;
    label: string;
    owner: string;
    status: string;
    kind: string;
  } | null;
};

export type TeamActionQueueFinding = {
  id: string;
  taskRunId: string;
  title: string;
  severity: string;
  status: string;
  businessTeamName: string;
  agentTeamName: string;
  blueprintName: string | null;
  createdAt: string;
  assignment?: { assignedTo: string } | null;
  remediation?: { taskRunId: string; createdBy?: string | null; createdAt: string } | null;
};

export type TeamActionQueueOwner = {
  ownerKey: string;
  ownerLabel: string;
  isUnassigned: boolean;
  total: number;
  highRisk: number;
  overdue: number;
  nextDueAt: string | null;
  oldestCreatedAt?: string | null;
  sampleFindings: Array<{
    id: string;
    taskRunId: string;
    title: string;
    severity: string;
    overdue: boolean;
  }>;
};

export type TeamActionQueueItem = {
  id: string;
  kind: TeamActionQueueKind;
  priority: TeamActionQueuePriority;
  score: number;
  href: string;
  titleKey: string;
  titleParams: Record<string, string | number>;
  descriptionKey: string;
  descriptionParams: Record<string, string | number>;
  actionKey: string;
  createdAt: string | null;
  businessTeamName: string | null;
  agentTeamName: string | null;
  taskRunId: string | null;
  findingId: string | null;
  assignment?: { assignedTo: string } | null;
  remediation?: { taskRunId: string; createdBy?: string | null; createdAt: string } | null;
};

function taskName(taskRun: TaskRun) {
  return taskRun.sourceRef ?? taskRun.idempotencyKey ?? taskRun.sourceType;
}

function parseTimestamp(value: string | null | undefined) {
  const parsed = Date.parse(value ?? "");
  return Number.isFinite(parsed) ? parsed : 0;
}

function priorityForScore(score: number): TeamActionQueuePriority {
  if (score >= 90) return "critical";
  if (score >= 70) return "high";
  if (score >= 45) return "medium";
  return "low";
}

function isActiveRun(taskRun: TaskRun, progress?: TeamActionQueueWorkflowProgress) {
  return (
    ["queued", "preparing_environment", "running", "publishing_output"].includes(taskRun.runState) ||
    ["running", "queued"].includes(taskRun.status) ||
    progress?.currentStep?.status === "running"
  );
}

function isWaitingRun(taskRun: TaskRun, progress?: TeamActionQueueWorkflowProgress) {
  return (
    ["awaiting", "waiting_approval", "pending"].includes(taskRun.runState) ||
    ["awaiting", "waiting_approval", "pending"].includes(taskRun.status) ||
    progress?.currentStep?.status === "awaiting"
  );
}

function isBlockedRun(taskRun: TaskRun, progress?: TeamActionQueueWorkflowProgress) {
  return (
    ["failed", "blocked", "rejected"].includes(taskRun.runState) ||
    ["failed", "blocked", "rejected"].includes(taskRun.status) ||
    progress?.currentStep?.status === "failed"
  );
}

function uniqueByTarget(items: TeamActionQueueItem[]) {
  const seen = new Set<string>();
  return items.filter((item) => {
    const target = item.findingId ?? item.taskRunId ?? item.id;
    const key = `${item.kind}:${target}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function buildTeamActionQueue(args: {
  taskRuns: TaskRun[];
  taskRunWorkflowProgress: Record<string, TeamActionQueueWorkflowProgress | undefined>;
  findingTriageQueue: TeamActionQueueFinding[];
  findingOwnerBoard: TeamActionQueueOwner[];
  limit?: number;
}) {
  const items: TeamActionQueueItem[] = [];

  for (const taskRun of args.taskRuns) {
    const progress = args.taskRunWorkflowProgress[taskRun.id];
    const displayName = taskName(taskRun);

    if (isBlockedRun(taskRun, progress)) {
      const score = 100 + taskRun.priority;
      items.push({
        id: `blocked-run:${taskRun.id}`,
        kind: "blocked_run",
        priority: priorityForScore(score),
        score,
        href: `/task-runs/${taskRun.id}`,
        titleKey: "ui.taskRuns.actionQueue.items.blockedRun.title",
        titleParams: { task: displayName },
        descriptionKey: "ui.taskRuns.actionQueue.items.blockedRun.description",
        descriptionParams: {
          state: taskRun.runState,
          step: progress?.currentStep?.label ?? taskRun.status,
        },
        actionKey: "ui.taskRuns.actionQueue.actions.openRun",
        createdAt: taskRun.createdAt,
        businessTeamName: null,
        agentTeamName: null,
        taskRunId: taskRun.id,
        findingId: null,
        assignment: null,
        remediation: null,
      });
      continue;
    }

    if (isWaitingRun(taskRun, progress)) {
      const score = 90 + taskRun.priority;
      items.push({
        id: `waiting-gate:${taskRun.id}`,
        kind: "waiting_gate",
        priority: priorityForScore(score),
        score,
        href: `/task-runs/${taskRun.id}`,
        titleKey: "ui.taskRuns.actionQueue.items.waitingGate.title",
        titleParams: { task: displayName },
        descriptionKey: "ui.taskRuns.actionQueue.items.waitingGate.description",
        descriptionParams: {
          step: progress?.currentStep?.label ?? taskRun.runState,
        },
        actionKey: "ui.taskRuns.actionQueue.actions.resolveGate",
        createdAt: taskRun.createdAt,
        businessTeamName: null,
        agentTeamName: null,
        taskRunId: taskRun.id,
        findingId: null,
        assignment: null,
        remediation: null,
      });
      continue;
    }

    if (isActiveRun(taskRun, progress)) {
      const score = 35 + taskRun.priority + Math.round((progress?.percent ?? 0) / 10);
      items.push({
        id: `running-run:${taskRun.id}`,
        kind: "running_run",
        priority: priorityForScore(score),
        score,
        href: `/task-runs/${taskRun.id}`,
        titleKey: "ui.taskRuns.actionQueue.items.runningRun.title",
        titleParams: { task: displayName },
        descriptionKey: "ui.taskRuns.actionQueue.items.runningRun.description",
        descriptionParams: {
          percent: progress?.percent ?? 0,
          step: progress?.currentStep?.label ?? taskRun.runState,
        },
        actionKey: "ui.taskRuns.actionQueue.actions.watchRun",
        createdAt: taskRun.createdAt,
        businessTeamName: null,
        agentTeamName: null,
        taskRunId: taskRun.id,
        findingId: null,
        assignment: null,
        remediation: null,
      });
    }
  }

  for (const finding of args.findingTriageQueue.filter((item) => ["critical", "high"].includes(item.severity))) {
    const score = finding.severity === "critical" ? 95 : 85;
    items.push({
      id: `high-risk-finding:${finding.id}`,
      kind: "high_risk_finding",
      priority: priorityForScore(score),
      score,
      href: `/task-runs/${finding.taskRunId}`,
      titleKey: "ui.taskRuns.actionQueue.items.highRiskFinding.title",
      titleParams: { finding: finding.title },
      descriptionKey: "ui.taskRuns.actionQueue.items.highRiskFinding.description",
      descriptionParams: {
        severity: finding.severity,
        team: finding.businessTeamName,
      },
      actionKey: finding.assignment ? "ui.taskRuns.actionQueue.actions.reviewFinding" : "ui.taskRuns.actionQueue.actions.assignFinding",
      createdAt: finding.createdAt,
      businessTeamName: finding.businessTeamName,
      agentTeamName: finding.agentTeamName,
      taskRunId: finding.taskRunId,
      findingId: finding.id,
      assignment: finding.assignment ?? null,
      remediation: finding.remediation ?? null,
    });
  }

  for (const owner of args.findingOwnerBoard) {
    if (owner.overdue > 0) {
      const sample = owner.sampleFindings.find((finding) => finding.overdue) ?? owner.sampleFindings[0] ?? null;
      items.push({
        id: `overdue-owner:${owner.ownerKey}`,
        kind: "overdue_owner",
        priority: "high",
        score: 80 + Math.min(owner.overdue, 10),
        href: sample ? `/task-runs/${sample.taskRunId}` : "/task-runs",
        titleKey: "ui.taskRuns.actionQueue.items.overdueOwner.title",
        titleParams: { owner: owner.ownerLabel },
        descriptionKey: "ui.taskRuns.actionQueue.items.overdueOwner.description",
        descriptionParams: {
          count: owner.overdue,
          total: owner.total,
        },
        actionKey: "ui.taskRuns.actionQueue.actions.openOwnerWork",
        createdAt: owner.nextDueAt,
        businessTeamName: null,
        agentTeamName: null,
        taskRunId: sample?.taskRunId ?? null,
        findingId: sample?.id ?? null,
        assignment: owner.isUnassigned ? null : { assignedTo: owner.ownerLabel },
        remediation: null,
      });
    }

    if (owner.isUnassigned && owner.total > 0) {
      const sample = owner.sampleFindings[0] ?? null;
      const score = 75 + Math.min(owner.highRisk * 3 + owner.total, 15);
      items.push({
        id: `unassigned-owner:${owner.ownerKey}`,
        kind: "unassigned_owner",
        priority: priorityForScore(score),
        score,
        href: sample ? `/task-runs/${sample.taskRunId}` : "/task-runs",
        titleKey: "ui.taskRuns.actionQueue.items.unassignedOwner.title",
        titleParams: { count: owner.total },
        descriptionKey: "ui.taskRuns.actionQueue.items.unassignedOwner.description",
        descriptionParams: {
          highRisk: owner.highRisk,
          total: owner.total,
        },
        actionKey: "ui.taskRuns.actionQueue.actions.assignFinding",
        createdAt: owner.oldestCreatedAt ?? owner.nextDueAt,
        businessTeamName: null,
        agentTeamName: null,
        taskRunId: sample?.taskRunId ?? null,
        findingId: sample?.id ?? null,
        assignment: null,
        remediation: null,
      });
    }
  }

  return uniqueByTarget(items)
    .sort((left, right) => {
      if (right.score !== left.score) return right.score - left.score;
      return parseTimestamp(right.createdAt) - parseTimestamp(left.createdAt);
    })
    .slice(0, Math.max(1, Math.min(args.limit ?? 8, 20)));
}
