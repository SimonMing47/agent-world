import { createHash, randomUUID } from "node:crypto";
import { uiText } from "@/lib/language-pack";
import {
  execute,
  queryAll,
  queryOne,
  type AgentTeam,
  type BusinessTeam,
  type EnvironmentSnapshot,
  type Finding,
  type TaskRun,
  type TenantSpace,
} from "@/server/db";
import { appendTaskRunEvent } from "@/server/task-run-event-store";

export type FindingCleanupCampaignScope = "high_risk" | "overdue" | "unassigned" | "cleancode" | "all_open";

const cleanupCampaignScopes: FindingCleanupCampaignScope[] = [
  "high_risk",
  "overdue",
  "unassigned",
  "cleancode",
  "all_open",
];
const severityRanks: Record<string, number> = {
  info: 0,
  low: 1,
  medium: 2,
  high: 3,
  critical: 4,
};
const findingSlaHours: Record<string, number> = {
  critical: 4,
  high: 24,
  medium: 72,
  low: 168,
  info: 336,
};

function nowIso() {
  return new Date().toISOString();
}

function normalizeScope(value: unknown): FindingCleanupCampaignScope {
  return cleanupCampaignScopes.includes(value as FindingCleanupCampaignScope)
    ? (value as FindingCleanupCampaignScope)
    : "high_risk";
}

function normalizeLimit(value: unknown) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || !Number.isInteger(parsed) || parsed <= 0) return 8;
  return Math.max(1, Math.min(parsed, 20));
}

function parseRecord(value: string | null | undefined) {
  try {
    const parsed = JSON.parse(value ?? "{}") as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

function parseAssignment(publicationJson: string) {
  const publication = parseRecord(publicationJson);
  const rawAssignment = publication.assignment;
  if (!rawAssignment || typeof rawAssignment !== "object" || Array.isArray(rawAssignment)) return null;
  const assignedTo = (rawAssignment as Record<string, unknown>).assignedTo;
  return typeof assignedTo === "string" && assignedTo.trim() ? assignedTo.trim() : null;
}

function timestamp(value: string | null | undefined) {
  const parsed = Date.parse(value ?? "");
  return Number.isFinite(parsed) ? parsed : 0;
}

function dueAtForFinding(finding: Finding) {
  const createdAt = timestamp(finding.createdAt);
  if (!createdAt) return null;
  const hours = findingSlaHours[finding.severity] ?? findingSlaHours.info;
  return new Date(createdAt + hours * 60 * 60 * 1000).toISOString();
}

function isOverdue(finding: Finding, nowMs: number) {
  const dueAt = dueAtForFinding(finding);
  return Boolean(dueAt && timestamp(dueAt) <= nowMs);
}

function findingLocation(evidence: Record<string, unknown>) {
  const filePath =
    typeof evidence.file_path === "string"
      ? evidence.file_path
      : typeof evidence.filePath === "string"
        ? evidence.filePath
        : typeof evidence.path === "string"
          ? evidence.path
          : "";
  const line =
    typeof evidence.line_start === "number"
      ? evidence.line_start
      : typeof evidence.lineStart === "number"
        ? evidence.lineStart
        : typeof evidence.line_number === "number"
          ? evidence.line_number
          : typeof evidence.lineNumber === "number"
            ? evidence.lineNumber
            : null;
  return filePath.trim() ? (line ? `${filePath}:${line}` : filePath) : null;
}

function matchesScope(finding: Finding, scope: FindingCleanupCampaignScope, nowMs: number) {
  if (scope === "all_open") return true;
  if (scope === "high_risk") return finding.severity === "critical" || finding.severity === "high";
  if (scope === "overdue") return isOverdue(finding, nowMs);
  if (scope === "unassigned") return !parseAssignment(finding.publicationJson);
  return finding.category.toLowerCase().includes("cleancode");
}

function campaignKey(scope: FindingCleanupCampaignScope, findingIds: string[]) {
  const digest = createHash("sha256").update(findingIds.slice().sort().join("|")).digest("hex").slice(0, 16);
  return `finding-cleanup-campaign:${scope}:${digest}`;
}

function summarizeFindingForCampaign(finding: Finding) {
  const evidence = parseRecord(finding.evidenceJson);
  return {
    id: finding.id,
    taskRunId: finding.taskRunId,
    title: finding.title,
    category: finding.category,
    severity: finding.severity,
    status: finding.status,
    description: finding.description,
    recommendation: finding.recommendation,
    location: findingLocation(evidence),
    evidence,
    assignedTo: parseAssignment(finding.publicationJson),
    dueAt: dueAtForFinding(finding),
  };
}

function countBy(values: string[]) {
  return values.reduce<Record<string, number>>((acc, value) => {
    acc[value] = (acc[value] ?? 0) + 1;
    return acc;
  }, {});
}

function createCleanupTaskRun(args: {
  teamId: string;
  idempotencyKey: string;
  parentTaskRunId: string;
  sourceRef: string;
  requestedBy: string;
  priority: number;
  summary: string;
  inputPayload: Record<string, unknown>;
  sourceEnvironmentSnapshot: EnvironmentSnapshot | null;
  sourceSnapshotPayload: Record<string, unknown> | null;
}) {
  const team = queryOne<AgentTeam>("SELECT * FROM agent_teams WHERE id = ?", args.teamId);
  if (!team) throw new Error(uiText("ui.generated.c7f1a712e10"));
  const businessTeam = queryOne<BusinessTeam>("SELECT * FROM business_teams WHERE id = ?", team.businessTeamId);
  if (!businessTeam) throw new Error(uiText("ui.generated.c5720b81904"));
  const tenantSpace = queryOne<TenantSpace>("SELECT * FROM tenant_spaces WHERE id = ?", businessTeam.tenantSpaceId);
  if (!tenantSpace) throw new Error(uiText("ui.generated.c56f9b31da8"));
  const agentMember = queryOne<{ id: string }>(
    "SELECT id FROM agent_team_members WHERE team_id = ? AND status <> 'deleted' ORDER BY position ASC, created_at ASC LIMIT 1",
    team.id,
  );
  if (!agentMember) throw new Error(uiText("ui.server.findingCleanupCampaign.teamNotRunnable"));

  const taskRunId = randomUUID();
  const traceId = randomUUID();
  const planId = randomUUID();
  const createdAt = nowIso();
  const nodeKey = "cleanup";
  const environmentSnapshot = args.sourceSnapshotPayload
    ? {
        templateId: args.sourceEnvironmentSnapshot?.templateId ?? null,
        environmentId: args.sourceEnvironmentSnapshot?.environmentId ?? null,
        payload: {
          ...args.sourceSnapshotPayload,
          cleanupCampaign: args.inputPayload.cleanupCampaign,
          workspace:
            typeof args.sourceSnapshotPayload.workspace === "object" &&
            args.sourceSnapshotPayload.workspace !== null
              ? {
                  ...(args.sourceSnapshotPayload.workspace as Record<string, unknown>),
                  id: `workspace:${taskRunId}`,
                }
              : { id: `workspace:${taskRunId}` },
        },
      }
    : null;

  execute(
    "INSERT INTO task_runs (id, tenant_space_id, business_team_id, team_id, blueprint_id, blueprint_version, idempotency_key, parent_task_run_id, run_state, environment_snapshot_id, permission_snapshot_json, agent_team_run_plan_json, execution_policy_json, access_grant_id, source_type, source_ref, status, priority, input_payload_json, output_payload_json, cost_estimate, cost_actual, trace_id, requested_by, created_at, completed_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    taskRunId,
    tenantSpace.id,
    businessTeam.id,
    team.id,
    null,
    0,
    args.idempotencyKey,
    args.parentTaskRunId,
    "running",
    environmentSnapshot ? `${taskRunId}:environment` : null,
    "{}",
    "{}",
    "{}",
    null,
    "manual",
    args.sourceRef,
    "running",
    args.priority,
    JSON.stringify(args.inputPayload),
    null,
    0,
    0,
    traceId,
    args.requestedBy,
    createdAt,
    null,
  );

  if (environmentSnapshot) {
    execute(
      "INSERT INTO environment_snapshots (id, task_run_id, template_id, environment_id, snapshot_json, created_at) VALUES (?, ?, ?, ?, ?, ?)",
      `${taskRunId}:environment`,
      taskRunId,
      environmentSnapshot.templateId,
      environmentSnapshot.environmentId,
      JSON.stringify(environmentSnapshot.payload),
      createdAt,
    );
  }

  execute(
    "INSERT INTO task_run_plans (id, task_run_id, planner_mode, dag_json, summary, created_at) VALUES (?, ?, ?, ?, ?, ?)",
    planId,
    taskRunId,
    "rule",
    JSON.stringify({ nodes: [{ id: nodeKey, agent: agentMember.id }], edges: [] }),
    args.summary,
    createdAt,
  );
  execute(
    "INSERT INTO task_run_nodes (id, task_run_id, plan_id, node_key, agent_id, depends_on_json, input_json, output_json, status, attempt_count, max_attempts, started_at, completed_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    randomUUID(),
    taskRunId,
    planId,
    nodeKey,
    agentMember.id,
    JSON.stringify([]),
    JSON.stringify({
      action: "execute",
      tool: "repo.write",
      cleanupCampaign: args.inputPayload.cleanupCampaign,
    }),
    null,
    "submitted",
    0,
    3,
    null,
    null,
  );
  appendTaskRunEvent({
    traceId,
    taskRunId,
    phase: "planning",
    foldGroup: "Planning",
    title: uiText("ui.generated.c7bdaa28ba6"),
    content: uiText("ui.server.taskBlueprint.queued", undefined, { teamName: team.name }),
    metadata: {
      idempotencyKey: args.idempotencyKey,
      workflowType: team.workflowType,
      plannerMode: "rule",
      nodeCount: 1,
      cleanupCampaign: true,
    },
  });

  const taskRun = queryOne<TaskRun>("SELECT * FROM task_runs WHERE id = ?", taskRunId);
  if (!taskRun) throw new Error(uiText("ui.server.findingCleanupCampaign.failed"));
  return taskRun;
}

function updateFindingCampaignHistory(args: {
  finding: Finding;
  campaignTaskRunId: string;
  requestedBy: string;
  scope: FindingCleanupCampaignScope;
  createdAt: string;
}) {
  const publication = parseRecord(args.finding.publicationJson);
  const history = Array.isArray(publication.cleanupCampaignHistory)
    ? publication.cleanupCampaignHistory.filter((item) => Boolean(item) && typeof item === "object")
    : [];

  execute(
    "UPDATE findings SET publication_json = ?, updated_at = ? WHERE id = ?",
    JSON.stringify({
      ...publication,
      cleanupCampaign: {
        taskRunId: args.campaignTaskRunId,
        scope: args.scope,
        createdBy: args.requestedBy,
        createdAt: args.createdAt,
      },
      cleanupCampaignHistory: [
        ...history.slice(-9),
        {
          taskRunId: args.campaignTaskRunId,
          scope: args.scope,
          createdBy: args.requestedBy,
          createdAt: args.createdAt,
        },
      ],
    }, null, 2),
    args.createdAt,
    args.finding.id,
  );
}

export function createFindingCleanupCampaignTaskRun(args: {
  scope?: unknown;
  limit?: unknown;
  teamId?: unknown;
  requestedBy?: string | null;
}) {
  const scope = normalizeScope(args.scope);
  const limit = normalizeLimit(args.limit);
  const teamId = typeof args.teamId === "string" && args.teamId.trim() ? args.teamId.trim() : null;
  const requestedBy = args.requestedBy?.trim() || "console";
  const now = nowIso();
  const nowMs = timestamp(now);
  const taskRuns = queryAll<TaskRun>("SELECT * FROM task_runs ORDER BY created_at DESC");
  const taskRunsById = new Map(taskRuns.map((taskRun) => [taskRun.id, taskRun]));
  const candidates = queryAll<Finding>(
    "SELECT * FROM findings WHERE status NOT IN ('fixed', 'ignored', 'false_positive', 'deleted') ORDER BY created_at DESC",
  )
    .filter((finding) => matchesScope(finding, scope, nowMs))
    .filter((finding) => {
      const taskRun = taskRunsById.get(finding.taskRunId);
      if (!taskRun) return false;
      return !teamId || taskRun.teamId === teamId;
    })
    .sort((left, right) => {
      const overdueDelta = Number(isOverdue(right, nowMs)) - Number(isOverdue(left, nowMs));
      if (overdueDelta !== 0) return overdueDelta;
      const severityDelta = (severityRanks[right.severity] ?? 0) - (severityRanks[left.severity] ?? 0);
      if (severityDelta !== 0) return severityDelta;
      return timestamp(left.createdAt) - timestamp(right.createdAt);
    });

  const primaryFinding = candidates[0] ?? null;
  const primaryTaskRun = primaryFinding ? taskRunsById.get(primaryFinding.taskRunId) ?? null : null;
  if (!primaryFinding || !primaryTaskRun) {
    throw new Error(uiText("ui.server.findingCleanupCampaign.noFindings"));
  }

  const selected = candidates
    .filter((finding) => taskRunsById.get(finding.taskRunId)?.teamId === primaryTaskRun.teamId)
    .slice(0, limit);
  if (selected.length === 0) throw new Error(uiText("ui.server.findingCleanupCampaign.noFindings"));

  const idempotencyKey = campaignKey(scope, selected.map((finding) => finding.id));
  const existing = queryOne<TaskRun>(
    "SELECT * FROM task_runs WHERE idempotency_key = ? ORDER BY created_at DESC LIMIT 1",
    idempotencyKey,
  );
  if (existing) {
    return {
      created: false,
      taskRun: existing,
      findingCount: selected.length,
      sourceFindingIds: selected.map((finding) => finding.id),
    };
  }

  const sourceEnvironmentSnapshot = primaryTaskRun.environmentSnapshotId
    ? queryOne<EnvironmentSnapshot>("SELECT * FROM environment_snapshots WHERE id = ?", primaryTaskRun.environmentSnapshotId)
    : null;
  const sourceSnapshotPayload = sourceEnvironmentSnapshot
    ? parseRecord(sourceEnvironmentSnapshot.snapshotJson)
    : null;
  const campaignFindings = selected.map(summarizeFindingForCampaign);
  const sourceTaskRunIds = [...new Set(selected.map((finding) => finding.taskRunId))];
  const campaignTaskRun = createCleanupTaskRun({
    teamId: primaryTaskRun.teamId,
    idempotencyKey,
    parentTaskRunId: primaryTaskRun.id,
    sourceRef: uiText("ui.server.findingCleanupCampaign.sourceRef", undefined, {
      scope: uiText(`ui.server.findingCleanupCampaign.scope.${scope}`),
      count: selected.length,
    }),
    requestedBy,
    priority: selected.some((finding) => finding.severity === "critical" || finding.severity === "high") ? 96 : 78,
    summary: uiText("ui.server.findingCleanupCampaign.summary", undefined, {
      count: selected.length,
      scope: uiText(`ui.server.findingCleanupCampaign.scope.${scope}`),
    }),
    inputPayload: {
      taskCategory: "finding_cleanup_campaign",
      cleanupCampaign: {
        scope,
        requestedBy,
        createdAt: now,
        sourceFindingIds: selected.map((finding) => finding.id),
        sourceTaskRunIds,
        findingCount: selected.length,
        candidateCount: candidates.length,
        excludedByTeamCount: candidates.length - selected.length,
        severityBreakdown: countBy(selected.map((finding) => finding.severity)),
        categoryBreakdown: countBy(selected.map((finding) => finding.category)),
        findings: campaignFindings,
      },
    },
    sourceEnvironmentSnapshot,
    sourceSnapshotPayload,
  });

  for (const finding of selected) {
    updateFindingCampaignHistory({
      finding,
      campaignTaskRunId: campaignTaskRun.id,
      requestedBy,
      scope,
      createdAt: now,
    });
  }

  const selectedByTaskRun = new Map<string, Finding[]>();
  for (const finding of selected) {
    selectedByTaskRun.set(finding.taskRunId, [...(selectedByTaskRun.get(finding.taskRunId) ?? []), finding]);
  }
  for (const [taskRunId, sourceFindings] of selectedByTaskRun.entries()) {
    const sourceTaskRun = taskRunsById.get(taskRunId);
    if (!sourceTaskRun) continue;
    appendTaskRunEvent({
      traceId: sourceTaskRun.traceId,
      taskRunId: sourceTaskRun.id,
      phase: "cleanup_campaign_created",
      foldGroup: "Team Actions",
      title: uiText("ui.server.findingCleanupCampaign.eventTitle"),
      content: uiText("ui.server.findingCleanupCampaign.eventContent", undefined, {
        requestedBy,
        taskRunId: campaignTaskRun.id,
        count: sourceFindings.length,
      }),
      metadata: {
        cleanupTaskRunId: campaignTaskRun.id,
        scope,
        findingIds: sourceFindings.map((finding) => finding.id),
      },
    });
  }

  return {
    created: true,
    taskRun: campaignTaskRun,
    findingCount: selected.length,
    sourceFindingIds: selected.map((finding) => finding.id),
  };
}
