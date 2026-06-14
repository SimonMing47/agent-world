import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import {
  execute,
  queryOne,
  type EventLog,
  type TaskEvent,
} from "@/server/db";
import { recordTaskRunTeamNote } from "@/server/task-run-team-note-core";

function insertTaskRun(id: string) {
  const now = new Date().toISOString();
  execute(
    "INSERT INTO task_runs (id, tenant_space_id, business_team_id, team_id, blueprint_id, blueprint_version, idempotency_key, parent_task_run_id, run_state, environment_snapshot_id, permission_snapshot_json, agent_team_run_plan_json, execution_policy_json, access_grant_id, source_type, source_ref, status, priority, input_payload_json, output_payload_json, cost_estimate, cost_actual, trace_id, requested_by, created_at, completed_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    id,
    `tenant-${id}`,
    `business-${id}`,
    `team-${id}`,
    null,
    1,
    `team-note-${id}`,
    null,
    "completed",
    null,
    "{}",
    "{}",
    "{}",
    null,
    "manual",
    `manual-${id}`,
    "completed",
    0,
    "{}",
    null,
    0,
    0,
    `trace-${id}`,
    "test",
    now,
    now,
  );
}

test("recordTaskRunTeamNote appends a blocker to both run event streams", () => {
  const taskRunId = `task-${randomUUID()}`;
  const note = "Deploy is blocked until the release owner approves the migration.";

  try {
    insertTaskRun(taskRunId);

    const result = recordTaskRunTeamNote({
      taskRunId,
      note,
      noteType: "blocker",
      createdBy: "mei",
    });

    assert.equal(result.note.noteType, "blocker");
    assert.equal(result.note.createdBy, "mei");

    const event = queryOne<EventLog>(
      "SELECT * FROM event_logs WHERE task_run_id = ? AND phase = ?",
      taskRunId,
      "team_blocker_recorded",
    );
    assert.equal(event?.foldGroup, "Team Actions");
    assert.match(event?.content ?? "", /Deploy is blocked/);

    const metadata = JSON.parse(event?.metadataJson ?? "{}") as {
      noteType?: string;
      note?: string;
      createdBy?: string;
    };
    assert.equal(metadata.noteType, "blocker");
    assert.equal(metadata.note, note);
    assert.equal(metadata.createdBy, "mei");

    const taskEvent = queryOne<TaskEvent>(
      "SELECT * FROM task_events WHERE task_run_id = ? AND event_type = ?",
      taskRunId,
      "team_blocker_recorded",
    );
    assert.equal(taskEvent?.visibility, "team_only");
  } finally {
    execute("DELETE FROM task_events WHERE task_run_id = ?", taskRunId);
    execute("DELETE FROM event_logs WHERE task_run_id = ?", taskRunId);
    execute("DELETE FROM task_runs WHERE id = ?", taskRunId);
  }
});

test("recordTaskRunTeamNote rejects blank notes", () => {
  const taskRunId = `task-${randomUUID()}`;

  try {
    insertTaskRun(taskRunId);
    assert.throws(() =>
      recordTaskRunTeamNote({
        taskRunId,
        note: "   ",
        noteType: "decision",
        createdBy: "mei",
      }),
    );
  } finally {
    execute("DELETE FROM task_events WHERE task_run_id = ?", taskRunId);
    execute("DELETE FROM event_logs WHERE task_run_id = ?", taskRunId);
    execute("DELETE FROM task_runs WHERE id = ?", taskRunId);
  }
});
