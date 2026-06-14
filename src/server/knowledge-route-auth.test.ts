import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { GET as getKnowledgeContext } from "@/app/api/knowledge/context/route";
import { GET as getKnowledgeQuery, POST as postKnowledgeQuery } from "@/app/api/knowledge/query/route";
import { GET as getKnowledgeRead, POST as postKnowledgeRead } from "@/app/api/knowledge/read/route";
import { GET as getKnowledgeRetrieve, POST as postKnowledgeRetrieve } from "@/app/api/knowledge/retrieve/route";
import { uiText } from "@/lib/language-pack";
import { execute } from "@/server/db";

function nowIso() {
  return new Date().toISOString();
}

function authHeaders(sessionToken: string) {
  return {
    Cookie: `agentworld_session=${encodeURIComponent(sessionToken)}`,
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

function insertKnowledgeSpace(args: {
  id: string;
  tenantId: string;
  businessTeamId: string;
  slug: string;
  name: string;
}) {
  const now = nowIso();
  execute(
    "INSERT INTO knowledge_spaces (id, tenant_space_id, business_team_id, agent_team_id, project_key, knowledge_category, repository_name, slug, name, space_type, viking_uri, description, visibility, status, retention_policy_json, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    args.id,
    args.tenantId,
    args.businessTeamId,
    null,
    null,
    "domain",
    null,
    args.slug,
    args.name,
    "team",
    `agentworld://knowledge/resources/teams/${args.slug}`,
    "",
    "team",
    "active",
    "{}",
    now,
    now,
  );
}

function insertKnowledgeEntry(args: {
  id: string;
  knowledgeSpaceId: string;
  scopeKey: string;
  title: string;
  uri: string;
  content: string;
}) {
  const now = nowIso();
  execute(
    "INSERT INTO knowledge_entries (id, knowledge_space_id, layer, scope_key, skill_id, viking_uri, title, content_md, metadata_json, source_type, sync_status, sync_error, created_at, updated_at, updated_by, revision) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    args.id,
    args.knowledgeSpaceId,
    "manual",
    args.scopeKey,
    null,
    args.uri,
    args.title,
    args.content,
    "{}",
    "manual",
    "local_indexed",
    null,
    now,
    now,
    "test",
    1,
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
    "Knowledge Route Tester",
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
    "knowledge-route-auth-test",
    "active",
    now,
    now,
  );
}

function insertTaskRun(args: {
  id: string;
  tenantId: string;
  businessTeamId: string;
  teamId: string;
}) {
  const now = nowIso();
  execute(
    "INSERT INTO task_runs (id, tenant_space_id, business_team_id, team_id, blueprint_id, blueprint_version, idempotency_key, parent_task_run_id, run_state, environment_snapshot_id, permission_snapshot_json, agent_team_run_plan_json, execution_policy_json, access_grant_id, source_type, source_ref, status, priority, input_payload_json, output_payload_json, cost_estimate, cost_actual, trace_id, requested_by, created_at, completed_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    args.id,
    args.tenantId,
    args.businessTeamId,
    args.teamId,
    null,
    1,
    `knowledge-route-${args.id}`,
    null,
    "completed",
    null,
    "{}",
    "{}",
    "{}",
    null,
    "manual",
    `manual-${args.id}`,
    "completed",
    0,
    "{}",
    null,
    0,
    0,
    `trace-${args.id}`,
    "test",
    now,
    now,
  );
}

function insertKnowledgeRouteFixtures() {
  const suffix = randomUUID();
  const allowedTenantId = `tenant-allowed-${suffix}`;
  const blockedTenantId = `tenant-blocked-${suffix}`;
  const allowedBusinessTeamId = `business-allowed-${suffix}`;
  const blockedBusinessTeamId = `business-blocked-${suffix}`;
  const allowedTeamId = `agent-team-allowed-${suffix}`;
  const blockedTeamId = `agent-team-blocked-${suffix}`;
  const allowedSpaceId = `space-allowed-${suffix}`;
  const blockedSpaceId = `space-blocked-${suffix}`;
  const allowedEntryId = `entry-allowed-${suffix}`;
  const blockedEntryId = `entry-blocked-${suffix}`;
  const sessionToken = `session-token-${suffix}`;
  const userId = `user-${suffix}`;
  const whitelistRuleId = `whitelist-${suffix}`;
  const allowedTaskRunId = `task-allowed-${suffix}`;
  const blockedTaskRunId = `task-blocked-${suffix}`;
  const queryNeedle = `routeauthneedle${suffix.replace(/-/g, "")}`;
  const allowedUri = `agentworld://knowledge/resources/teams/allowed-${suffix}/allowed.md`;
  const blockedUri = `agentworld://knowledge/resources/teams/blocked-${suffix}/blocked.md`;

  insertBusinessTeam({
    tenantId: allowedTenantId,
    businessTeamId: allowedBusinessTeamId,
    slug: `allowed-${suffix}`,
    name: `Allowed ${suffix}`,
  });
  insertBusinessTeam({
    tenantId: blockedTenantId,
    businessTeamId: blockedBusinessTeamId,
    slug: `blocked-${suffix}`,
    name: `Blocked ${suffix}`,
  });
  insertAgentTeam({
    id: allowedTeamId,
    businessTeamId: allowedBusinessTeamId,
    slug: `allowed-team-${suffix}`,
    name: `Allowed Team ${suffix}`,
  });
  insertAgentTeam({
    id: blockedTeamId,
    businessTeamId: blockedBusinessTeamId,
    slug: `blocked-team-${suffix}`,
    name: `Blocked Team ${suffix}`,
  });
  insertKnowledgeSpace({
    id: allowedSpaceId,
    tenantId: allowedTenantId,
    businessTeamId: allowedBusinessTeamId,
    slug: `allowed-space-${suffix}`,
    name: `Allowed Space ${suffix}`,
  });
  insertKnowledgeSpace({
    id: blockedSpaceId,
    tenantId: blockedTenantId,
    businessTeamId: blockedBusinessTeamId,
    slug: `blocked-space-${suffix}`,
    name: `Blocked Space ${suffix}`,
  });
  insertKnowledgeEntry({
    id: allowedEntryId,
    knowledgeSpaceId: allowedSpaceId,
    scopeKey: `allowed-${suffix}`,
    title: `Allowed ${queryNeedle}`,
    uri: allowedUri,
    content: `Allowed knowledge content ${queryNeedle}`,
  });
  insertKnowledgeEntry({
    id: blockedEntryId,
    knowledgeSpaceId: blockedSpaceId,
    scopeKey: `blocked-${suffix}`,
    title: `Blocked ${queryNeedle}`,
    uri: blockedUri,
    content: `Blocked knowledge content ${queryNeedle}`,
  });
  insertWhitelistRule({
    id: whitelistRuleId,
    tenantId: allowedTenantId,
    businessTeamId: allowedBusinessTeamId,
  });
  insertUserSession({
    userId,
    sessionToken,
    businessTeamId: allowedBusinessTeamId,
    email: `knowledge-${suffix}@example.test`,
  });
  insertTaskRun({
    id: allowedTaskRunId,
    tenantId: allowedTenantId,
    businessTeamId: allowedBusinessTeamId,
    teamId: allowedTeamId,
  });
  insertTaskRun({
    id: blockedTaskRunId,
    tenantId: blockedTenantId,
    businessTeamId: blockedBusinessTeamId,
    teamId: blockedTeamId,
  });

  return {
    allowedBusinessTeamId,
    allowedEntryId,
    allowedSpaceId,
    allowedTaskRunId,
    allowedTenantId,
    allowedTeamId,
    allowedUri,
    blockedBusinessTeamId,
    blockedEntryId,
    blockedSpaceId,
    blockedTaskRunId,
    blockedTenantId,
    blockedTeamId,
    blockedUri,
    queryNeedle,
    sessionToken,
    userId,
    whitelistRuleId,
  };
}

function cleanupKnowledgeRouteFixtures(fixtures: ReturnType<typeof insertKnowledgeRouteFixtures>) {
  execute("DELETE FROM task_runs WHERE id IN (?, ?)", fixtures.allowedTaskRunId, fixtures.blockedTaskRunId);
  execute("DELETE FROM knowledge_entries WHERE id IN (?, ?)", fixtures.allowedEntryId, fixtures.blockedEntryId);
  execute("DELETE FROM knowledge_spaces WHERE id IN (?, ?)", fixtures.allowedSpaceId, fixtures.blockedSpaceId);
  execute("DELETE FROM auth_sessions WHERE session_token = ?", fixtures.sessionToken);
  execute("DELETE FROM identity_user_business_team_memberships WHERE user_id = ?", fixtures.userId);
  execute("DELETE FROM identity_users WHERE id = ?", fixtures.userId);
  execute("DELETE FROM access_whitelist_rules WHERE id = ?", fixtures.whitelistRuleId);
  execute("DELETE FROM agent_teams WHERE id IN (?, ?)", fixtures.allowedTeamId, fixtures.blockedTeamId);
  execute(
    "DELETE FROM business_teams WHERE id IN (?, ?)",
    fixtures.allowedBusinessTeamId,
    fixtures.blockedBusinessTeamId,
  );
  execute("DELETE FROM tenant_spaces WHERE id IN (?, ?)", fixtures.allowedTenantId, fixtures.blockedTenantId);
}

async function assertKnowledgeApiAuthenticationRequired(response: Response) {
  assert.equal(response.status, 401);
  assert.equal(response.headers.get("content-type")?.includes("application/json"), true);
  const body = (await response.json()) as { ok?: boolean; error?: string };
  assert.equal(body.ok, false);
  assert.equal(
    body.error,
    uiText("ui.api.errors.knowledgeApiAuthRequired", "Missing or invalid knowledge API token."),
  );
}

test("knowledge API public routes require API auth before parsing bodies", async () => {
  await assertKnowledgeApiAuthenticationRequired(
    await getKnowledgeQuery(new Request("http://agentworld.test/api/knowledge/query?query=test")),
  );
  await assertKnowledgeApiAuthenticationRequired(
    await postKnowledgeQuery(
      new Request("http://agentworld.test/api/knowledge/query", {
        method: "POST",
        body: "not-json",
      }),
    ),
  );
  await assertKnowledgeApiAuthenticationRequired(
    await getKnowledgeRetrieve(new Request("http://agentworld.test/api/knowledge/retrieve?query=test")),
  );
  await assertKnowledgeApiAuthenticationRequired(
    await postKnowledgeRetrieve(
      new Request("http://agentworld.test/api/knowledge/retrieve", {
        method: "POST",
        body: "not-json",
      }),
    ),
  );
  await assertKnowledgeApiAuthenticationRequired(
    await getKnowledgeRead(new Request("http://agentworld.test/api/knowledge/read?uri=agentworld://knowledge/test")),
  );
  await assertKnowledgeApiAuthenticationRequired(
    await postKnowledgeRead(
      new Request("http://agentworld.test/api/knowledge/read", {
        method: "POST",
        body: "not-json",
      }),
    ),
  );
});

test("knowledge context route requires an authenticated session", async () => {
  const response = await getKnowledgeContext(
    new Request("http://agentworld.test/api/knowledge/context?teamId=team-a&blueprintId=blueprint-a"),
  );
  assert.equal(response.status, 401);
  const body = (await response.json()) as { ok?: boolean; error?: string };
  assert.equal(body.ok, false);
  assert.equal(body.error, uiText("ui.api.errors.authenticationRequired", "Authentication required."));
});

test("session knowledge query is scoped to visible knowledge spaces", async () => {
  const fixtures = insertKnowledgeRouteFixtures();
  try {
    const response = await getKnowledgeQuery(
      new Request(`http://agentworld.test/api/knowledge/query?query=${fixtures.queryNeedle}`, {
        headers: authHeaders(fixtures.sessionToken),
      }),
    );
    assert.equal(response.status, 200);
    const body = (await response.json()) as {
      result?: { totalEntries?: number; hits?: Array<{ id: string; title: string }> };
    };
    assert.equal(body.result?.totalEntries, 1);
    assert.deepEqual(body.result?.hits?.map((hit) => hit.id), [fixtures.allowedEntryId]);

    const blockedScopeResponse = await getKnowledgeQuery(
      new Request(
        `http://agentworld.test/api/knowledge/query?query=${fixtures.queryNeedle}&knowledgeSpaceIds=${fixtures.blockedSpaceId}`,
        {
          headers: authHeaders(fixtures.sessionToken),
        },
      ),
    );
    assert.equal(blockedScopeResponse.status, 200);
    const blockedScopeBody = (await blockedScopeResponse.json()) as {
      result?: { totalEntries?: number; hits?: unknown[] };
    };
    assert.equal(blockedScopeBody.result?.totalEntries, 0);
    assert.equal(blockedScopeBody.result?.hits?.length, 0);
  } finally {
    cleanupKnowledgeRouteFixtures(fixtures);
  }
});

test("session knowledge retrieve search is scoped to visible knowledge spaces", async () => {
  const fixtures = insertKnowledgeRouteFixtures();
  try {
    const response = await postKnowledgeRetrieve(
      new Request("http://agentworld.test/api/knowledge/retrieve", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...authHeaders(fixtures.sessionToken),
        },
        body: JSON.stringify({
          query: fixtures.queryNeedle,
          scopeUris: [fixtures.blockedUri],
        }),
      }),
    );
    assert.equal(response.status, 200);
    const body = (await response.json()) as {
      packet?: { totalEntries?: number; hits?: Array<{ id: string }> };
    };
    assert.equal(body.packet?.totalEntries, 0);
    assert.equal(body.packet?.hits?.length, 0);

    const blockedTaskRunResponse = await postKnowledgeRetrieve(
      new Request("http://agentworld.test/api/knowledge/retrieve", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...authHeaders(fixtures.sessionToken),
        },
        body: JSON.stringify({
          taskRunId: fixtures.blockedTaskRunId,
          query: fixtures.queryNeedle,
        }),
      }),
    );
    assert.equal(blockedTaskRunResponse.status, 403);
    const blockedTaskRunBody = (await blockedTaskRunResponse.json()) as { ok?: boolean; error?: string };
    assert.equal(blockedTaskRunBody.ok, false);
    assert.equal(blockedTaskRunBody.error, uiText("ui.api.errors.businessTeamAccessDenied", "Business team access denied."));
  } finally {
    cleanupKnowledgeRouteFixtures(fixtures);
  }
});

test("session knowledge read rejects URIs outside visible spaces", async () => {
  const fixtures = insertKnowledgeRouteFixtures();
  try {
    const allowedResponse = await getKnowledgeRead(
      new Request(`http://agentworld.test/api/knowledge/read?uri=${encodeURIComponent(fixtures.allowedUri)}`, {
        headers: authHeaders(fixtures.sessionToken),
      }),
    );
    assert.equal(allowedResponse.status, 200);
    const allowedBody = (await allowedResponse.json()) as { content?: string };
    assert.match(allowedBody.content ?? "", /Allowed knowledge content/);

    const blockedResponse = await getKnowledgeRead(
      new Request(`http://agentworld.test/api/knowledge/read?uri=${encodeURIComponent(fixtures.blockedUri)}`, {
        headers: authHeaders(fixtures.sessionToken),
      }),
    );
    assert.equal(blockedResponse.status, 403);
    const blockedBody = (await blockedResponse.json()) as { ok?: boolean; error?: string };
    assert.equal(blockedBody.ok, false);
    assert.equal(blockedBody.error, uiText("ui.api.errors.businessTeamAccessDenied", "Business team access denied."));
  } finally {
    cleanupKnowledgeRouteFixtures(fixtures);
  }
});
