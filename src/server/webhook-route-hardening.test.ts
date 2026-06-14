import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { GET as getPublicWebhook } from "@/app/api/webhooks/[pathKey]/route";
import { POST as postWebhooks } from "@/app/api/webhooks/route";
import { uiText } from "@/lib/language-pack";
import { execute, type TaskBlueprint, type WebhookEndpoint } from "@/server/db";
import { matchWebhookBlueprintsForEndpoint } from "@/server/webhook-trigger-core";

function nowIso() {
  return new Date().toISOString();
}

function authHeaders(sessionToken: string) {
  return {
    Cookie: `agentworld_session=${encodeURIComponent(sessionToken)}`,
    "Content-Type": "application/json",
  };
}

function insertBusinessTeam(args: {
  tenantId: string;
  businessTeamId: string;
  slug: string;
  name: string;
}) {
  const now = nowIso();
  execute(
    "INSERT INTO tenant_spaces (id, slug, name, owner_user_id, status, quota_limit_json, model_whitelist_json, global_guardrails_json, default_execution_policy_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    args.tenantId,
    args.tenantId,
    `Tenant ${args.name}`,
    "test-owner",
    "active",
    "{}",
    "[]",
    "{}",
    null,
    now,
  );
  execute(
    "INSERT INTO business_teams (id, tenant_space_id, parent_business_team_id, slug, name, description, owner_user_id, status, balance, credit_limit, private_tool_refs_json, private_memory_namespace, policy_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    args.businessTeamId,
    args.tenantId,
    null,
    args.slug,
    args.name,
    "",
    "test-owner",
    "active",
    0,
    0,
    "[]",
    `memory-${args.slug}`,
    "{}",
    now,
  );
}

function insertAgentTeam(args: { id: string; businessTeamId: string; slug: string; name: string }) {
  const now = nowIso();
  execute(
    "INSERT INTO agent_teams (id, business_team_id, slug, name, description, leader_agent_id, workflow_type, orchestration_prompt, workflow_definition_json, input_schema_json, output_schema_json, max_concurrency, timeout_ms, success_rate_threshold, pricing_model_json, visibility, default_execution_policy_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    args.id,
    args.businessTeamId,
    args.slug,
    args.name,
    "",
    null,
    "single",
    "",
    "{}",
    "{}",
    "{}",
    1,
    300000,
    0.9,
    "{}",
    "team",
    null,
    now,
    now,
  );
}

function insertUserSession(args: {
  userId: string;
  sessionToken: string;
  businessTeamId: string;
  email: string;
}) {
  const now = nowIso();
  execute(
    "INSERT INTO identity_users (id, tenant_space_id, auth_provider_config_id, external_user_id, employee_no, email, name, avatar_url, title, status, is_system_admin, primary_business_team_id, profile_json, created_at, updated_at, last_login_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    args.userId,
    null,
    null,
    args.userId,
    "",
    args.email,
    "Webhook Route Tester",
    "",
    "",
    "active",
    0,
    args.businessTeamId,
    "{}",
    now,
    now,
    now,
  );
  execute(
    "INSERT INTO identity_user_business_team_memberships (id, user_id, business_team_id, membership_source, source_ref, role_title, is_primary, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
    `membership-${args.userId}`,
    args.userId,
    args.businessTeamId,
    "test",
    "test",
    "tester",
    1,
    now,
    now,
  );
  execute(
    "INSERT INTO auth_sessions (id, user_id, auth_provider_config_id, session_token, status, expires_at, created_at, updated_at, last_seen_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
    `session-${args.userId}`,
    args.userId,
    null,
    args.sessionToken,
    "active",
    "2099-01-01T00:00:00.000Z",
    now,
    now,
    now,
  );
}

function insertWhitelistRule(args: { id: string; tenantId: string; businessTeamId: string }) {
  const now = nowIso();
  execute(
    "INSERT INTO access_whitelist_rules (id, tenant_space_id, business_team_id, allow_descendants, note, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    args.id,
    args.tenantId,
    args.businessTeamId,
    0,
    "webhook-route-hardening-test",
    "active",
    now,
    now,
  );
}

function insertWebhook(args: {
  id: string;
  businessTeamId: string;
  teamId: string;
  pathKey: string;
  secret: string;
}) {
  execute(
    "INSERT INTO webhook_endpoints (id, business_team_id, team_id, name, path_key, method, request_schema_json, secret_hint, is_enabled) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
    args.id,
    args.businessTeamId,
    args.teamId,
    "Existing webhook",
    args.pathKey,
    "POST",
    "{}",
    args.secret,
    1,
  );
}

function insertWebhookFixtures() {
  const suffix = randomUUID();
  const tenantId = `tenant-webhook-${suffix}`;
  const businessTeamId = `business-webhook-${suffix}`;
  const teamId = `agent-team-webhook-${suffix}`;
  const userId = `user-webhook-${suffix}`;
  const sessionToken = `session-webhook-${suffix}`;
  const whitelistRuleId = `whitelist-webhook-${suffix}`;
  const webhookId = `webhook-existing-${suffix}`;
  const secondWebhookId = `webhook-second-${suffix}`;
  const pathKey = `webhook-path-${suffix}`;
  const secondPathKey = `webhook-path-second-${suffix}`;
  insertBusinessTeam({
    tenantId,
    businessTeamId,
    slug: `webhook-${suffix}`,
    name: `Webhook ${suffix}`,
  });
  insertAgentTeam({
    id: teamId,
    businessTeamId,
    slug: `webhook-team-${suffix}`,
    name: `Webhook Team ${suffix}`,
  });
  insertWhitelistRule({ id: whitelistRuleId, tenantId, businessTeamId });
  insertUserSession({
    userId,
    sessionToken,
    businessTeamId,
    email: `webhook-${suffix}@example.test`,
  });
  insertWebhook({
    id: webhookId,
    businessTeamId,
    teamId,
    pathKey,
    secret: `secret-${suffix}`,
  });
  insertWebhook({
    id: secondWebhookId,
    businessTeamId,
    teamId,
    pathKey: secondPathKey,
    secret: `second-secret-${suffix}`,
  });
  return {
    businessTeamId,
    pathKey,
    secondPathKey,
    secondWebhookId,
    sessionToken,
    teamId,
    tenantId,
    userId,
    webhookId,
    whitelistRuleId,
  };
}

function cleanupWebhookFixtures(fixtures: ReturnType<typeof insertWebhookFixtures>) {
  execute("DELETE FROM webhook_endpoints WHERE id IN (?, ?)", fixtures.webhookId, fixtures.secondWebhookId);
  execute("DELETE FROM auth_sessions WHERE session_token = ?", fixtures.sessionToken);
  execute("DELETE FROM identity_user_business_team_memberships WHERE user_id = ?", fixtures.userId);
  execute("DELETE FROM identity_users WHERE id = ?", fixtures.userId);
  execute("DELETE FROM access_whitelist_rules WHERE id = ?", fixtures.whitelistRuleId);
  execute("DELETE FROM agent_teams WHERE id = ?", fixtures.teamId);
  execute("DELETE FROM business_teams WHERE id = ?", fixtures.businessTeamId);
  execute("DELETE FROM tenant_spaces WHERE id = ?", fixtures.tenantId);
}

function blueprint(input: {
  id: string;
  pathKey: string;
  teamId: string;
  businessTeamId: string;
}) {
  return {
    id: input.id,
    teamId: input.teamId,
    ownerBusinessTeamId: input.businessTeamId,
    triggerJson: JSON.stringify({ type: "webhook", webhookPathKey: input.pathKey }),
  } as TaskBlueprint;
}

test("public webhook GET does not expose endpoint records or secrets", async () => {
  const response = await getPublicWebhook(
    new Request("http://agentworld.test/api/webhooks/sensitive-path"),
    { params: Promise.resolve({ pathKey: "sensitive-path" }) },
  );

  assert.equal(response.status, 404);
  const body = (await response.json()) as Record<string, unknown>;
  assert.equal(body.ok, false);
  assert.equal("webhook" in body, false);
  assert.equal("matchedBlueprints" in body, false);
  assert.equal("recentRuns" in body, false);
});

test("webhook blueprint matching is scoped to the endpoint business team and agent team", () => {
  const webhook = {
    pathKey: "shared-path",
    teamId: "team-a",
    businessTeamId: "business-a",
  } as WebhookEndpoint;
  const matches = matchWebhookBlueprintsForEndpoint(webhook, [
    blueprint({ id: "allowed", pathKey: "shared-path", teamId: "team-a", businessTeamId: "business-a" }),
    blueprint({ id: "wrong-team", pathKey: "shared-path", teamId: "team-b", businessTeamId: "business-a" }),
    blueprint({ id: "wrong-business", pathKey: "shared-path", teamId: "team-a", businessTeamId: "business-b" }),
    blueprint({ id: "wrong-path", pathKey: "other-path", teamId: "team-a", businessTeamId: "business-a" }),
  ]);

  assert.deepEqual(matches.map((match) => match.id), ["allowed"]);
});

test("webhook management rejects duplicate path keys", async () => {
  const fixtures = insertWebhookFixtures();
  try {
    const response = await postWebhooks(
      new Request("http://agentworld.test/api/webhooks", {
        method: "POST",
        headers: authHeaders(fixtures.sessionToken),
        body: JSON.stringify({
          id: fixtures.secondWebhookId,
          businessTeamId: fixtures.businessTeamId,
          teamId: fixtures.teamId,
          name: "Duplicate webhook",
          pathKey: fixtures.pathKey,
          method: "POST",
          requestSchemaJson: "{}",
          secretHint: "another-secret",
          isEnabled: 1,
        }),
      }),
    );
    assert.equal(response.status, 409);
    const body = (await response.json()) as { ok?: boolean; error?: string };
    assert.equal(body.ok, false);
    assert.equal(body.error, uiText("ui.api.errors.webhookPathKeyDuplicate", "Webhook path key already exists."));
  } finally {
    cleanupWebhookFixtures(fixtures);
  }
});
