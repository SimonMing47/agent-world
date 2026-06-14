import type { EventLog } from "@/server/db";

export type TaskRunTeamActivityKind =
  | "note"
  | "blocker"
  | "decision"
  | "handoff"
  | "finding"
  | "cleanup"
  | "remediation"
  | "gate"
  | "policy"
  | "other";

export type TaskRunTeamActivityItem = {
  id: string;
  seq: number;
  phase: string;
  kind: TaskRunTeamActivityKind;
  title: string;
  content: string;
  actor: string | null;
  target: string | null;
  createdAt: string;
};

export type TaskRunTeamActivitySummary = {
  totalCount: number;
  blockerCount: number;
  decisionCount: number;
  handoffCount: number;
  findingActionCount: number;
  gateActionCount: number;
  latestItem: TaskRunTeamActivityItem | null;
  latestHandoff: TaskRunTeamActivityItem | null;
  items: TaskRunTeamActivityItem[];
};

const teamFoldGroups = new Set(["Team Actions", "Human Actions"]);

function parseMetadata(raw: string) {
  try {
    const parsed = JSON.parse(raw) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : {};
  } catch {
    return {};
  }
}

function readString(source: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = source[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

function isTeamActivityEvent(event: EventLog) {
  return (
    teamFoldGroups.has(event.foldGroup) ||
    event.phase.startsWith("team_") ||
    event.phase.startsWith("finding_") ||
    event.phase === "cleanup_campaign_created" ||
    event.phase === "remediation_task_created"
  );
}

function classifyTeamActivity(event: EventLog): TaskRunTeamActivityKind {
  if (event.phase === "team_blocker_recorded") return "blocker";
  if (event.phase === "team_decision_recorded") return "decision";
  if (event.phase === "team_handoff_recorded") return "handoff";
  if (event.phase === "team_note_recorded") return "note";
  if (event.phase === "cleanup_campaign_created") return "cleanup";
  if (event.phase === "remediation_task_created") return "remediation";
  if (event.phase.startsWith("finding_")) return "finding";
  if (event.phase === "approval_required" || event.phase === "approval_result") return "gate";
  if (event.phase === "policy_violation" || event.phase === "access_grant_violation") return "policy";
  return "other";
}

function buildTeamActivityItem(event: EventLog): TaskRunTeamActivityItem {
  const metadata = parseMetadata(event.metadataJson);

  return {
    id: event.id,
    seq: event.seq,
    phase: event.phase,
    kind: classifyTeamActivity(event),
    title: event.title,
    content: event.content,
    actor: readString(metadata, ["createdBy", "updatedBy", "requestedBy", "resolvedBy", "assignedTo", "recordedBy"]),
    target: readString(metadata, ["findingId", "cleanupTaskRunId", "campaignTaskRunId", "remediationTaskRunId", "interventionId"]),
    createdAt: event.createdAt,
  };
}

export function buildTaskRunTeamActivity(
  events: EventLog[],
  options: { limit?: number } = {},
): TaskRunTeamActivitySummary {
  const limit = Math.max(1, Math.min(options.limit ?? 6, 20));
  const allItems = events
    .filter(isTeamActivityEvent)
    .map(buildTeamActivityItem)
    .sort((left, right) => right.seq - left.seq);
  const items = allItems.slice(0, limit);

  return {
    totalCount: allItems.length,
    blockerCount: allItems.filter((item) => item.kind === "blocker").length,
    decisionCount: allItems.filter((item) => item.kind === "decision").length,
    handoffCount: allItems.filter((item) => item.kind === "handoff").length,
    findingActionCount: allItems.filter((item) => item.kind === "finding" || item.kind === "remediation").length,
    gateActionCount: allItems.filter((item) => item.kind === "gate" || item.kind === "policy").length,
    latestItem: allItems.at(0) ?? null,
    latestHandoff: allItems.find((item) => item.kind === "handoff") ?? null,
    items,
  };
}
