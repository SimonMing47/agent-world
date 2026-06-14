import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { POST as postFindingAssignment } from "@/app/api/task-runs/[id]/findings/[findingId]/assignment/route";
import {
  execute,
  queryOne,
  type AgentTeam,
  type BusinessTeam,
  type EventLog,
  type Finding,
  type InspectionFeedback,
  type TaskBlueprint,
  type TaskRun,
} from "@/server/db";
import { buildFindingOwnerBoard, buildFindingTriageQueue, summarizeFinding, upsertFinding } from "@/server/finding-core";
import { assignTaskRunFinding } from "@/server/finding-assignment-core";
import { buildFindingFeedbackToken, recordFindingFeedback } from "@/server/finding-feedback-core";
import { buildFindingRemediationTaskInput } from "@/server/finding-remediation-core";
import { triageTaskRunFinding } from "@/server/finding-triage-core";

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
    `triage-${id}`,
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

function insertAuthSession(args: {
  userId: string;
  sessionToken: string;
  email: string;
  name: string;
}) {
  const now = new Date().toISOString();
  execute(
    "INSERT OR REPLACE INTO identity_users (id, tenant_space_id, auth_provider_config_id, external_user_id, employee_no, email, name, avatar_url, title, status, is_system_admin, primary_business_team_id, profile_json, created_at, updated_at, last_login_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    args.userId,
    null,
    null,
    args.userId,
    "",
    args.email,
    args.name,
    "",
    "",
    "active",
    1,
    null,
    "{}",
    now,
    now,
    now,
  );
  execute(
    "INSERT OR REPLACE INTO auth_sessions (id, user_id, auth_provider_config_id, session_token, status, expires_at, created_at, updated_at, last_seen_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
    `session-${args.userId}`,
    args.userId,
    null,
    args.sessionToken,
    "active",
    "2099-01-01T00:00:00.000Z",
    now,
    now,
    now,
  );
}

test("triageTaskRunFinding updates status and appends a task event", () => {
  const taskRunId = `task-${randomUUID()}`;
  const findingId = `finding-${randomUUID()}`;

  try {
    insertTaskRun(taskRunId);
    upsertFinding({
      id: findingId,
      taskRunId,
      sourceAgent: "test",
      category: "cleancode",
      severity: "high",
      confidence: 1,
      title: "Example finding",
      description: "Example description",
      evidenceJson: { file_path: "src/example.ts", line_start: 3 },
      recommendation: "Fix the example.",
      status: "open",
      publicationJson: { channels: [] },
    });

    const result = triageTaskRunFinding({
      taskRunId,
      findingId,
      status: "fixed",
      updatedBy: "reviewer",
    });

    assert.equal(result.finding?.status, "fixed");
    const stored = queryOne<Finding>("SELECT * FROM findings WHERE id = ?", findingId);
    assert.equal(stored?.status, "fixed");
    assert.match(stored?.publicationJson ?? "", /triageHistory/);

    const event = queryOne<EventLog>(
      "SELECT * FROM event_logs WHERE task_run_id = ? AND phase = ?",
      taskRunId,
      "finding_triaged",
    );
    assert.equal(event?.foldGroup, "Team Actions");
  } finally {
    execute("DELETE FROM task_events WHERE task_run_id = ?", taskRunId);
    execute("DELETE FROM event_logs WHERE task_run_id = ?", taskRunId);
    execute("DELETE FROM findings WHERE id = ?", findingId);
    execute("DELETE FROM task_runs WHERE id = ?", taskRunId);
  }
});

test("assignTaskRunFinding stores owner metadata and release history", () => {
  const taskRunId = `task-${randomUUID()}`;
  const findingId = `finding-${randomUUID()}`;

  try {
    insertTaskRun(taskRunId);
    upsertFinding({
      id: findingId,
      taskRunId,
      sourceAgent: "test",
      category: "cleancode",
      severity: "medium",
      confidence: 1,
      title: "Assignable finding",
      description: "Example description",
      evidenceJson: { file_path: "src/assign.ts", line_start: 10 },
      recommendation: "Assign the example.",
      status: "open",
      publicationJson: { channels: [] },
    });

    const assigned = assignTaskRunFinding({
      taskRunId,
      findingId,
      assignedTo: "mei",
      updatedBy: "reviewer",
    });

    assert.equal(assigned.assignment?.assignedTo, "mei");
    const stored = queryOne<Finding>("SELECT * FROM findings WHERE id = ?", findingId);
    const publication = JSON.parse(stored?.publicationJson ?? "{}") as {
      assignment?: { assignedTo?: string };
      assignmentHistory?: Array<{ action?: string; assignedTo?: string | null }>;
    };
    assert.equal(publication.assignment?.assignedTo, "mei");
    assert.equal(publication.assignmentHistory?.at(-1)?.action, "assigned");
    assert.equal(summarizeFinding(stored as Finding).assignment?.assignedTo, "mei");

    const event = queryOne<EventLog>(
      "SELECT * FROM event_logs WHERE task_run_id = ? AND phase = ?",
      taskRunId,
      "finding_assigned",
    );
    assert.equal(event?.foldGroup, "Team Actions");

    const released = assignTaskRunFinding({
      taskRunId,
      findingId,
      assignedTo: null,
      updatedBy: "reviewer",
    });
    assert.equal(released.assignment, null);
    const releasedStored = queryOne<Finding>("SELECT * FROM findings WHERE id = ?", findingId);
    assert.equal(summarizeFinding(releasedStored as Finding).assignment, null);
  } finally {
    execute("DELETE FROM task_events WHERE task_run_id = ?", taskRunId);
    execute("DELETE FROM event_logs WHERE task_run_id = ?", taskRunId);
    execute("DELETE FROM findings WHERE id = ?", findingId);
    execute("DELETE FROM task_runs WHERE id = ?", taskRunId);
  }
});

test("finding assignment route claims and assigns with the authenticated user actor", async () => {
  const taskRunId = `task-${randomUUID()}`;
  const findingId = `finding-${randomUUID()}`;
  const userId = `user-${randomUUID()}`;
  const sessionToken = `session-token-${randomUUID()}`;
  const email = "mei@example.test";

  try {
    insertTaskRun(taskRunId);
    insertAuthSession({
      userId,
      sessionToken,
      email,
      name: "Mei Reviewer",
    });
    upsertFinding({
      id: findingId,
      taskRunId,
      sourceAgent: "test",
      category: "code_review",
      severity: "high",
      confidence: 1,
      title: "Route assignable finding",
      description: "Example description",
      evidenceJson: { file_path: "src/route.ts", line_start: 11 },
      recommendation: "Claim the example.",
      status: "open",
      publicationJson: { channels: [] },
    });

    const response = await postFindingAssignment(
      new Request(`http://agentworld.test/api/task-runs/${taskRunId}/findings/${findingId}/assignment`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: `agentworld_session=${encodeURIComponent(sessionToken)}`,
        },
        body: JSON.stringify({ action: "claim" }),
      }),
      { params: Promise.resolve({ id: taskRunId, findingId }) },
    );

    assert.equal(response.status, 200);
    const stored = queryOne<Finding>("SELECT * FROM findings WHERE id = ?", findingId);
    const publication = JSON.parse(stored?.publicationJson ?? "{}") as {
      assignment?: { assignedTo?: string; assignedBy?: string };
    };
    assert.equal(publication.assignment?.assignedTo, email);
    assert.equal(publication.assignment?.assignedBy, email);

    const teammate = "teammate@example.test";
    const assignResponse = await postFindingAssignment(
      new Request(`http://agentworld.test/api/task-runs/${taskRunId}/findings/${findingId}/assignment`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: `agentworld_session=${encodeURIComponent(sessionToken)}`,
        },
        body: JSON.stringify({ assignedTo: teammate }),
      }),
      { params: Promise.resolve({ id: taskRunId, findingId }) },
    );

    assert.equal(assignResponse.status, 200);
    const assignedStored = queryOne<Finding>("SELECT * FROM findings WHERE id = ?", findingId);
    const assignedPublication = JSON.parse(assignedStored?.publicationJson ?? "{}") as {
      assignment?: { assignedTo?: string; assignedBy?: string };
      assignmentHistory?: Array<{ assignedTo?: string | null; updatedBy?: string }>;
    };
    assert.equal(assignedPublication.assignment?.assignedTo, teammate);
    assert.equal(assignedPublication.assignment?.assignedBy, email);
    assert.equal(assignedPublication.assignmentHistory?.at(-1)?.assignedTo, teammate);
    assert.equal(assignedPublication.assignmentHistory?.at(-1)?.updatedBy, email);
  } finally {
    execute("DELETE FROM task_events WHERE task_run_id = ?", taskRunId);
    execute("DELETE FROM event_logs WHERE task_run_id = ?", taskRunId);
    execute("DELETE FROM findings WHERE id = ?", findingId);
    execute("DELETE FROM task_runs WHERE id = ?", taskRunId);
    execute("DELETE FROM auth_sessions WHERE session_token = ?", sessionToken);
    execute("DELETE FROM identity_users WHERE id = ?", userId);
  }
});

test("finding assignment route requires an authenticated session", async () => {
  const taskRunId = `task-${randomUUID()}`;
  const findingId = `finding-${randomUUID()}`;

  const assignmentResponse = await postFindingAssignment(
    new Request(`http://agentworld.test/api/task-runs/${taskRunId}/findings/${findingId}/assignment`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "claim" }),
    }),
    { params: Promise.resolve({ id: taskRunId, findingId }) },
  );

  assert.equal(assignmentResponse.status, 401);
});

test("recordFindingFeedback updates finding metadata and appends a team event", async () => {
  const taskRunId = `task-${randomUUID()}`;
  const findingId = `finding-${randomUUID()}`;

  try {
    insertTaskRun(taskRunId);
    const finding = upsertFinding({
      id: findingId,
      taskRunId,
      sourceAgent: "test",
      category: "code_review",
      severity: "medium",
      confidence: 1,
      title: "Feedback target finding",
      description: "Example description",
      evidenceJson: { file_path: "src/feedback.ts", line_start: 4 },
      recommendation: "Review the example.",
      status: "open",
      publicationJson: { channels: [] },
    });
    assert.ok(finding);

    const result = await recordFindingFeedback({
      token: buildFindingFeedbackToken(finding),
      verdict: "inaccurate",
      note: "Generated from stale context.",
      sourceIp: "127.0.0.1",
      writeKnowledge: false,
    });

    assert.equal(result.verdict, "inaccurate");
    const stored = queryOne<Finding>("SELECT * FROM findings WHERE id = ?", findingId);
    assert.equal(stored?.status, "false_positive");
    const publication = JSON.parse(stored?.publicationJson ?? "{}") as {
      feedback?: { verdict?: string; note?: string | null; statusAfterFeedback?: string };
      feedbackHistory?: Array<{ verdict?: string; note?: string | null; statusAfterFeedback?: string }>;
    };
    assert.equal(publication.feedback?.verdict, "inaccurate");
    assert.equal(publication.feedbackHistory?.at(-1)?.note, "Generated from stale context.");
    assert.equal(publication.feedbackHistory?.at(-1)?.statusAfterFeedback, "false_positive");

    const feedback = queryOne<InspectionFeedback>(
      "SELECT * FROM inspection_feedback WHERE finding_id = ?",
      findingId,
    );
    assert.equal(feedback?.verdict, "inaccurate");

    const event = queryOne<EventLog>(
      "SELECT * FROM event_logs WHERE task_run_id = ? AND phase = ?",
      taskRunId,
      "finding_feedback_recorded",
    );
    assert.equal(event?.foldGroup, "Team Actions");
    assert.match(event?.metadataJson ?? "", /false_positive/);
  } finally {
    execute("DELETE FROM task_events WHERE task_run_id = ?", taskRunId);
    execute("DELETE FROM event_logs WHERE task_run_id = ?", taskRunId);
    execute("DELETE FROM inspection_feedback WHERE finding_id = ?", findingId);
    execute("DELETE FROM findings WHERE id = ?", findingId);
    execute("DELETE FROM task_runs WHERE id = ?", taskRunId);
  }
});

test("buildFindingTriageQueue prioritizes active high-risk findings", () => {
  const taskRun = {
    id: "run-1",
    businessTeamId: "business-1",
    teamId: "team-1",
    blueprintId: "blueprint-1",
    sourceType: "manual",
    sourceRef: "daily-cleancode",
    status: "completed",
  } as TaskRun;
  const businessTeam = { id: "business-1", name: "Platform" } as BusinessTeam;
  const team = { id: "team-1", name: "Code Shield" } as AgentTeam;
  const blueprint = { id: "blueprint-1", name: "Daily CleanCode" } as TaskBlueprint;
  const lowFinding = {
    id: "finding-low",
    taskRunId: taskRun.id,
    title: "Low risk",
    category: "cleancode",
    severity: "low",
    status: "open",
    evidenceJson: JSON.stringify({ file_path: "src/low.ts", line_start: 2 }),
    recommendation: "Fix later.",
    createdAt: "2026-01-01T00:00:00.000Z",
  } as Finding;
  const highFinding = {
    ...lowFinding,
    id: "finding-high",
    title: "High risk",
    severity: "high",
    evidenceJson: JSON.stringify({ file_path: "src/high.ts", line_start: 5 }),
    createdAt: "2026-01-01T00:00:01.000Z",
  } as Finding;
  const fixedFinding = {
    ...lowFinding,
    id: "finding-fixed",
    status: "fixed",
  } as Finding;
  const assignedHighFinding = {
    ...highFinding,
    publicationJson: JSON.stringify({
      assignment: {
        assignedTo: "mei",
        assignedBy: "reviewer",
        assignedAt: "2026-01-01T00:00:02.000Z",
      },
      remediation: {
        taskRunId: "remediation-run-1",
        createdBy: "mei",
        createdAt: "2026-01-01T00:00:03.000Z",
      },
    }),
  } as Finding;

  try {
    execute("DELETE FROM inspection_feedback WHERE finding_id IN (?, ?)", highFinding.id, lowFinding.id);
    execute(
      "INSERT INTO inspection_feedback (id, finding_id, inspection_id, token, verdict, note, source_ip, knowledge_uri, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
      "feedback-high",
      highFinding.id,
      taskRun.id,
      "token-high",
      "inaccurate",
      "Known false positive.",
      null,
      "agentworld://knowledge/feedback/finding-high",
      "2026-01-01T00:01:00.000Z",
    );

    const queue = buildFindingTriageQueue({
      findings: [lowFinding, fixedFinding, assignedHighFinding],
      taskRuns: [taskRun],
      businessTeams: [businessTeam],
      teams: [team],
      blueprints: [blueprint],
    });

    assert.deepEqual(queue.map((item) => item.id), ["finding-high", "finding-low"]);
    assert.equal(queue[0]?.businessTeamName, "Platform");
    assert.equal(queue[0]?.agentTeamName, "Code Shield");
    assert.equal(queue[0]?.blueprintName, "Daily CleanCode");
    assert.equal(queue[0]?.location, "src/high.ts:5");
    assert.match(queue[0]?.feedbackPath ?? "", /^\/finding-feedback\/v2\.finding-high\.[a-f0-9]{64}$/);
    assert.equal(queue[0]?.latestFeedback?.verdict, "inaccurate");
    assert.equal(queue[0]?.latestFeedback?.knowledgeUri, "agentworld://knowledge/feedback/finding-high");
    assert.equal(queue[0]?.assignment?.assignedTo, "mei");
    assert.equal(queue[0]?.remediation?.taskRunId, "remediation-run-1");
    assert.equal(queue[1]?.latestFeedback, null);
    const highSummary = summarizeFinding(assignedHighFinding);
    assert.match(highSummary.feedbackPath, /^\/finding-feedback\/v2\.finding-high\.[a-f0-9]{64}$/);
    assert.equal(highSummary.latestFeedback?.verdict, "inaccurate");
    assert.equal(highSummary.assignment?.assignedTo, "mei");
    assert.equal(highSummary.remediation?.taskRunId, "remediation-run-1");
  } finally {
    execute("DELETE FROM inspection_feedback WHERE finding_id IN (?, ?)", highFinding.id, lowFinding.id);
  }
});

test("buildFindingOwnerBoard groups owner load and SLA risk", () => {
  const taskRun = {
    id: "run-owner-board",
    businessTeamId: "business-owner-board",
    teamId: "team-owner-board",
    blueprintId: "blueprint-owner-board",
    sourceType: "manual",
    sourceRef: "daily-cleancode",
    status: "completed",
  } as TaskRun;
  const businessTeam = { id: "business-owner-board", name: "Platform" } as BusinessTeam;
  const team = { id: "team-owner-board", name: "Code Shield" } as AgentTeam;
  const blueprint = { id: "blueprint-owner-board", name: "Daily CleanCode" } as TaskBlueprint;
  const unassignedCritical = {
    id: "finding-unassigned-critical",
    taskRunId: taskRun.id,
    title: "Unassigned critical cleanup",
    category: "security",
    severity: "critical",
    status: "open",
    evidenceJson: JSON.stringify({ file_path: "src/critical.ts", line_start: 8 }),
    recommendation: "Assign immediately.",
    publicationJson: JSON.stringify({ channels: [] }),
    createdAt: "2026-01-01T00:00:00.000Z",
  } as Finding;
  const assignedMedium = {
    ...unassignedCritical,
    id: "finding-assigned-medium",
    title: "Assigned medium cleanup",
    severity: "medium",
    evidenceJson: JSON.stringify({ file_path: "src/medium.ts", line_start: 12 }),
    publicationJson: JSON.stringify({
      assignment: {
        assignedTo: "mei@example.test",
        assignedBy: "reviewer",
        assignedAt: "2026-01-02T00:00:00.000Z",
      },
    }),
    createdAt: "2026-01-02T00:00:00.000Z",
  } as Finding;
  const fixedFinding = {
    ...unassignedCritical,
    id: "finding-fixed-owner-board",
    status: "fixed",
  } as Finding;

  const board = buildFindingOwnerBoard({
    findings: [assignedMedium, fixedFinding, unassignedCritical],
    taskRuns: [taskRun],
    businessTeams: [businessTeam],
    teams: [team],
    blueprints: [blueprint],
    now: new Date("2026-01-02T12:00:00.000Z"),
  });

  assert.equal(board.length, 2);
  assert.equal(board[0]?.isUnassigned, true);
  assert.equal(board[0]?.total, 1);
  assert.equal(board[0]?.highRisk, 1);
  assert.equal(board[0]?.overdue, 1);
  assert.equal(board[0]?.nextDueAt, "2026-01-01T04:00:00.000Z");
  assert.equal(board[0]?.sampleFindings[0]?.location, "src/critical.ts:8");
  assert.equal(board[0]?.sampleFindings[0]?.businessTeamName, "Platform");
  assert.equal(board[0]?.sampleFindings[0]?.agentTeamName, "Code Shield");
  assert.equal(board[0]?.sampleFindings[0]?.blueprintName, "Daily CleanCode");
  assert.equal(board[1]?.ownerLabel, "mei@example.test");
  assert.equal(board[1]?.total, 1);
  assert.equal(board[1]?.overdue, 0);
  assert.equal(board[1]?.nextDueAt, "2026-01-05T00:00:00.000Z");
});

test("buildFindingRemediationTaskInput keeps source finding context", () => {
  const taskRun = {
    id: "run-remediation",
    sourceRef: "daily-cleancode",
  } as TaskRun;
  const finding = {
    id: "finding-remediation",
    title: "High risk cleanup",
    category: "cleancode",
    severity: "high",
    status: "open",
    description: "A cleanup item needs attention.",
    recommendation: "Create a focused cleanup task.",
    evidenceJson: JSON.stringify({ file_path: "src/example.ts", line_start: 7 }),
  } as Finding;

  const input = buildFindingRemediationTaskInput({ finding, sourceTaskRun: taskRun });

  assert.equal(input.idempotencyKey, "finding-remediation:finding-remediation");
  assert.equal(input.priority, 95);
  assert.equal(input.inputPayload.sourceFindingId, finding.id);
  assert.deepEqual(input.inputPayload.finding.evidence, {
    file_path: "src/example.ts",
    line_start: 7,
  });
});
