import assert from "node:assert/strict";
import { test } from "node:test";
import { buildRepositoryNameAliases } from "@/lib/repository-identity";

test("buildRepositoryNameAliases includes owner repo and slug aliases", () => {
  const aliases = buildRepositoryNameAliases("https://gitea.local/sigmund/obsidian-articles.git");

  assert.ok(aliases.includes("sigmund/obsidian-articles"));
  assert.ok(aliases.includes("sigmund-obsidian-articles"));
  assert.ok(aliases.includes("obsidian-articles"));
});

test("buildRepositoryNameAliases handles ssh repository values", () => {
  const aliases = buildRepositoryNameAliases("git@gitea.local:sigmund/obsidian-articles.git");

  assert.ok(aliases.includes("sigmund/obsidian-articles"));
  assert.ok(aliases.includes("sigmund-obsidian-articles"));
});
