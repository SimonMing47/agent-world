import assert from "node:assert/strict";
import { test } from "node:test";
import { formatBytes, formatDateTime, formatNumber, formatPercent } from "./utils";

test("formatDateTime formats valid dates", () => {
  assert.match(formatDateTime("2026-05-26T12:30:00.000Z"), /\d/);
});

test("formatDateTime returns a placeholder for missing or invalid dates", () => {
  assert.equal(formatDateTime(null), "-");
  assert.equal(formatDateTime(undefined), "-");
  assert.equal(formatDateTime(""), "-");
  assert.equal(formatDateTime("not-a-date"), "-");
});

test("numeric format helpers keep stable output", () => {
  assert.equal(formatNumber(123456), "123,456");
  assert.equal(formatPercent(0.456), "46%");
  assert.equal(formatBytes(1536), "1.5 KB");
});
