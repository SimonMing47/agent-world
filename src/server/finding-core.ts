import { createHash } from "node:crypto";
import { randomUUID } from "node:crypto";
import {
  execute,
  queryOne,
  type Finding,
  type InspectionFeedback,
  type TaskRun,
  type TaskBlueprint,
  type BusinessTeam,
  type AgentTeam,
} from "@/server/db";
import { uiText } from "@/lib/language-pack";
import { buildFindingFeedbackPath } from "@/server/finding-feedback-token";

export type FindingSeverity = "info" | "low" | "medium" | "high" | "critical";
export type FindingStatus = "open" | "published" | "ignored" | "false_positive" | "fixed" | "deleted";

const severityOrder: FindingSeverity[] = ["info", "low", "medium", "high", "critical"];
const statusValues: FindingStatus[] = ["open", "published", "ignored", "false_positive", "fixed", "deleted"];
const inactiveTriageStatuses = ["fixed", "ignored", "false_positive", "deleted"];
const ownerBoardUnassignedKey = "__unassigned__";
const findingSlaHours: Record<FindingSeverity, number> = {
  critical: 4,
  high: 24,
  medium: 72,
  low: 168,
  info: 336,
};

function nowIso() {
  return new Date().toISOString();
}

function normalizeSeverity(value: unknown): FindingSeverity {
  return severityOrder.includes(value as FindingSeverity) ? (value as FindingSeverity) : "info";
}

function normalizeStatus(value: unknown): FindingStatus {
  return statusValues.includes(value as FindingStatus) ? (value as FindingStatus) : "open";
}

function normalizeJsonString(value: unknown, fallback: unknown) {
  if (typeof value === "string") {
    try {
      return JSON.stringify(JSON.parse(value), null, 2);
    } catch {
      return JSON.stringify(fallback, null, 2);
    }
  }
  return JSON.stringify(value ?? fallback, null, 2);
}

function normalizeConfidence(value: unknown) {
  const numeric = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numeric)) return 1;
  return Math.max(0, Math.min(1, numeric));
}

export function buildFindingFingerprint(args: {
  repoId?: string;
  filePath?: string;
  rule?: string;
  category: string;
  lineStart?: number;
  normalizedCode?: string;
}) {
  const value = [
    args.repoId ?? "unknown-repo",
    args.filePath ?? "unknown-file",
    args.rule ?? args.category,
    args.lineStart ?? 0,
    args.normalizedCode?.replace(/\s+/g, " ").slice(0, 240) ?? "",
  ].join("|");

  return createHash("sha256").update(value).digest("hex").slice(0, 24);
}

function parseRecord(value: string) {
  try {
    const parsed = JSON.parse(value) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

function parseArray(value: string) {
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

function severityRank(severity: string) {
  const index = severityOrder.indexOf(normalizeSeverity(severity));
  return index === -1 ? 0 : index;
}

function parseTimestamp(value: string | null | undefined) {
  const timestamp = Date.parse(value ?? "");
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function dueAtForFinding(finding: Finding) {
  const createdAt = parseTimestamp(finding.createdAt);
  if (!createdAt) return null;
  const severity = normalizeSeverity(finding.severity);
  return new Date(createdAt + findingSlaHours[severity] * 60 * 60 * 1000).toISOString();
}

function findingLocation(evidenceJson: string) {
  const evidence = parseRecord(evidenceJson);
  const filePath =
    typeof evidence.file_path === "string"
      ? evidence.file_path
      : typeof evidence.filePath === "string"
        ? evidence.filePath
        : typeof evidence.path === "string"
          ? evidence.path
          : null;
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

  if (!filePath?.trim()) return null;
  return line ? `${filePath}:${line}` : filePath;
}

function summarizeLatestFindingFeedback(findingId: string) {
  const feedback = queryOne<InspectionFeedback>(
    "SELECT * FROM inspection_feedback WHERE finding_id = ? ORDER BY created_at DESC LIMIT 1",
    findingId,
  );
  if (!feedback) return null;

  return {
    verdict: feedback.verdict,
    note: feedback.note,
    knowledgeUri: feedback.knowledgeUri,
    createdAt: feedback.createdAt,
  };
}

function summarizeFindingAssignment(publicationJson: string) {
  const publication = parseRecord(publicationJson);
  const rawAssignment = publication.assignment;
  if (!rawAssignment || typeof rawAssignment !== "object" || Array.isArray(rawAssignment)) return null;
  const assignment = rawAssignment as Record<string, unknown>;
  const assignedTo = "assignedTo" in assignment ? assignment.assignedTo : null;
  if (typeof assignedTo !== "string" || !assignedTo.trim()) return null;

  return {
    assignedTo: assignedTo.trim(),
    assignedBy: typeof assignment.assignedBy === "string" ? assignment.assignedBy : null,
    assignedAt: typeof assignment.assignedAt === "string" ? assignment.assignedAt : "",
    note: typeof assignment.note === "string" ? assignment.note : null,
  };
}

function summarizeFindingRemediation(publicationJson: string) {
  const publication = parseRecord(publicationJson);
  const rawRemediation = publication.remediation;
  if (!rawRemediation || typeof rawRemediation !== "object" || Array.isArray(rawRemediation)) return null;
  const remediation = rawRemediation as Record<string, unknown>;
  const taskRunId = "taskRunId" in remediation ? remediation.taskRunId : null;
  if (typeof taskRunId !== "string" || !taskRunId.trim()) return null;

  return {
    taskRunId: taskRunId.trim(),
    createdBy: typeof remediation.createdBy === "string" ? remediation.createdBy : null,
    createdAt: typeof remediation.createdAt === "string" ? remediation.createdAt : "",
  };
}

export function summarizeFinding(finding: Finding) {
  return {
    id: finding.id,
    taskRunId: finding.taskRunId,
    sourceAgent: finding.sourceAgent,
    category: finding.category,
    severity: finding.severity as FindingSeverity,
    confidence: finding.confidence,
    title: finding.title,
    description: finding.description,
    evidence: parseRecord(finding.evidenceJson),
    recommendation: finding.recommendation,
    knowledgeRefs: parseArray(finding.skillRefsJson),
    skillRefs: parseArray(finding.skillRefsJson),
    fingerprint: finding.fingerprint,
    status: finding.status,
    publication: parseRecord(finding.publicationJson),
    feedbackPath: buildFindingFeedbackPath(finding),
    latestFeedback: summarizeLatestFindingFeedback(finding.id),
    assignment: summarizeFindingAssignment(finding.publicationJson),
    remediation: summarizeFindingRemediation(finding.publicationJson),
    createdAt: finding.createdAt,
  };
}

export function upsertFinding(input: {
  id?: string;
  taskRunId: string;
  sourceAgent?: string;
  category?: string;
  severity?: string;
  confidence?: number | string;
  title: string;
  description?: string;
  evidenceJson?: string | Record<string, unknown>;
  recommendation?: string;
  skillRefsJson?: string | string[];
  fingerprint?: string;
  status?: string;
  publicationJson?: string | Record<string, unknown>;
}) {
  const id = input.id || randomUUID();
  const current = queryOne<Finding>("SELECT * FROM findings WHERE id = ?", id);
  const createdAt = current?.createdAt ?? nowIso();
  const category = input.category ?? current?.category ?? "general";
  const evidenceJson = normalizeJsonString(input.evidenceJson ?? current?.evidenceJson, {});
  const fingerprint =
    input.fingerprint ??
    current?.fingerprint ??
    buildFindingFingerprint({
      category,
      repoId: input.taskRunId,
      normalizedCode: `${input.title}:${input.description ?? ""}`,
    });

  execute(
    "INSERT OR REPLACE INTO findings (id, task_run_id, source_agent, category, severity, confidence, title, description, evidence_json, recommendation, skill_refs_json, fingerprint, status, publication_json, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    id,
    input.taskRunId,
    input.sourceAgent ?? current?.sourceAgent ?? "operator",
    category,
    normalizeSeverity(input.severity ?? current?.severity),
    normalizeConfidence(input.confidence ?? current?.confidence),
    input.title,
    input.description ?? current?.description ?? "",
    evidenceJson,
    input.recommendation ?? current?.recommendation ?? "",
    normalizeJsonString(input.skillRefsJson ?? current?.skillRefsJson, []),
    fingerprint,
    normalizeStatus(input.status ?? current?.status),
    normalizeJsonString(input.publicationJson ?? current?.publicationJson, { channels: [] }),
    createdAt,
    nowIso(),
  );

  return queryOne<Finding>("SELECT * FROM findings WHERE id = ?", id);
}

export function updateFinding(input: {
  id: string;
  sourceAgent?: string;
  category?: string;
  severity?: string;
  confidence?: number | string;
  title?: string;
  description?: string;
  evidenceJson?: string | Record<string, unknown>;
  recommendation?: string;
  skillRefsJson?: string | string[];
  status?: string;
  publicationJson?: string | Record<string, unknown>;
}) {
  const current = queryOne<Finding>("SELECT * FROM findings WHERE id = ?", input.id);
  if (!current) throw new Error(uiText("ui.generated.cc157098911"));

  return upsertFinding({
    ...current,
    ...input,
    taskRunId: current.taskRunId,
    title: input.title ?? current.title,
  });
}

export function deleteFinding(id: string) {
  execute("UPDATE findings SET status = ?, updated_at = ? WHERE id = ?", "deleted", nowIso(), id);
  return { ok: true };
}

export function ensureTaskRunSummaryFinding(args: {
  taskRun: TaskRun;
  blueprint: TaskBlueprint | null;
}) {
  const existing = queryOne<Finding>(
    "SELECT * FROM findings WHERE task_run_id = ? AND status <> 'deleted' LIMIT 1",
    args.taskRun.id,
  );
  if (existing) return;

  const category = args.blueprint?.category ?? "execution";
  const fingerprint = buildFindingFingerprint({
    repoId: args.taskRun.sourceRef ?? args.taskRun.id,
    category,
    rule: "task-run-summary",
    normalizedCode: args.taskRun.id,
  });
  const now = nowIso();

  execute(
    "INSERT INTO findings (id, task_run_id, source_agent, category, severity, confidence, title, description, evidence_json, recommendation, skill_refs_json, fingerprint, status, publication_json, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    randomUUID(),
    args.taskRun.id,
    "system",
    category,
    "info",
    1,
    uiText("ui.generated.ca3a70dcdff"),
    uiText("ui.server.taskBlueprint.completedSummary", undefined, { name: args.blueprint?.name ?? uiText("ui.generated.c3172b317f9") }),
    JSON.stringify({
      taskRunId: args.taskRun.id,
      sourceType: args.taskRun.sourceType,
      sourceRef: args.taskRun.sourceRef,
    }),
    uiText("ui.generated.cf9afad7f97"),
    JSON.stringify([]),
    fingerprint,
    "open",
    JSON.stringify({ channels: [] }),
    now,
    now,
  );
}

export function buildFindingDashboard(args: {
  findings: Finding[];
  taskRuns: TaskRun[];
  businessTeams: BusinessTeam[];
}) {
  const severities = ["critical", "high", "medium", "low", "info"];
  const activeFindings = args.findings.filter((finding) => finding.status !== "deleted");
  const categories = Array.from(new Set(activeFindings.map((finding) => finding.category)));

  return {
    total: activeFindings.length,
    open: activeFindings.filter((finding) => finding.status === "open").length,
    fixed: activeFindings.filter((finding) => finding.status === "fixed").length,
    ignored: activeFindings.filter((finding) => ["ignored", "false_positive"].includes(finding.status)).length,
    bySeverity: severities.map((severity) => ({
      severity,
      count: activeFindings.filter((finding) => finding.severity === severity).length,
    })),
    byCategory: categories.map((category) => ({
      category,
      count: activeFindings.filter((finding) => finding.category === category).length,
    })),
    byBusinessTeam: args.businessTeams.map((businessTeam) => {
      const taskRunIds = new Set(
        args.taskRuns
          .filter((taskRun) => taskRun.businessTeamId === businessTeam.id)
          .map((taskRun) => taskRun.id),
      );
      const scoped = activeFindings.filter((finding) => taskRunIds.has(finding.taskRunId));
      return {
        businessTeamId: businessTeam.id,
        businessTeamName: businessTeam.name,
        count: scoped.length,
        criticalOrHigh: scoped.filter((finding) => ["critical", "high"].includes(finding.severity)).length,
      };
    }),
  };
}

export function buildFindingTriageQueue(args: {
  findings: Finding[];
  taskRuns: TaskRun[];
  businessTeams: BusinessTeam[];
  teams: AgentTeam[];
  blueprints: TaskBlueprint[];
  limit?: number;
}) {
  const taskRunsById = new Map(args.taskRuns.map((taskRun) => [taskRun.id, taskRun]));
  const businessTeamsById = new Map(args.businessTeams.map((businessTeam) => [businessTeam.id, businessTeam]));
  const teamsById = new Map(args.teams.map((team) => [team.id, team]));
  const blueprintsById = new Map(args.blueprints.map((blueprint) => [blueprint.id, blueprint]));

  return args.findings
    .filter((finding) => !inactiveTriageStatuses.includes(finding.status))
    .sort((left, right) => {
      const severityDelta = severityRank(right.severity) - severityRank(left.severity);
      if (severityDelta !== 0) return severityDelta;
      return Date.parse(right.createdAt) - Date.parse(left.createdAt);
    })
    .slice(0, args.limit ?? 12)
    .map((finding) => {
      const taskRun = taskRunsById.get(finding.taskRunId) ?? null;
      const businessTeam = taskRun ? businessTeamsById.get(taskRun.businessTeamId) ?? null : null;
      const team = taskRun ? teamsById.get(taskRun.teamId) ?? null : null;
      const blueprint = taskRun?.blueprintId ? blueprintsById.get(taskRun.blueprintId) ?? null : null;

      return {
        id: finding.id,
        taskRunId: finding.taskRunId,
        title: finding.title,
        category: finding.category,
        severity: normalizeSeverity(finding.severity),
        status: normalizeStatus(finding.status),
        location: findingLocation(finding.evidenceJson),
        recommendation: finding.recommendation,
        createdAt: finding.createdAt,
        taskRunSourceRef: taskRun?.sourceRef ?? taskRun?.sourceType ?? null,
        taskRunStatus: taskRun?.status ?? null,
        businessTeamId: businessTeam?.id ?? taskRun?.businessTeamId ?? null,
        businessTeamName: businessTeam?.name ?? uiText("ui.generated.c7ae513bf4d"),
        agentTeamId: team?.id ?? taskRun?.teamId ?? null,
        agentTeamName: team?.name ?? uiText("ui.generated.c603903ef14"),
        blueprintName: blueprint?.name ?? null,
        feedbackPath: buildFindingFeedbackPath(finding),
        latestFeedback: summarizeLatestFindingFeedback(finding.id),
        assignment: summarizeFindingAssignment(finding.publicationJson),
        remediation: summarizeFindingRemediation(finding.publicationJson),
      };
    });
}

export function buildFindingOwnerBoard(args: {
  findings: Finding[];
  taskRuns: TaskRun[];
  businessTeams: BusinessTeam[];
  teams: AgentTeam[];
  blueprints: TaskBlueprint[];
  now?: Date;
  limit?: number;
}) {
  const nowMs = args.now?.getTime() ?? Date.now();
  const taskRunsById = new Map(args.taskRuns.map((taskRun) => [taskRun.id, taskRun]));
  const businessTeamsById = new Map(args.businessTeams.map((businessTeam) => [businessTeam.id, businessTeam]));
  const teamsById = new Map(args.teams.map((team) => [team.id, team]));
  const blueprintsById = new Map(args.blueprints.map((blueprint) => [blueprint.id, blueprint]));
  const board = new Map<
    string,
    {
      ownerKey: string;
      ownerLabel: string;
      isUnassigned: boolean;
      total: number;
      highRisk: number;
      overdue: number;
      nextDueAt: string | null;
      oldestCreatedAt: string | null;
      sampleFindings: Array<{
        id: string;
        taskRunId: string;
        title: string;
        severity: FindingSeverity;
        status: FindingStatus;
        location: string | null;
        category: string;
        businessTeamName: string;
        agentTeamName: string;
        blueprintName: string | null;
        createdAt: string;
        dueAt: string | null;
        overdue: boolean;
      }>;
    }
  >();

  for (const finding of args.findings.filter((item) => !inactiveTriageStatuses.includes(item.status))) {
    const assignment = summarizeFindingAssignment(finding.publicationJson);
    const ownerLabel = assignment?.assignedTo ?? uiText("ui.taskRuns.ownerBoard.unassignedOwner");
    const ownerKey = assignment?.assignedTo.trim().toLowerCase() || ownerBoardUnassignedKey;
    const isUnassigned = ownerKey === ownerBoardUnassignedKey;
    const dueAt = dueAtForFinding(finding);
    const dueAtMs = parseTimestamp(dueAt);
    const isOverdue = Boolean(dueAtMs && dueAtMs <= nowMs);
    const taskRun = taskRunsById.get(finding.taskRunId) ?? null;
    const businessTeam = taskRun ? businessTeamsById.get(taskRun.businessTeamId) ?? null : null;
    const team = taskRun ? teamsById.get(taskRun.teamId) ?? null : null;
    const blueprint = taskRun?.blueprintId ? blueprintsById.get(taskRun.blueprintId) ?? null : null;
    const current = board.get(ownerKey) ?? {
      ownerKey,
      ownerLabel,
      isUnassigned,
      total: 0,
      highRisk: 0,
      overdue: 0,
      nextDueAt: null,
      oldestCreatedAt: null,
      sampleFindings: [],
    };

    current.total += 1;
    if (["critical", "high"].includes(normalizeSeverity(finding.severity))) current.highRisk += 1;
    if (isOverdue) current.overdue += 1;
    if (!current.oldestCreatedAt || parseTimestamp(finding.createdAt) < parseTimestamp(current.oldestCreatedAt)) {
      current.oldestCreatedAt = finding.createdAt;
    }
    if (dueAt && (!current.nextDueAt || parseTimestamp(dueAt) < parseTimestamp(current.nextDueAt))) {
      current.nextDueAt = dueAt;
    }

    current.sampleFindings.push({
      id: finding.id,
      taskRunId: finding.taskRunId,
      title: finding.title,
      severity: normalizeSeverity(finding.severity),
      status: normalizeStatus(finding.status),
      location: findingLocation(finding.evidenceJson),
      category: finding.category,
      businessTeamName: businessTeam?.name ?? uiText("ui.generated.c7ae513bf4d"),
      agentTeamName: team?.name ?? uiText("ui.generated.c603903ef14"),
      blueprintName: blueprint?.name ?? null,
      createdAt: finding.createdAt,
      dueAt,
      overdue: isOverdue,
    });

    board.set(ownerKey, current);
  }

  return Array.from(board.values())
    .map((item) => ({
      ...item,
      sampleFindings: item.sampleFindings
        .sort((left, right) => {
          if (Number(right.overdue) !== Number(left.overdue)) return Number(right.overdue) - Number(left.overdue);
          const severityDelta = severityRank(right.severity) - severityRank(left.severity);
          if (severityDelta !== 0) return severityDelta;
          return parseTimestamp(right.createdAt) - parseTimestamp(left.createdAt);
        })
        .slice(0, 3),
    }))
    .sort((left, right) => {
      if (Number(left.isUnassigned) !== Number(right.isUnassigned)) return Number(right.isUnassigned) - Number(left.isUnassigned);
      if (right.overdue !== left.overdue) return right.overdue - left.overdue;
      if (right.highRisk !== left.highRisk) return right.highRisk - left.highRisk;
      if (right.total !== left.total) return right.total - left.total;
      return (left.nextDueAt ?? "").localeCompare(right.nextDueAt ?? "");
    })
    .slice(0, args.limit ?? 8);
}
