import assert from "node:assert/strict";
import { test } from "node:test";
import {
  buildExecutablePluginRegistry,
  listExecutablePluginContributions,
  resolveOutputPublisher,
  resolveRepositoryConnector,
  resolveSecretRef,
  resolveToolBundle,
  type ExecutablePluginModule,
} from "@/server/plugin-sdk-core";

function createPluginModule(id: string): ExecutablePluginModule {
  return {
    manifest: {
      apiVersion: "agentworld.io/v1",
      kind: "AgentWorldPlugin",
      metadata: {
        id,
        name: id,
        version: "1.0.0",
      },
      spec: {
        runtime: {
          type: "node",
          entry: "dist/index.js",
        },
        permissions: {
          requested: [],
        },
        contributions: {
          repositoryConnectors: [{ id: `${id}.repo` }],
          toolBundles: [{ id: `${id}.tools` }],
        },
      },
    },
    repositoryConnectors: [{ id: `${id}.repo` }],
    toolBundles: [
      {
        id: `${id}.tools`,
        tools: [],
        async executeTool() {
          return {};
        },
      },
    ],
  };
}

test("executable plugin registry indexes declared contributions", () => {
  const registry = buildExecutablePluginRegistry([createPluginModule("test.plugin")]);

  assert.deepEqual(registry.diagnostics, []);
  assert.equal(registry.contributions.length, 2);
  assert.deepEqual(
    registry.contributions.map((record) => `${record.kind}:${record.id}`).sort(),
    ["repositoryConnector:test.plugin.repo", "toolBundle:test.plugin.tools"],
  );
});

test("runtime resolvers use contribution registry semantics", () => {
  assert.ok(resolveRepositoryConnector("official.gitea"));
  assert.ok(resolveToolBundle("official.gitea"));
  assert.equal(resolveOutputPublisher("official.gitea"), null);
  assert.ok(
    listExecutablePluginContributions("webhookParser").some(
      (record) => record.pluginId === "official.gitea",
    ),
  );
});

test("plugin secret refs reject environment variable references", () => {
  assert.equal(resolveSecretRef("direct-configured-secret"), "direct-configured-secret");
  assert.equal(resolveSecretRef("  direct-configured-secret  "), "direct-configured-secret");
  assert.equal(resolveSecretRef(""), null);
  assert.throws(() => resolveSecretRef("env:THIRD_PARTY_TOKEN"), /env:/);
});
