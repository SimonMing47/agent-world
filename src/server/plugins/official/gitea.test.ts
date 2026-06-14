import assert from "node:assert/strict";
import test from "node:test";
import { giteaExecutablePlugin } from "@/server/plugins/official/gitea";
import type { PluginRuntimeContext } from "@/server/plugin-sdk-core";

function createContext() {
  const findings: Record<string, unknown>[] = [];
  const events: Array<{ type: string; payload: Record<string, unknown> }> = [];
  const permissions: Array<{ resource: string; scope?: string }> = [];
  const ctx: PluginRuntimeContext = {
    pluginId: "official.gitea",
    configuration: {},
    async readTaskContext() {
      return {};
    },
    async readEnvironment() {
      return {};
    },
    async resolveSecretRef() {
      return null;
    },
    async requestPermission(input) {
      permissions.push(input);
      return { effect: "allow" };
    },
    async emitEvent(event) {
      events.push(event);
    },
    async createFinding(input) {
      findings.push(input);
      return `finding-${findings.length}`;
    },
    async createArtifact() {
      return "artifact-1";
    },
  };

  return { ctx, findings, events, permissions };
}

test("gitea pull request rule scan accepts inline changed files", async () => {
  const bundle = giteaExecutablePlugin.toolBundles?.find((candidate) => candidate.id === "official.gitea.tool_bundle");
  assert.ok(bundle);
  const { ctx, findings, events, permissions } = createContext();

  const result = await bundle.executeTool(
    "gitea.pull_request.rule_scan",
    {
      repo_id: "agentworld/app",
      pull_request_index: "42",
      diff_ref: "abc123",
      changed_files: [
        {
          filename: "src/review.ts",
          patch: [
            "+const payload: " + "any = {};",
            "+// TO" + "DO: remove temporary bypass",
          ].join("\n"),
          additions: 2,
        },
      ],
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
        {
          id: "mr.todo_marker",
          category: "code_review",
          severity: "low",
          title: "Temporary marker",
          description: "The review found temporary work.",
          recommendation: "Resolve the temporary marker before merging.",
          lineRegex: "\\bTO" + "DO\\b",
          knowledgeRefs: ["cleancode"],
        },
      ],
    },
    ctx,
  );

  assert.equal(result.status, "completed");
  assert.equal(result.createdCount, 2);
  assert.equal(findings.length, 2);
  assert.equal(findings[0]?.category, "code_review");
  assert.deepEqual(findings[0]?.knowledgeRefs, ["cleancode"]);
  assert.deepEqual(permissions, [{ resource: "repo.read", scope: "agentworld/app:42" }]);
  assert.equal(events.at(-1)?.type, "gitea_rule_scan_completed");
});

test("gitea pull request rule scan drafts when no files or connector config exist", async () => {
  const bundle = giteaExecutablePlugin.toolBundles?.find((candidate) => candidate.id === "official.gitea.tool_bundle");
  assert.ok(bundle);
  const { ctx, findings } = createContext();

  const result = await bundle.executeTool(
    "gitea.pull_request.rule_scan",
    {
      repo_id: "agentworld/app",
      pull_request_index: "42",
      rules: [{ id: "mr.any_type", lineRegex: "\\bany\\b" }],
    },
    ctx,
  );

  assert.equal(result.status, "drafted");
  assert.equal(result.createdCount, 0);
  assert.equal(findings.length, 0);
});
