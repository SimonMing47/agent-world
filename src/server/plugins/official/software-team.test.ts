import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { scanCleanCodeFindings, scanCodeShieldFindings } from "@/server/plugins/official/software-team";

test("scanCleanCodeFindings reports local cleancode hotspots", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "agentworld-cleancode-"));
  try {
    fs.mkdirSync(path.join(root, "src"), { recursive: true });
    fs.writeFileSync(
      path.join(root, "src", "example.ts"),
      [
        "const item: " + "any = {};",
        "// TO" + "DO: remove temporary branch",
        "/* eslint-" + "disable no-console */",
        "console.log(item);",
      ].join("\n"),
    );
    fs.writeFileSync(
      path.join(root, "src", "large.ts"),
      Array.from({ length: 120 }, (_, index) => `export const value${index} = ${index};`).join("\n"),
    );

    const result = scanCleanCodeFindings({
      root,
      maxFindings: 20,
      lineThresholds: { default: 100 },
    });

    assert.equal(result.scannedFiles, 2);
    assert.ok(result.findings.some((finding) => finding.ruleId === "cleancode.any_type"));
    assert.ok(result.findings.some((finding) => finding.ruleId === "cleancode.todo_marker"));
    assert.ok(result.findings.some((finding) => finding.ruleId === "cleancode.eslint_disable"));
    assert.ok(result.findings.some((finding) => finding.ruleId === "cleancode.large_file"));
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("scanCodeShieldFindings reports repository security hotspots", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "agentworld-code-shield-"));
  try {
    fs.mkdirSync(path.join(root, "src"), { recursive: true });
    fs.writeFileSync(
      path.join(root, "src", "risky.ts"),
      [
        "const apiKey = \"sk_test_123456789\";",
        "const runner = Function(\"return process.env\")",
        "exec(req.query.command);",
        "const sql = `SELECT * FROM users WHERE id = ${userId}`;",
      ].join("\n"),
    );

    const result = scanCodeShieldFindings({
      root,
      maxFindings: 20,
    });

    assert.equal(result.scannedFiles, 1);
    assert.ok(result.findings.some((finding) => finding.ruleId === "code_shield.secret_like_assignment"));
    assert.ok(result.findings.some((finding) => finding.ruleId === "code_shield.dynamic_code_execution"));
    assert.ok(result.findings.some((finding) => finding.ruleId === "code_shield.shell_input_execution"));
    assert.ok(result.findings.some((finding) => finding.ruleId === "code_shield.sql_interpolation"));
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
