import {
  queryOne,
  type Finding,
  type TaskRun,
} from "@/server/db";
import { uiText } from "@/lib/language-pack";
import { updateFinding } from "@/server/finding-core";
import { appendTaskRunEvent } from "@/server/task-run-event-store";

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

function normalizeNullableString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export function assignTaskRunFinding(args: {
  taskRunId: string;
  findingId: string;
  assignedTo?: unknown;
  note?: string | null;
  updatedBy?: string | null;
}) {
  const taskRun = queryOne<TaskRun>("SELECT * FROM task_runs WHERE id = ?", args.taskRunId);
  if (!taskRun) throw new Error(uiText("ui.server.findingAssignment.taskRunNotFound"));

  const finding = queryOne<Finding>(
    "SELECT * FROM findings WHERE id = ? AND task_run_id = ? AND status <> 'deleted'",
    args.findingId,
    args.taskRunId,
  );
  if (!finding) throw new Error(uiText("ui.server.findingAssignment.notFound"));

  const assignedTo = normalizeNullableString(args.assignedTo);
  const note = args.note?.trim() || null;
  const updatedBy = args.updatedBy?.trim() || "console";
  const now = nowIso();
  const publication = parseJsonRecord(finding.publicationJson);
  const history = Array.isArray(publication.assignmentHistory)
    ? publication.assignmentHistory.filter((item) => Boolean(item) && typeof item === "object")
    : [];
  const assignment = assignedTo
    ? {
        assignedTo,
        assignedBy: updatedBy,
        assignedAt: now,
        note,
      }
    : null;

  const updatedFinding = updateFinding({
    id: finding.id,
    publicationJson: {
      ...publication,
      assignment,
      assignmentHistory: [
        ...history.slice(-9),
        {
          action: assignedTo ? "assigned" : "released",
          assignedTo,
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
    phase: assignedTo ? "finding_assigned" : "finding_assignment_released",
    foldGroup: "Team Actions",
    title: uiText(assignedTo ? "ui.server.findingAssignment.assignedTitle" : "ui.server.findingAssignment.releasedTitle"),
    content: assignedTo
      ? uiText("ui.server.findingAssignment.assignedContent", undefined, {
          updatedBy,
          assignedTo,
          title: finding.title,
        })
      : uiText("ui.server.findingAssignment.releasedContent", undefined, {
          updatedBy,
          title: finding.title,
        }),
    metadata: {
      findingId: finding.id,
      assignedTo,
      note,
      updatedBy,
    },
  });

  return {
    finding: updatedFinding,
    assignment,
  };
}
