import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import {
  buildFindingFeedbackToken,
  buildLegacyFindingFeedbackToken,
  parseFindingFeedbackToken,
} from "@/server/finding-feedback-token";
import { resolveFindingFeedbackToken } from "@/server/finding-feedback-core";
import { execute } from "@/server/db";

function nowIso() {
  return new Date().toISOString();
}

function insertTaskRun(id: string) {
  const now = nowIso();
  execute(
    "INSERT INTO task_runs (id, tenant_space_id, business_team_id, team_id, blueprint_id, blueprint_version, idempotency_key, parent_task_run_id, run_state, environment_snapshot_id, permission_snapshot_json, agent_team_run_plan_json, execution_policy_json, access_grant_id, source_type, source_ref, status, priority, input_payload_json, output_payload_json, cost_estimate, cost_actual, trace_id, requested_by, created_at, completed_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    id,
    `tenant-${id}`,
    `business-${id}`,
    `team-${id}`,
    null,
    1,
    `feedback-token-${id}`,
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

function insertFinding(args: {
  id: string;
  taskRunId: string;
  fingerprint: string;
  createdAt: string;
}) {
  execute(
    "INSERT INTO findings (id, task_run_id, source_agent, category, severity, confidence, title, description, evidence_json, recommendation, skill_refs_json, fingerprint, status, publication_json, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    args.id,
    args.taskRunId,
    "test",
    "code_review",
    "medium",
    1,
    "Signed feedback token target",
    "Example description",
    "{}",
    "Review the example.",
    "[]",
    args.fingerprint,
    "open",
    "{}",
    args.createdAt,
    args.createdAt,
  );
}

test("finding feedback token parser accepts only canonical signed token shapes", () => {
  const v2Token = `v2.finding.with.dot.${"a".repeat(64)}`;
  assert.deepEqual(parseFindingFeedbackToken(v2Token), {
    digest: "a".repeat(64),
    findingId: "finding.with.dot",
    normalized: v2Token,
    version: "v2",
  });

  const legacyToken = `finding.with.dot.${"b".repeat(32)}`;
  assert.deepEqual(parseFindingFeedbackToken(legacyToken), {
    digest: "b".repeat(32),
    findingId: "finding.with.dot",
    normalized: legacyToken,
    version: "legacy",
  });

  assert.equal(parseFindingFeedbackToken("v2.finding.short"), null);
  assert.equal(parseFindingFeedbackToken(`v2.finding.${"A".repeat(64)}`), null);
  assert.equal(parseFindingFeedbackToken(`finding.${"g".repeat(32)}`), null);
  assert.equal(parseFindingFeedbackToken("missing-separator"), null);
});

test("finding feedback tokens are signed v2 tokens with legacy verification compatibility", () => {
  const taskRunId = `task-${randomUUID()}`;
  const findingId = `finding-${randomUUID()}`;
  const createdAt = nowIso();
  const finding = {
    id: findingId,
    taskRunId,
    fingerprint: `fingerprint-${findingId}`,
    createdAt,
  };

  try {
    insertTaskRun(taskRunId);
    insertFinding(finding);

    const signedToken = buildFindingFeedbackToken(finding);
    assert.match(signedToken, new RegExp(`^v2\\.${findingId}\\.[a-f0-9]{64}$`));
    assert.equal(resolveFindingFeedbackToken(signedToken)?.finding.id, findingId);

    const legacyToken = buildLegacyFindingFeedbackToken(finding);
    assert.match(legacyToken, new RegExp(`^${findingId}\\.[a-f0-9]{32}$`));
    assert.equal(resolveFindingFeedbackToken(legacyToken)?.finding.id, findingId);

    const tamperedToken = signedToken.replace(/[a-f0-9]$/, (value) => (value === "0" ? "1" : "0"));
    assert.equal(resolveFindingFeedbackToken(tamperedToken), null);
  } finally {
    execute("DELETE FROM inspection_feedback WHERE finding_id = ?", findingId);
    execute("DELETE FROM findings WHERE id = ?", findingId);
    execute("DELETE FROM task_runs WHERE id = ?", taskRunId);
  }
});
