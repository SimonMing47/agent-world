import { createHash } from "node:crypto";
import { type Finding, type TaskRun, type BusinessTeam } from "@/server/db";

export type FindingSeverity = "info" | "low" | "medium" | "high" | "critical";

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

export function buildFindingDashboard(args: {
  findings: Finding[];
  taskRuns: TaskRun[];
  businessTeams: BusinessTeam[];
}) {
  const severities = ["critical", "high", "medium", "low", "info"];
  const categories = Array.from(new Set(args.findings.map((finding) => finding.category)));

  return {
    total: args.findings.length,
    open: args.findings.filter((finding) => finding.status === "open").length,
    bySeverity: severities.map((severity) => ({
      severity,
      count: args.findings.filter((finding) => finding.severity === severity).length,
    })),
    byCategory: categories.map((category) => ({
      category,
      count: args.findings.filter((finding) => finding.category === category).length,
    })),
    byBusinessTeam: args.businessTeams.map((businessTeam) => {
      const taskRunIds = new Set(
        args.taskRuns
          .filter((taskRun) => taskRun.businessTeamId === businessTeam.id)
          .map((taskRun) => taskRun.id),
      );
      const scoped = args.findings.filter((finding) => taskRunIds.has(finding.taskRunId));
      return {
        businessTeamId: businessTeam.id,
        businessTeamName: businessTeam.name,
        count: scoped.length,
        criticalOrHigh: scoped.filter((finding) => ["critical", "high"].includes(finding.severity)).length,
      };
    }),
  };
}
