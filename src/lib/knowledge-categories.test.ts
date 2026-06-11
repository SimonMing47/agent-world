import assert from "node:assert/strict";
import { test } from "node:test";
import {
  isCodebaseKnowledgeCategory,
  isKnowledgeCategory,
  normalizeKnowledgeCategories,
  normalizeKnowledgeCategory,
} from "@/lib/knowledge-categories";

test("normalizes legacy knowledge categories to the new scope model", () => {
  assert.equal(normalizeKnowledgeCategory("skill"), "global");
  assert.equal(normalizeKnowledgeCategory("public"), "global");
  assert.equal(normalizeKnowledgeCategory("code"), "codebase");
  assert.equal(normalizeKnowledgeCategory("repository"), "codebase");
  assert.equal(normalizeKnowledgeCategory("domain"), "domain");
});

test("deduplicates comma-separated knowledge scopes", () => {
  assert.deepEqual(
    normalizeKnowledgeCategories(["skill,domain", "code", "codebase", "global"]),
    ["global", "domain", "codebase"],
  );
});

test("identifies codebase knowledge aliases", () => {
  assert.equal(isCodebaseKnowledgeCategory("codebase"), true);
  assert.equal(isCodebaseKnowledgeCategory("code"), true);
  assert.equal(isCodebaseKnowledgeCategory("repository"), true);
  assert.equal(isCodebaseKnowledgeCategory("domain"), false);
});

test("keeps canonical category checks separate from legacy aliases", () => {
  assert.equal(isKnowledgeCategory("global"), true);
  assert.equal(isKnowledgeCategory("codebase"), true);
  assert.equal(isKnowledgeCategory("skill"), false);
  assert.equal(isKnowledgeCategory("code"), false);
});
