import assert from "node:assert/strict";
import test from "node:test";
import type { TaskRun } from "@/server/db";
import { buildTeamActionQueue } from "@/server/team-action-queue-core";

function taskRun(overrides: Partial<TaskRun>): TaskRun {
  const id = overrides.id ?? "task-run-1";
  return {
    id,
    tenantSpaceId: "tenant-1",
    businessTeamId: "business-1",
    teamId: "agent-team-1",
    blueprintId: "blueprint-1",
    blueprintVersion: 1,
    idempotencyKey: `idempotency-${id}`,
    parentTaskRunId: null,
    runState: "running",
    environmentSnapshotId: null,
    permissionSnapshotJson: "{}",
    agentTeamRunPlanJson: "{}",
    executionPolicyJson: "{}",
    accessGrantId: null,
    sourceType: "manual",
    sourceRef: `MR ${id}`,
    status: "running",
    priority: 0,
    inputPayloadJson: "{}",
    outputPayloadJson: null,
    costEstimate: 0,
    costActual: 0,
    traceId: `trace-${id}`,
    requestedBy: "mei",
    createdAt: "2026-06-13T00:00:00.000Z",
    completedAt: null,
    ...overrides,
  };
}

test("buildTeamActionQueue prioritizes blocked runs before finding work", () => {
  const queue = buildTeamActionQueue({
    taskRuns: [
      taskRun({
        id: "run-blocked",
        status: "failed",
        runState: "failed",
        priority: 5,
        createdAt: "2026-06-13T00:01:00.000Z",
      }),
      taskRun({
        id: "run-running",
        status: "running",
        runState: "running",
        createdAt: "2026-06-13T00:02:00.000Z",
      }),
    ],
    taskRunWorkflowProgress: {
      "run-blocked": {
        percent: 40,
        currentStep: {
          id: "step-1",
          label: "Code shield scan",
          owner: "Guardian",
          status: "failed",
          kind: "model",
        },
      },
      "run-running": {
        percent: 60,
        currentStep: {
          id: "step-2",
          label: "MR review",
          owner: "Reviewer",
          status: "running",
          kind: "model",
        },
      },
    },
    findingTriageQueue: [
      {
        id: "finding-1",
        taskRunId: "run-running",
        title: "Critical SQL injection risk",
        severity: "critical",
        status: "open",
        businessTeamName: "Payments",
        agentTeamName: "Code Shield",
        blueprintName: "MR Review",
        createdAt: "2026-06-13T00:03:00.000Z",
        assignment: null,
        remediation: null,
      },
    ],
    findingOwnerBoard: [],
  });

  assert.equal(queue[0]?.kind, "blocked_run");
  assert.equal(queue[0]?.taskRunId, "run-blocked");
  assert.equal(queue[1]?.kind, "high_risk_finding");
  assert.equal(queue.some((item) => item.kind === "running_run"), true);
});

test("buildTeamActionQueue carries remediation state for assigned findings", () => {
  const queue = buildTeamActionQueue({
    taskRuns: [],
    taskRunWorkflowProgress: {},
    findingTriageQueue: [
      {
        id: "finding-remediated",
        taskRunId: "run-source",
        title: "Assigned SQL interpolation risk",
        severity: "high",
        status: "open",
        businessTeamName: "Payments",
        agentTeamName: "Code Shield",
        blueprintName: "MR Review",
        createdAt: "2026-06-13T00:03:00.000Z",
        assignment: { assignedTo: "mei@example.test" },
        remediation: {
          taskRunId: "run-remediation",
          createdBy: "mei@example.test",
          createdAt: "2026-06-13T00:04:00.000Z",
        },
      },
    ],
    findingOwnerBoard: [],
  });

  assert.equal(queue[0]?.kind, "high_risk_finding");
  assert.equal(queue[0]?.assignment?.assignedTo, "mei@example.test");
  assert.equal(queue[0]?.remediation?.taskRunId, "run-remediation");
});

test("buildTeamActionQueue creates gate and owner workload actions", () => {
  const queue = buildTeamActionQueue({
    taskRuns: [
      taskRun({
        id: "run-awaiting",
        status: "awaiting",
        runState: "waiting_approval",
        createdAt: "2026-06-13T00:01:00.000Z",
      }),
    ],
    taskRunWorkflowProgress: {
      "run-awaiting": {
        percent: 25,
        currentStep: {
          id: "step-approval",
          label: "Approve repository write",
          owner: "Human gate",
          status: "awaiting",
          kind: "harness",
        },
      },
    },
    findingTriageQueue: [],
    findingOwnerBoard: [
      {
        ownerKey: "__unassigned__",
        ownerLabel: "Unassigned",
        isUnassigned: true,
        total: 4,
        highRisk: 2,
        overdue: 1,
        nextDueAt: "2026-06-13T00:00:00.000Z",
        oldestCreatedAt: "2026-06-12T00:00:00.000Z",
        sampleFindings: [
          {
            id: "finding-unassigned",
            taskRunId: "run-awaiting",
            title: "Missing owner",
            severity: "high",
            overdue: true,
          },
        ],
      },
    ],
  });

  assert.equal(queue.some((item) => item.kind === "waiting_gate"), true);
  assert.equal(queue.some((item) => item.kind === "overdue_owner"), true);
  assert.equal(queue.some((item) => item.kind === "unassigned_owner"), true);
  assert.equal(queue.find((item) => item.kind === "waiting_gate")?.actionKey, "ui.taskRuns.actionQueue.actions.resolveGate");
});
