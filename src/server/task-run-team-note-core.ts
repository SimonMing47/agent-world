import { uiText } from "@/lib/language-pack";
import { queryOne, type TaskRun } from "@/server/db";
import { appendTaskRunEvent } from "@/server/task-run-event-store";

export type TaskRunTeamNoteType = "note" | "blocker" | "decision" | "handoff";

const taskRunTeamNoteTypes: TaskRunTeamNoteType[] = ["note", "blocker", "decision", "handoff"];
const maxTaskRunTeamNoteLength = 2000;

const phaseByNoteType: Record<TaskRunTeamNoteType, string> = {
  note: "team_note_recorded",
  blocker: "team_blocker_recorded",
  decision: "team_decision_recorded",
  handoff: "team_handoff_recorded",
};

function normalizeTaskRunTeamNoteType(value: unknown): TaskRunTeamNoteType {
  if (taskRunTeamNoteTypes.includes(value as TaskRunTeamNoteType)) return value as TaskRunTeamNoteType;
  return "note";
}

function normalizeNote(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export function recordTaskRunTeamNote(args: {
  taskRunId: string;
  note: unknown;
  noteType?: unknown;
  createdBy?: string | null;
}) {
  const taskRun = queryOne<TaskRun>("SELECT * FROM task_runs WHERE id = ?", args.taskRunId);
  if (!taskRun) throw new Error(uiText("ui.server.taskRunTeamNote.taskRunNotFound"));

  const note = normalizeNote(args.note);
  if (!note) throw new Error(uiText("ui.server.taskRunTeamNote.empty"));
  if (note.length > maxTaskRunTeamNoteLength) {
    throw new Error(
      uiText("ui.server.taskRunTeamNote.tooLong", undefined, {
        max: maxTaskRunTeamNoteLength,
      }),
    );
  }

  const noteType = normalizeTaskRunTeamNoteType(args.noteType);
  const createdBy = args.createdBy?.trim() || "console";

  appendTaskRunEvent({
    traceId: taskRun.traceId,
    taskRunId: taskRun.id,
    phase: phaseByNoteType[noteType],
    foldGroup: "Team Actions",
    title: uiText(`ui.server.taskRunTeamNote.eventTitle.${noteType}`),
    content: uiText("ui.server.taskRunTeamNote.eventContent", undefined, {
      createdBy,
      note,
    }),
    metadata: {
      noteType,
      note,
      createdBy,
    },
  });

  return {
    note: {
      taskRunId: taskRun.id,
      noteType,
      note,
      createdBy,
    },
  };
}
