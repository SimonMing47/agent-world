import assert from "node:assert/strict";
import { test } from "node:test";
import { createKnowledgeApiToken, revokeKnowledgeApiToken, resolveKnowledgeApiAuthContext } from "@/server/knowledge-api-auth";

test("knowledge API token can be created and resolved", async () => {
  const record = createKnowledgeApiToken({
    label: "test-token",
    createdBy: "admin",
  });
  try {
    const request = new Request("http://localhost/api/knowledge/query", {
      headers: {
        authorization: `Bearer ${record.token}`,
      },
    });

    const auth = await resolveKnowledgeApiAuthContext(request);
    assert.equal(auth?.mode, "token");
    if (auth?.mode !== "token") {
      throw new Error("Expected token mode");
    }
    assert.equal(auth.token.label, "test-token");
  } finally {
    revokeKnowledgeApiToken(record.tokenInfo.id);
  }
});

test("expired knowledge API token cannot resolve", async () => {
  const record = createKnowledgeApiToken({
    label: "test-expired-token",
    createdBy: "admin",
    expiresAt: "2000-01-01T00:00:00.000Z",
  });
  try {
  const request = new Request("http://localhost/api/knowledge/query", {
    headers: {
      authorization: `Bearer ${record.token}`,
    },
  });

  const auth = await resolveKnowledgeApiAuthContext(request);
  assert.equal(auth, null);

  } finally {
    revokeKnowledgeApiToken(record.tokenInfo.id);
  }
});

test("knowledge API token auth rejects invalid token", async () => {
  const auth = await resolveKnowledgeApiAuthContext(
    new Request("http://localhost/api/knowledge/query", {
      headers: {
        authorization: "Bearer invalid-token",
      },
    }),
  );
  assert.equal(auth, null);
});
