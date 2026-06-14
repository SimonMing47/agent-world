import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import {
  execute,
  queryAll,
  queryOne,
  type EventLog,
  type Finding,
  type TaskRun,
} from "@/server/db";
import { createFindingCleanupCampaignTaskRun } from "@/server/finding-cleanup-campaign-core";
import { upsertFinding } from "@/server/finding-core";

function nowIso() {
  return new Date().toISOString();
}

function insertExecutableTeam(id: string) {
  const now = nowIso();
  const tenantId = `tenant-${id}`;
  const businessTeamId = `business-${id}`;
  const teamId = `team-${id}`;
  const agentDefinitionId = `agent-definition-${id}`;
  const memberId = `member-${id}`;

  execute(
    "INSERT INTO tenant_spaces (id, slug, name, owner_user_id, status, quota_limit_json, model_whitelist_json, global_guardrails_json, default_execution_policy_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    tenantId,
    `tenant-${id}`,
    `Tenant ${id}`,
    "owner",
    "active",
    "{}",
    "[]",
    "{}",
    null,
    now,
  );
  execute(
    "INSERT INTO business_teams (id, tenant_space_id, parent_business_team_id, slug, name, description, owner_user_id, status, balance, credit_limit, private_tool_refs_json, private_memory_namespace, policy_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    businessTeamId,
    tenantId,
    null,
    `business-${id}`,
    `Business ${id}`,
    "",
    "owner",
    "active",
    0,
    0,
    "[]",
    `memory-${id}`,
    "{}",
    now,
  );
  execute(
    "INSERT INTO agent_teams (id, business_team_id, slug, name, description, leader_agent_id, workflow_type, orchestration_prompt, workflow_definition_json, input_schema_json, output_schema_json, max_concurrency, timeout_ms, success_rate_threshold, pricing_model_json, visibility, default_execution_policy_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    teamId,
    businessTeamId,
    `team-${id}`,
    `Cleanup Team ${id}`,
    "",
    null,
    "single",
    "",
    "{}",
    "{}",
    "{}",
    1,
    300000,
    0.9,
    "{}",
    "team",
    null,
    now,
    now,
  );
  execute(
    "INSERT INTO agent_definitions (id, tenant_space_id, owner_business_team_id, owner_user_id, source_agent_id, slug, name, role, description, system_prompt, model, default_provider_profile_id, default_runtime_binding_id, avatar_config_json, capability_profile_json, tool_bindings_json, harness_config_json, permission_policy_json, memory_scope, tags_json, visibility, status, validation_status, last_validated_at, last_validation_summary, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    agentDefinitionId,
    tenantId,
    businessTeamId,
    "owner",
    null,
    `cleanup-agent-${id}`,
    `Cleanup Agent ${id}`,
    "executor",
    "",
    "Review and clean up grouped code findings.",
    "test-model",
    null,
    null,
    "{}",
    "{}",
    "[]",
    "{}",
    "{}",
    "team",
    "[]",
    "team",
    "ready",
    "passed",
    now,
    "ok",
    now,
    now,
  );
  execute(
    "INSERT INTO agent_team_members (id, team_id, agent_definition_id, member_role, work_instruction, position, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
    memberId,
    teamId,
    agentDefinitionId,
    "executor",
    "Clean grouped findings.",
    1,
    "active",
    now,
    now,
  );

  return { tenantId, businessTeamId, teamId, agentDefinitionId, memberId };
}

function insertTaskRun(args: {
  id: string;
  tenantId: string;
  businessTeamId: string;
  teamId: string;
  sourceRef: string;
}) {
  const now = nowIso();
  execute(
    "INSERT INTO task_runs (id, tenant_space_id, business_team_id, team_id, blueprint_id, blueprint_version, idempotency_key, parent_task_run_id, run_state, environment_snapshot_id, permission_snapshot_json, agent_team_run_plan_json, execution_policy_json, access_grant_id, source_type, source_ref, status, priority, input_payload_json, output_payload_json, cost_estimate, cost_actual, trace_id, requested_by, created_at, completed_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    args.id,
    args.tenantId,
    args.businessTeamId,
    args.teamId,
    null,
    1,
    `source-${args.id}`,
    null,
    "completed",
    null,
    "{}",
    "{}",
    "{}",
    null,
    "manual",
    args.sourceRef,
    "completed",
    0,
    "{}",
    null,
    0,
    0,
    `trace-${args.id}`,
    "test",
    now,
    now,
  );
}

test("createFindingCleanupCampaignTaskRun creates an executable cleanup task and records source findings", () => {
  const id = randomUUID();
  const fixtures = insertExecutableTeam(id);
  const sourceTaskRunId = `task-${id}`;
  const highFindingId = `finding-high-${id}`;
  const criticalFindingId = `finding-critical-${id}`;
  const lowFindingId = `finding-low-${id}`;
  let cleanupTaskRunId = "";

  try {
    insertTaskRun({
      id: sourceTaskRunId,
      tenantId: fixtures.tenantId,
      businessTeamId: fixtures.businessTeamId,
      teamId: fixtures.teamId,
      sourceRef: "daily-cleancode",
    });
    upsertFinding({
      id: highFindingId,
      taskRunId: sourceTaskRunId,
      sourceAgent: "scan",
      category: "cleancode",
      severity: "high",
      confidence: 1,
      title: "High cleanup",
      description: "High risk cleanup.",
      evidenceJson: { file_path: "src/high.ts", line_start: 3 },
      recommendation: "Clean high risk.",
      status: "open",
      publicationJson: { channels: [] },
    });
    upsertFinding({
      id: criticalFindingId,
      taskRunId: sourceTaskRunId,
      sourceAgent: "scan",
      category: "security",
      severity: "critical",
      confidence: 1,
      title: "Critical cleanup",
      description: "Critical cleanup.",
      evidenceJson: { file_path: "src/critical.ts", line_start: 7 },
      recommendation: "Clean critical risk.",
      status: "open",
      publicationJson: { channels: [] },
    });
    upsertFinding({
      id: lowFindingId,
      taskRunId: sourceTaskRunId,
      sourceAgent: "scan",
      category: "cleancode",
      severity: "low",
      confidence: 1,
      title: "Low cleanup",
      description: "Low risk cleanup.",
      evidenceJson: { file_path: "src/low.ts", line_start: 9 },
      recommendation: "Clean later.",
      status: "open",
      publicationJson: { channels: [] },
    });

    const result = createFindingCleanupCampaignTaskRun({
      scope: "high_risk",
      limit: 5,
      teamId: fixtures.teamId,
      requestedBy: "lead@example.test",
    });

    assert.equal(result.created, true);
    assert.equal(result.findingCount, 2);
    assert.deepEqual(new Set(result.sourceFindingIds), new Set([highFindingId, criticalFindingId]));
    assert.ok(result.taskRun?.id);
    cleanupTaskRunId = result.taskRun?.id ?? "";

    const taskRun = queryOne<TaskRun>("SELECT * FROM task_runs WHERE id = ?", cleanupTaskRunId);
    assert.equal(taskRun?.teamId, fixtures.teamId);
    assert.equal(taskRun?.parentTaskRunId, sourceTaskRunId);
    assert.match(taskRun?.idempotencyKey ?? "", /^finding-cleanup-campaign:high_risk:/);
    const payload = JSON.parse(taskRun?.inputPayloadJson ?? "{}") as {
      cleanupCampaign?: {
        findingCount?: number;
        sourceFindingIds?: string[];
        findings?: Array<{ id?: string; location?: string | null }>;
      };
    };
    assert.equal(payload.cleanupCampaign?.findingCount, 2);
    assert.deepEqual(new Set(payload.cleanupCampaign?.sourceFindingIds), new Set([highFindingId, criticalFindingId]));
    assert.equal(payload.cleanupCampaign?.findings?.find((finding) => finding.id === criticalFindingId)?.location, "src/critical.ts:7");

    const nodes = queryAll("SELECT * FROM task_run_nodes WHERE task_run_id = ?", cleanupTaskRunId);
    assert.equal(nodes.length, 1);

    const storedHigh = queryOne<Finding>("SELECT * FROM findings WHERE id = ?", highFindingId);
    const highPublication = JSON.parse(storedHigh?.publicationJson ?? "{}") as {
      cleanupCampaign?: { taskRunId?: string; createdBy?: string };
    };
    assert.equal(highPublication.cleanupCampaign?.taskRunId, cleanupTaskRunId);
    assert.equal(highPublication.cleanupCampaign?.createdBy, "lead@example.test");

    const event = queryOne<EventLog>(
      "SELECT * FROM event_logs WHERE task_run_id = ? AND phase = ?",
      sourceTaskRunId,
      "cleanup_campaign_created",
    );
    assert.equal(event?.foldGroup, "Team Actions");
    assert.match(event?.metadataJson ?? "", /finding-high/);

    const duplicate = createFindingCleanupCampaignTaskRun({
      scope: "high_risk",
      limit: 5,
      teamId: fixtures.teamId,
      requestedBy: "lead@example.test",
    });
    assert.equal(duplicate.created, false);
    assert.equal(duplicate.taskRun?.id, cleanupTaskRunId);
  } finally {
    const taskRunIds = [sourceTaskRunId, cleanupTaskRunId].filter(Boolean);
    for (const taskRunId of taskRunIds) {
      execute("DELETE FROM task_events WHERE task_run_id = ?", taskRunId);
      execute("DELETE FROM event_logs WHERE task_run_id = ?", taskRunId);
      execute("DELETE FROM task_run_nodes WHERE task_run_id = ?", taskRunId);
      execute("DELETE FROM task_run_plans WHERE task_run_id = ?", taskRunId);
      execute("DELETE FROM task_runs WHERE id = ?", taskRunId);
    }
    execute("DELETE FROM findings WHERE id IN (?, ?, ?)", highFindingId, criticalFindingId, lowFindingId);
    execute("DELETE FROM agent_team_members WHERE id = ?", fixtures.memberId);
    execute("DELETE FROM agent_definitions WHERE id = ?", fixtures.agentDefinitionId);
    execute("DELETE FROM agent_teams WHERE id = ?", fixtures.teamId);
    execute("DELETE FROM business_teams WHERE id = ?", fixtures.businessTeamId);
    execute("DELETE FROM tenant_spaces WHERE id = ?", fixtures.tenantId);
  }
});
