import assert from "node:assert/strict";
import { test } from "node:test";
import {
  openAiFunctionNamePattern,
  resolveWorkspaceToolPolicyNames,
  workspaceToolNames,
} from "@/server/workspace-tool-names";

test("workspace tool names are valid OpenAI function names", () => {
  const toolNames = Object.values(workspaceToolNames);
  assert.ok(toolNames.length > 0);

  for (const toolName of toolNames) {
    assert.match(toolName, openAiFunctionNamePattern);
  }
});

test("workspace tool policies accept legacy dotted knowledge tool names", () => {
  assert.deepEqual(resolveWorkspaceToolPolicyNames("memory_search"), ["memory_search", "memory.search"]);
  assert.deepEqual(resolveWorkspaceToolPolicyNames("memory_retrieve"), ["memory_retrieve", "memory.retrieve"]);
  assert.deepEqual(resolveWorkspaceToolPolicyNames("memory_read"), ["memory_read", "memory.read"]);
  assert.deepEqual(resolveWorkspaceToolPolicyNames("search_repo"), ["search_repo"]);
});
