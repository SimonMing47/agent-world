import assert from "node:assert/strict";
import { test } from "node:test";
import {
  extractKnowledgeImportUrls,
  normalizeKnowledgeImportUrl,
  resolveKnowledgeImportFetchUrl,
} from "@/lib/knowledge-import-url";

test("extractKnowledgeImportUrls reads Markdown links", () => {
  assert.deepEqual(
    extractKnowledgeImportUrls("[karpathy/442a6bf555914893e9891c11519de94f](https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f)"),
    ["https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f"],
  );
});

test("extractKnowledgeImportUrls supports mixed URL text", () => {
  assert.deepEqual(
    extractKnowledgeImportUrls("https://example.com/a,\n<https://example.com/b> and [doc](https://example.com/c)."),
    ["https://example.com/a", "https://example.com/b", "https://example.com/c"],
  );
});

test("normalizeKnowledgeImportUrl accepts a pasted Markdown link", () => {
  assert.equal(
    normalizeKnowledgeImportUrl("[gist](https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f)").toString(),
    "https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f",
  );
});

test("resolveKnowledgeImportFetchUrl fetches gist raw content", () => {
  assert.equal(
    resolveKnowledgeImportFetchUrl(new URL("https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f")).toString(),
    "https://gist.githubusercontent.com/karpathy/442a6bf555914893e9891c11519de94f/raw",
  );
  assert.equal(
    resolveKnowledgeImportFetchUrl(new URL("https://example.com/article")).toString(),
    "https://example.com/article",
  );
});
