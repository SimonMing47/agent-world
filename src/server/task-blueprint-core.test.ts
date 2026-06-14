import assert from "node:assert/strict";
import test from "node:test";
import {
  assertTaskBlueprintReadiness,
  buildTaskBlueprintReadiness,
  TaskBlueprintReadinessError,
} from "@/server/task-blueprint-core";
import {
  type Agent,
  type AgentTeam,
  type CodebaseProfile,
  type ExecutionEnvironment,
  type ProviderAdapterDefinition,
  type TaskBlueprint,
  type TaskRun,
} from "@/server/db";

function blueprint(overrides: Partial<TaskBlueprint> = {}) {
  return {
    id: "blueprint-ready",
    name: "Code Shield",
    category: "software_delivery",
    visibility: "team",
    ownerBusinessTeamId: "business-1",
    teamId: "team-1",
    environmentId: "environment-1",
    providerAdapterId: "builtin-agent-runtime",
    version: 1,
    status: "active",
    triggerJson: JSON.stringify({ type: "manual" }),
    inputSchemaJson: JSON.stringify({ type: "object", properties: {} }),
    environmentSelectorJson: JSON.stringify({
      type: "repository_workspace",
      codebaseScope: { mode: "selected", codebaseIds: ["codebase-1"] },
    }),
    agentTeamRunPlanJson: JSON.stringify({
      strategy: "block_graph",
      blocks: [{ id: "scan", type: "plugin_tool" }],
    }),
    memoryPolicyJson: "{}",
    providerPolicyJson: "{}",
    permissionPolicyJson: JSON.stringify({
      defaultMode: "ask",
      rules: [{ effect: "allow", resource: "repo.read", scope: "*" }],
    }),
    resultSchemaJson: "{}",
    outputPolicyJson: JSON.stringify({
      publishers: [{ type: "dashboard" }],
      findingFeedback: { enabled: true },
    }),
    dashboardPolicyJson: "{}",
    executionPolicyJson: "{}",
    archivePolicyJson: "{}",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  } satisfies TaskBlueprint;
}

const team = { id: "team-1" } as AgentTeam;
const environment = { id: "environment-1" } as ExecutionEnvironment;
const provider = { id: "builtin-agent-runtime" } as ProviderAdapterDefinition;
const codebase = { id: "codebase-1" } as CodebaseProfile;
const taskRun = { blueprintId: "blueprint-ready" } as TaskRun;
const agent = { id: "agent-1", teamId: "team-1" } as Agent;

test("buildTaskBlueprintReadiness marks a configured task definition ready", () => {
  const readiness = buildTaskBlueprintReadiness({
    blueprint: blueprint(),
    teams: [team],
    environments: [environment],
    providerAdapters: [provider],
    codebases: [codebase],
    taskRuns: [taskRun],
  });

  assert.equal(readiness.status, "ready");
  assert.equal(readiness.score, 100);
  assert.equal(readiness.blockerCount, 0);
  assert.equal(readiness.warningCount, 0);
});

test("buildTaskBlueprintReadiness accepts software-team block graph presets with selected codebase scope", () => {
  const readiness = buildTaskBlueprintReadiness({
    blueprint: blueprint({
      id: "blueprint-software-team",
      name: "Daily CleanCode Cleanup",
      triggerJson: JSON.stringify({ type: "cron", expression: "0 9 * * 1-5" }),
      agentTeamRunPlanJson: JSON.stringify({
        strategy: "block_graph",
        leader: "agent-1",
        blocks: [
          {
            id: "scan_cleancode_alerts",
            type: "plugin_tool",
            agentId: "agent-1",
            tool: "plugin.tool",
            pluginRef: "official.software_team.tool_bundle",
            toolRef: "software_team.cleancode.local_scan",
          },
          {
            id: "summarize_cleanup_queue",
            type: "agent",
            agentId: "agent-1",
            dependsOn: ["scan_cleancode_alerts"],
            tool: "memory.retrieve",
          },
        ],
      }),
    }),
    teams: [team],
    agents: [agent],
    environments: [environment],
    providerAdapters: [provider],
    codebases: [codebase],
    taskRuns: [{ blueprintId: "blueprint-software-team" } as TaskRun],
  });

  assert.equal(readiness.status, "ready");
  assert.ok(readiness.checks.some((check) => check.id === "run_plan" && check.status === "ok"));
  assert.ok(readiness.checks.some((check) => check.id === "codebase_scope" && check.status === "ok"));
});

test("buildTaskBlueprintReadiness blocks missing run graph and invalid selected codebase scope", () => {
  const readiness = buildTaskBlueprintReadiness({
    blueprint: blueprint({
      status: "draft",
      triggerJson: JSON.stringify({ type: "webhook" }),
      environmentSelectorJson: JSON.stringify({
        codebaseScope: { mode: "selected", codebaseIds: ["missing-codebase"] },
      }),
      agentTeamRunPlanJson: "{}",
      permissionPolicyJson: JSON.stringify({ defaultMode: "ask", rules: [] }),
      outputPolicyJson: JSON.stringify({ publishers: [] }),
    }),
    teams: [team],
    environments: [],
    providerAdapters: [],
    codebases: [codebase],
    taskRuns: [],
  });

  assert.equal(readiness.status, "blocked");
  assert.ok(readiness.score < 100);
  assert.ok(readiness.checks.some((check) => check.id === "active" && check.status === "blocker"));
  assert.ok(readiness.checks.some((check) => check.id === "trigger" && check.status === "blocker"));
  assert.ok(readiness.checks.some((check) => check.id === "run_plan" && check.status === "blocker"));
  assert.ok(readiness.checks.some((check) => check.id === "codebase_scope" && check.status === "blocker"));
});

test("buildTaskBlueprintReadiness blocks run graphs that cannot resolve executable nodes", () => {
  const readiness = buildTaskBlueprintReadiness({
    blueprint: blueprint({
      agentTeamRunPlanJson: JSON.stringify({
        strategy: "block_graph",
        leader: "missing-agent",
        blocks: [{ id: "scan", type: "plugin_tool" }],
      }),
    }),
    teams: [team],
    agents: [agent],
    environments: [environment],
    providerAdapters: [provider],
    codebases: [codebase],
    taskRuns: [taskRun],
  });

  assert.equal(readiness.status, "blocked");
  assert.ok(readiness.checks.some((check) => check.id === "run_plan" && check.status === "blocker"));
});

test("assertTaskBlueprintReadiness throws structured blocker details", () => {
  const readiness = buildTaskBlueprintReadiness({
    blueprint: blueprint({ status: "draft", agentTeamRunPlanJson: "{}" }),
    teams: [team],
    agents: [agent],
    environments: [environment],
    providerAdapters: [provider],
    codebases: [codebase],
    taskRuns: [],
  });

  assert.throws(
    () => assertTaskBlueprintReadiness(readiness),
    (error) => {
      assert.ok(error instanceof TaskBlueprintReadinessError);
      assert.ok(error.blockerChecks.some((check) => check.id === "active"));
      assert.ok(error.blockerChecks.some((check) => check.id === "run_plan"));
      assert.ok(error.message.length > 0);
      return true;
    },
  );
});
