import assert from "node:assert/strict";
import { test } from "node:test";
import {
  compactDiscoveredKnowledgeContent,
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

test("compactDiscoveredKnowledgeContent removes blanks between plain imported paragraphs", () => {
  assert.equal(
    compactDiscoveredKnowledgeContent("Paragraph one\n\n\nParagraph two\n\nParagraph three"),
    "Paragraph one\nParagraph two\nParagraph three",
  );
});

test("compactDiscoveredKnowledgeContent keeps structural markdown spacing", () => {
  assert.equal(
    compactDiscoveredKnowledgeContent("# Title\n\nIntro\n\n- One\n\n- Two\n\nOutro\n\n```ts\nconst a = 1;\n\n\nconst b = 2;\n```\n\nAfter"),
    "# Title\n\nIntro\n\n- One\n- Two\n\nOutro\n\n```ts\nconst a = 1;\n\n\nconst b = 2;\n```\n\nAfter",
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
