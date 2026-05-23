import { randomUUID } from "node:crypto";
import {
  execute,
  queryAll,
  queryOne,
  type TaskEvent,
  type TaskRunNode,
} from "@/server/db";

function nowIso() {
  return new Date().toISOString();
}

function getNextEventSeq(taskRunId: string) {
  const row = queryOne<{ maxSeq: number | null }>(
    "SELECT MAX(seq) as maxSeq FROM event_logs WHERE task_run_id = ?",
    taskRunId,
  );
  return (row?.maxSeq ?? 0) + 1;
}

export function getTaskRunNodes(taskRunId: string) {
  return queryAll<TaskRunNode>("SELECT * FROM task_run_nodes WHERE task_run_id = ? ORDER BY node_key ASC", taskRunId);
}

export function appendTaskRunEvent(args: {
  traceId: string;
  taskRunId: string;
  nodeId?: string | null;
  phase: string;
  foldGroup: string;
  title: string;
  content: string;
  metadata?: Record<string, unknown>;
  visibility?: TaskEvent["visibility"];
  parentEventId?: string | null;
}) {
  const eventId = randomUUID();
  const createdAt = nowIso();

  execute(
    "INSERT INTO event_logs (id, trace_id, task_run_id, node_id, seq, phase, fold_group, title, content, metadata_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    eventId,
    args.traceId,
    args.taskRunId,
    args.nodeId ?? null,
    getNextEventSeq(args.taskRunId),
    args.phase,
    args.foldGroup,
    args.title,
    args.content,
    JSON.stringify(args.metadata ?? {}),
    createdAt,
  );
  execute(
    "INSERT INTO task_events (id, task_run_id, agent_run_id, event_type, event_time, visibility, payload_json, raw_payload_ref, parent_event_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
    eventId,
    args.taskRunId,
    args.nodeId ?? null,
    args.phase,
    createdAt,
    args.visibility ?? "team_only",
    JSON.stringify({
      title: args.title,
      content: args.content,
      foldGroup: args.foldGroup,
      metadata: args.metadata ?? {},
    }),
    null,
    args.parentEventId ?? null,
  );
}
