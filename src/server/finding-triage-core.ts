import {
  queryOne,
  type Finding,
  type TaskRun,
} from "@/server/db";
import { updateFinding } from "@/server/finding-core";
import { appendTaskRunEvent } from "@/server/task-run-event-store";
import { uiText } from "@/lib/language-pack";

export type FindingTriageStatus = "open" | "fixed" | "ignored" | "false_positive";

const findingTriageStatuses: FindingTriageStatus[] = ["open", "fixed", "ignored", "false_positive"];

function nowIso() {
  return new Date().toISOString();
}

function parseJsonRecord(value: string | null | undefined) {
  try {
    const parsed = JSON.parse(value ?? "{}") as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

function normalizeFindingTriageStatus(value: unknown): FindingTriageStatus {
  if (findingTriageStatuses.includes(value as FindingTriageStatus)) return value as FindingTriageStatus;
  throw new Error(uiText("ui.server.findingTriage.invalidStatus"));
}

export function triageTaskRunFinding(args: {
  taskRunId: string;
  findingId: string;
  status: unknown;
  note?: string | null;
  updatedBy?: string | null;
}) {
  const taskRun = queryOne<TaskRun>("SELECT * FROM task_runs WHERE id = ?", args.taskRunId);
  if (!taskRun) throw new Error(uiText("ui.server.findingTriage.taskRunNotFound"));

  const finding = queryOne<Finding>(
    "SELECT * FROM findings WHERE id = ? AND task_run_id = ? AND status <> 'deleted'",
    args.findingId,
    args.taskRunId,
  );
  if (!finding) throw new Error(uiText("ui.server.findingTriage.notFound"));

  const status = normalizeFindingTriageStatus(args.status);
  const note = args.note?.trim() || null;
  const updatedBy = args.updatedBy?.trim() || "console";
  const now = nowIso();
  const publication = parseJsonRecord(finding.publicationJson);
  const history = Array.isArray(publication.triageHistory)
    ? publication.triageHistory.filter((item) => Boolean(item) && typeof item === "object")
    : [];

  const updatedFinding = updateFinding({
    id: finding.id,
    status,
    publicationJson: {
      ...publication,
      triage: {
        status,
        note,
        updatedBy,
        updatedAt: now,
      },
      triageHistory: [
        ...history.slice(-9),
        {
          status,
          note,
          updatedBy,
          updatedAt: now,
        },
      ],
    },
  });

  appendTaskRunEvent({
    traceId: taskRun.traceId,
    taskRunId: taskRun.id,
    phase: "finding_triaged",
    foldGroup: "Team Actions",
    title: uiText("ui.server.findingTriage.eventTitle"),
    content: uiText("ui.server.findingTriage.eventContent", undefined, {
      updatedBy,
      status,
      title: finding.title,
    }),
    metadata: {
      findingId: finding.id,
      previousStatus: finding.status,
      status,
      note,
      updatedBy,
    },
  });

  return {
    finding: updatedFinding,
  };
}
