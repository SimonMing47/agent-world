import { createHash } from "node:crypto";
import { randomUUID } from "node:crypto";
import {
  execute,
  queryOne,
  type Finding,
  type TaskRun,
  type BusinessTeam,
} from "@/server/db";

export type FindingSeverity = "info" | "low" | "medium" | "high" | "critical";
export type FindingStatus = "open" | "published" | "ignored" | "false_positive" | "fixed" | "deleted";

const severityOrder: FindingSeverity[] = ["info", "low", "medium", "high", "critical"];
const statusValues: FindingStatus[] = ["open", "published", "ignored", "false_positive", "fixed", "deleted"];

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
    skillRefs: parseArray(finding.skillRefsJson),
    fingerprint: finding.fingerprint,
    status: finding.status,
    publication: parseRecord(finding.publicationJson),
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
  if (!current) throw new Error("Finding 不存在。");

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
