import assert from "node:assert/strict";
import { test } from "node:test";
import {
  normalizeKnowledgeImportContent,
  stripDuplicateKnowledgeImportHeading,
} from "@/lib/knowledge-import-content";

test("normalizeKnowledgeImportContent collapses repeated blank lines outside code fences", () => {
  assert.equal(
    normalizeKnowledgeImportContent("Title\n\n\n\nParagraph\n \n\t\nNext"),
    "Title\n\nParagraph\n\nNext",
  );
});

test("normalizeKnowledgeImportContent preserves blank lines inside code fences", () => {
  assert.equal(
    normalizeKnowledgeImportContent("Intro\n\n```ts\nconst a = 1;\n\n\nconst b = 2;\n```\n\n\nOutro"),
    "Intro\n\n```ts\nconst a = 1;\n\n\nconst b = 2;\n```\n\nOutro",
  );
});

test("stripDuplicateKnowledgeImportHeading removes only matching leading h1", () => {
  assert.equal(
    stripDuplicateKnowledgeImportHeading("# LLM Wiki\n\nA pattern", "LLM Wiki"),
    "A pattern",
  );
  assert.equal(
    stripDuplicateKnowledgeImportHeading("# Other\n\nA pattern", "LLM Wiki"),
    "# Other\n\nA pattern",
  );
});
