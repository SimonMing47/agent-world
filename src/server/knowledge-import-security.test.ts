import assert from "node:assert/strict";
import { test } from "node:test";
import {
  isKnowledgeImportBlockedResolvedAddress,
  isKnowledgeImportPrivateAddress,
  isKnowledgeImportProxyReservedIpv4,
} from "@/server/knowledge-import-security";

test("knowledge import security blocks private literal targets", () => {
  assert.equal(isKnowledgeImportPrivateAddress("127.0.0.1"), true);
  assert.equal(isKnowledgeImportPrivateAddress("10.1.2.3"), true);
  assert.equal(isKnowledgeImportPrivateAddress("192.168.1.5"), true);
  assert.equal(isKnowledgeImportPrivateAddress("198.18.1.105"), true);
});

test("knowledge import security allows proxy-reserved DNS results for public hostnames", () => {
  assert.equal(isKnowledgeImportProxyReservedIpv4("198.18.1.105"), true);
  assert.equal(isKnowledgeImportBlockedResolvedAddress("198.18.1.105"), false);
  assert.equal(isKnowledgeImportBlockedResolvedAddress("10.1.2.3"), true);
  assert.equal(isKnowledgeImportBlockedResolvedAddress("8.8.8.8"), false);
});
