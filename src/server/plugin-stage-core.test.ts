import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { execute, queryOne, type Finding, type TaskBlueprint, type TaskRun } from "@/server/db";
import { executePluginStage, renderPayloadTemplate } from "@/server/plugin-stage-core";

test("renderPayloadTemplate preserves exact placeholder JSON values", () => {
  const payload = renderPayloadTemplate(
    JSON.stringify({
      repo_id: "${taskRun.input.repo_id}",
      changed_files: "${taskRun.input.changed_files}",
      metadata: "${taskRun.input.metadata}",
      label: "review:${taskRun.input.repo_id}",
    }),
    {
      taskRun: {
        input: {
          repo_id: "agentworld/app",
          changed_files: [{ filename: "src/review.ts", patch: "+const value = 1;" }],
          metadata: { source: "webhook", count: 1 },
        },
      },
    },
  );

  assert.equal(payload.repo_id, "agentworld/app");
  assert.deepEqual(payload.changed_files, [{ filename: "src/review.ts", patch: "+const value = 1;" }]);
  assert.deepEqual(payload.metadata, { source: "webhook", count: 1 });
  assert.equal(payload.label, "review:agentworld/app");
});

test("executePluginStage passes typed MR changed files into the Gitea rule scanner", async () => {
  const taskRunId = `task-${randomUUID()}`;
  const now = new Date().toISOString();
  const taskRun = {
    id: taskRunId,
    tenantSpaceId: "tenant-test",
    businessTeamId: "business-test",
    teamId: "team-test",
    blueprintId: "blueprint-test",
    blueprintVersion: 1,
    idempotencyKey: "mr-42",
    parentTaskRunId: null,
    runState: "running",
    environmentSnapshotId: null,
    permissionSnapshotJson: JSON.stringify({
      rules: [
        { effect: "allow", resource: "repo.read", scope: "*" },
        { effect: "allow", resource: "tool.finding.create", scope: "task_run" },
      ],
    }),
    agentTeamRunPlanJson: "{}",
    executionPolicyJson: "{}",
    accessGrantId: null,
    sourceType: "webhook",
    sourceRef: "mr-42",
    status: "running",
    priority: 80,
    inputPayloadJson: JSON.stringify({
      repo_id: "agentworld/app",
      pull_request_index: "42",
      changed_files: [{ filename: "src/review.ts", patch: "+const payload: " + "any = {};" }],
    }),
    outputPayloadJson: null,
    costEstimate: 0,
    costActual: 0,
    traceId: `trace-${taskRunId}`,
    requestedBy: "test",
    createdAt: now,
    completedAt: null,
  } satisfies TaskRun;
  const blueprint = {
    id: "blueprint-test",
    name: "Code Shield",
    category: "software_delivery",
    visibility: "team",
    ownerBusinessTeamId: "business-test",
    teamId: "team-test",
    environmentId: null,
    providerAdapterId: "builtin-agent-runtime",
    version: 1,
    status: "active",
    triggerJson: "{}",
    inputSchemaJson: "{}",
    environmentSelectorJson: "{}",
    agentTeamRunPlanJson: "{}",
    memoryPolicyJson: "{}",
    providerPolicyJson: "{}",
    permissionPolicyJson: "{}",
    resultSchemaJson: "{}",
    outputPolicyJson: "{}",
    dashboardPolicyJson: "{}",
    executionPolicyJson: "{}",
    archivePolicyJson: "{}",
    createdAt: now,
    updatedAt: now,
  } satisfies TaskBlueprint;

  try {
    const result = await executePluginStage({
      blockType: "plugin_tool",
      pluginRef: "official.gitea.tool_bundle",
      toolRef: "gitea.pull_request.rule_scan",
      payloadTemplate: JSON.stringify({
        repo_id: "${taskRun.input.repo_id}",
        pull_request_index: "${taskRun.input.pull_request_index}",
        changed_files: "${taskRun.input.changed_files}",
        rules: [
          {
            id: "mr.any_type",
            category: "code_review",
            severity: "medium",
            title: "Loose type assertion",
            description: "The review found a loose type.",
            recommendation: "Replace the loose type with a narrower contract.",
            lineRegex: "\\bany\\b",
            knowledgeRefs: ["cleancode"],
          },
        ],
      }),
      taskRun,
      blueprint,
      environmentSnapshot: null,
      nodeInput: {},
    });

    assert.equal(result.status, "completed");
    assert.ok("payload" in result);
    assert.equal(result.payload.createdCount, 1);
    const finding = queryOne<Finding>("SELECT * FROM findings WHERE task_run_id = ?", taskRunId);
    assert.equal(finding?.category, "code_review");
    assert.ok(finding?.evidenceJson.includes("src/review.ts"));
  } finally {
    execute("DELETE FROM task_events WHERE task_run_id = ?", taskRunId);
    execute("DELETE FROM event_logs WHERE task_run_id = ?", taskRunId);
    execute("DELETE FROM findings WHERE task_run_id = ?", taskRunId);
  }
});

test("executePluginStage runs Code Shield local scan and creates security findings", async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "agentworld-code-shield-stage-"));
  const taskRunId = `task-${randomUUID()}`;
  const now = new Date().toISOString();
  const taskRun = {
    id: taskRunId,
    tenantSpaceId: "tenant-test",
    businessTeamId: "business-test",
    teamId: "team-test",
    blueprintId: "blueprint-code-shield",
    blueprintVersion: 1,
    idempotencyKey: "code-shield",
    parentTaskRunId: null,
    runState: "running",
    environmentSnapshotId: null,
    permissionSnapshotJson: JSON.stringify({
      rules: [
        { effect: "allow", resource: "repo.read", scope: "*" },
        { effect: "allow", resource: "tool.finding.create", scope: "task_run" },
      ],
    }),
    agentTeamRunPlanJson: "{}",
    executionPolicyJson: "{}",
    accessGrantId: null,
    sourceType: "schedule",
    sourceRef: "code-shield",
    status: "running",
    priority: 80,
    inputPayloadJson: JSON.stringify({}),
    outputPayloadJson: null,
    costEstimate: 0,
    costActual: 0,
    traceId: `trace-${taskRunId}`,
    requestedBy: "test",
    createdAt: now,
    completedAt: null,
  } satisfies TaskRun;
  const blueprint = {
    id: "blueprint-code-shield",
    name: "Code Shield",
    category: "software_delivery",
    visibility: "team",
    ownerBusinessTeamId: "business-test",
    teamId: "team-test",
    environmentId: null,
    providerAdapterId: "builtin-agent-runtime",
    version: 1,
    status: "active",
    triggerJson: "{}",
    inputSchemaJson: "{}",
    environmentSelectorJson: "{}",
    agentTeamRunPlanJson: "{}",
    memoryPolicyJson: "{}",
    providerPolicyJson: "{}",
    permissionPolicyJson: "{}",
    resultSchemaJson: "{}",
    outputPolicyJson: "{}",
    dashboardPolicyJson: "{}",
    executionPolicyJson: "{}",
    archivePolicyJson: "{}",
    createdAt: now,
    updatedAt: now,
  } satisfies TaskBlueprint;

  try {
    fs.mkdirSync(path.join(root, "src"), { recursive: true });
    fs.writeFileSync(
      path.join(root, "src", "secrets.ts"),
      "const token = \"shh_1234567890\";\n",
    );

    const result = await executePluginStage({
      blockType: "plugin_tool",
      pluginRef: "official.software_team.tool_bundle",
      toolRef: "software_team.code_shield.local_scan",
      payloadTemplate: JSON.stringify({
        workspacePath: root,
        maxFiles: 20,
        maxFindings: 10,
      }),
      taskRun,
      blueprint,
      environmentSnapshot: null,
      nodeInput: {},
    });

    assert.equal(result.status, "completed");
    assert.ok("payload" in result);
    assert.equal(result.payload.createdCount, 1);
    const finding = queryOne<Finding>("SELECT * FROM findings WHERE task_run_id = ?", taskRunId);
    assert.equal(finding?.category, "security");
    assert.equal(finding?.sourceAgent, "software-team-code-shield");
  } finally {
    execute("DELETE FROM task_events WHERE task_run_id = ?", taskRunId);
    execute("DELETE FROM event_logs WHERE task_run_id = ?", taskRunId);
    execute("DELETE FROM findings WHERE task_run_id = ?", taskRunId);
    fs.rmSync(root, { recursive: true, force: true });
  }
});
