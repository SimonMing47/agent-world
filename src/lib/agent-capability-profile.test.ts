import test from "node:test";
import assert from "node:assert/strict";

import {
  agentCapabilityDimensions,
  agentCapabilityWeapons,
  defaultAgentCapabilityProfile,
  deriveAgentCapabilityProfile,
  getAgentCapabilityWeapon,
  parseAgentCapabilityProfile,
  serializeAgentCapabilityProfile,
} from "./agent-capability-profile";

test("defaultAgentCapabilityProfile is deterministic and bounded", () => {
  const first = defaultAgentCapabilityProfile("seed-1");
  const second = defaultAgentCapabilityProfile("seed-1");
  assert.deepEqual(first, second);
  assert.equal(first.scores.length, agentCapabilityDimensions.length);
  first.scores.forEach((score) => {
    assert.ok(score.value >= 46 && score.value <= 84);
  });
});

test("parseAgentCapabilityProfile clamps scores and trims rationale", () => {
  const parsed = parseAgentCapabilityProfile(JSON.stringify({
    scores: [
      { key: "coding", value: 200 },
      { key: "memory", value: -5 },
      { key: "toolUse", value: "17.8" },
    ],
    rationale: ["1", "2", "3", "4", "5"],
  }), "parse-seed");

  const byKey = Object.fromEntries(parsed.scores.map((score) => [score.key, score.value]));
  assert.equal(byKey.coding, 100);
  assert.equal(byKey.memory, 0);
  assert.equal(byKey.toolUse, 18);
  assert.deepEqual(parsed.rationale, ["1", "2", "3", "4"]);
});

test("parseAgentCapabilityProfile falls back on invalid JSON", () => {
  const fallback = defaultAgentCapabilityProfile("fallback-seed");
  const parsed = parseAgentCapabilityProfile("{bad json}", "fallback-seed");
  assert.deepEqual(parsed, fallback);
});

test("serializeAgentCapabilityProfile outputs all dimensions with clamped values", () => {
  const serialized = serializeAgentCapabilityProfile({
    scores: [
      { key: "coding", label: "coding", value: 123 },
      { key: "review", label: "review", value: -3 },
    ],
    rationale: ["r1"],
  });

  const parsed = JSON.parse(serialized) as {
    scores: Array<{ key: string; value: number }>;
    rationale: string[];
  };

  assert.equal(parsed.scores.length, agentCapabilityDimensions.length);
  assert.equal(parsed.scores.find((score) => score.key === "coding")?.value, 100);
  assert.equal(parsed.scores.find((score) => score.key === "review")?.value, 0);
  assert.equal(parsed.scores.find((score) => score.key === "toolUse")?.value, 50);
  assert.deepEqual(parsed.rationale, ["r1"]);
});

test("getAgentCapabilityWeapon returns weapon for dominant capability", () => {
  const profile = {
    scores: agentCapabilityDimensions.map((dimension) => ({
      ...dimension,
      value: dimension.key === "review" ? 99 : 1,
    })),
  };

  const result = getAgentCapabilityWeapon(profile);
  assert.equal(result.capability.key, "review");
  assert.deepEqual(result.weapon, agentCapabilityWeapons.review);
});

test("deriveAgentCapabilityProfile no longer encodes role keyword rules", () => {
  const derived = deriveAgentCapabilityProfile({
    name: "Security Manager",
    role: "Architecture Review Leader",
    description: "Manage team collaboration and memory knowledge tasks.",
    systemPrompt: "Review code and enforce policy.",
    toolBindings: ["repo.read", "repo.write", "issue.create", "task.run"],
    memoryScope: "global",
    permissionPolicyJson: JSON.stringify({
      repositoryAccess: "read_only",
      memoryAccess: "team_shared",
      secretAccess: "none",
      allowedToolNames: ["a", "b", "c"],
      deniedToolNames: ["x"],
    }),
    harnessConfigJson: JSON.stringify({
      approvalMode: "manual",
      humanIntervention: "steer",
      thinkingLevel: "high",
      maxToolCalls: 12,
    }),
    tags: ["team", "handoff"],
    visibility: "team",
    status: "active",
  });

  assert.deepEqual(derived, defaultAgentCapabilityProfile("Security Manager"));
  assert.equal(derived.rationale, undefined);
});

test("deriveAgentCapabilityProfile tolerates malformed JSON fields", () => {
  const derived = deriveAgentCapabilityProfile({
    permissionPolicyJson: "{oops",
    harnessConfigJson: "{oops",
  });
  assert.equal(derived.scores.length, agentCapabilityDimensions.length);
});
