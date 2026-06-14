import { type Finding, type TaskRun } from "@/server/db";

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

function remediationPriority(severity: string) {
  if (["critical", "high"].includes(severity)) return 95;
  if (severity === "medium") return 80;
  return 65;
}

function compactTitle(value: string) {
  return value.trim().replace(/\s+/g, " ").slice(0, 80);
}

export function buildFindingRemediationTaskInput(args: {
  finding: Finding;
  sourceTaskRun: TaskRun;
}) {
  const evidence = parseRecord(args.finding.evidenceJson);

  return {
    idempotencyKey: `finding-remediation:${args.finding.id}`,
    sourceRef: `finding:${compactTitle(args.finding.title) || args.finding.id}`,
    priority: remediationPriority(args.finding.severity),
    inputPayload: {
      taskCategory: "finding_remediation",
      sourceFindingId: args.finding.id,
      sourceTaskRunId: args.sourceTaskRun.id,
      sourceTaskRunRef: args.sourceTaskRun.sourceRef,
      finding: {
        id: args.finding.id,
        title: args.finding.title,
        category: args.finding.category,
        severity: args.finding.severity,
        status: args.finding.status,
        description: args.finding.description,
        recommendation: args.finding.recommendation,
        evidence,
      },
    },
  };
}
