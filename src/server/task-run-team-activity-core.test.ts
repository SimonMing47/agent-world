import assert from "node:assert/strict";
import test from "node:test";
import type { EventLog } from "@/server/db";
import { buildTaskRunTeamActivity } from "@/server/task-run-team-activity-core";

function event(overrides: Partial<EventLog>): EventLog {
  return {
    id: overrides.id ?? `event-${overrides.seq ?? 1}`,
    traceId: "trace-team-activity",
    taskRunId: "task-team-activity",
    nodeId: null,
    seq: overrides.seq ?? 1,
    phase: overrides.phase ?? "planning",
    foldGroup: overrides.foldGroup ?? "Planning",
    title: overrides.title ?? "Planning",
    content: overrides.content ?? "Planning content",
    metadataJson: overrides.metadataJson ?? "{}",
    createdAt: overrides.createdAt ?? `2026-06-13T00:00:0${overrides.seq ?? 1}.000Z`,
  };
}

test("buildTaskRunTeamActivity summarizes recent team participation events", () => {
  const summary = buildTaskRunTeamActivity([
    event({ seq: 1, phase: "planning", foldGroup: "Planning" }),
    event({
      seq: 2,
      phase: "team_blocker_recorded",
      foldGroup: "Team Actions",
      title: "Blocker recorded",
      content: "Release owner must approve migration.",
      metadataJson: JSON.stringify({ createdBy: "mei" }),
    }),
    event({
      seq: 3,
      phase: "finding_assigned",
      foldGroup: "Team Actions",
      title: "Finding assigned",
      content: "Finding assigned to kai.",
      metadataJson: JSON.stringify({ updatedBy: "mei", findingId: "finding-1", assignedTo: "kai" }),
    }),
    event({
      seq: 4,
      phase: "team_handoff_recorded",
      foldGroup: "Team Actions",
      title: "Handoff recorded",
      content: "Kai owns the next cleanup pass.",
      metadataJson: JSON.stringify({ createdBy: "mei" }),
    }),
    event({
      seq: 5,
      phase: "approval_result",
      foldGroup: "Human Actions",
      title: "Intervention resolved",
      content: "Approved by release lead.",
      metadataJson: JSON.stringify({ resolvedBy: "release-lead", interventionId: "gate-1" }),
    }),
  ]);

  assert.equal(summary.totalCount, 4);
  assert.equal(summary.blockerCount, 1);
  assert.equal(summary.handoffCount, 1);
  assert.equal(summary.findingActionCount, 1);
  assert.equal(summary.gateActionCount, 1);
  assert.equal(summary.latestItem?.kind, "gate");
  assert.equal(summary.latestItem?.actor, "release-lead");
  assert.equal(summary.latestItem?.target, "gate-1");
  assert.equal(summary.latestHandoff?.content, "Kai owns the next cleanup pass.");
  assert.deepEqual(summary.items.map((item) => item.seq), [5, 4, 3, 2]);
});

test("buildTaskRunTeamActivity limits visible activity without losing aggregate counts", () => {
  const summary = buildTaskRunTeamActivity([
    event({ seq: 1, phase: "team_note_recorded", foldGroup: "Team Actions" }),
    event({ seq: 2, phase: "team_decision_recorded", foldGroup: "Team Actions" }),
    event({ seq: 3, phase: "cleanup_campaign_created", foldGroup: "Team Actions" }),
  ], { limit: 2 });

  assert.equal(summary.totalCount, 3);
  assert.equal(summary.decisionCount, 1);
  assert.equal(summary.items.length, 2);
  assert.deepEqual(summary.items.map((item) => item.kind), ["cleanup", "decision"]);
});
