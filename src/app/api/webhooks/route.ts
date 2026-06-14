import { NextResponse } from "next/server";
import { uiText } from "@/lib/language-pack";
import {
  ApiAccessError,
  apiAccessErrorResponse,
  assertBusinessTeamAccess,
  requireAuthenticatedActor,
} from "@/server/api-access-control";
import { canAccessBusinessTeam } from "@/server/auth-core";
import { execute, queryAll, queryOne, type AgentTeam, type WebhookEndpoint } from "@/server/db";

export const dynamic = "force-dynamic";

function assertNoEnvPluginSecretReference(value: string) {
  if (value.trim().toLowerCase().startsWith("env:")) {
    throw new Error(uiText("pluginSdk.errors.envSecretRefUnsupported"));
  }
}

function listWebhooks() {
  return queryAll<WebhookEndpoint>("SELECT * FROM webhook_endpoints ORDER BY name ASC");
}

function getAgentTeam(teamId: string) {
  return queryOne<AgentTeam>("SELECT * FROM agent_teams WHERE id = ?", teamId);
}

function getWebhook(id: string) {
  return queryOne<WebhookEndpoint>("SELECT * FROM webhook_endpoints WHERE id = ?", id);
}

function getWebhookByPathKey(pathKey: string, excludeId: string) {
  return queryOne<WebhookEndpoint>(
    "SELECT * FROM webhook_endpoints WHERE path_key = ? AND id <> ? LIMIT 1",
    pathKey,
    excludeId,
  );
}

function upsertWebhookEndpoint(
  input: Pick<
    WebhookEndpoint,
    | "id"
    | "businessTeamId"
    | "teamId"
    | "name"
    | "pathKey"
    | "method"
    | "requestSchemaJson"
    | "secretHint"
    | "isEnabled"
  >,
) {
  assertNoEnvPluginSecretReference(input.secretHint);
  if (getWebhookByPathKey(input.pathKey, input.id)) {
    throw new ApiAccessError(
      409,
      uiText("ui.api.errors.webhookPathKeyDuplicate", "Webhook path key already exists."),
    );
  }
  execute(
    "INSERT OR REPLACE INTO webhook_endpoints (id, business_team_id, team_id, name, path_key, method, request_schema_json, secret_hint, is_enabled) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
    input.id,
    input.businessTeamId,
    input.teamId,
    input.name,
    input.pathKey,
    input.method,
    input.requestSchemaJson,
    input.secretHint,
    input.isEnabled,
  );

  return getWebhook(input.id);
}

function deleteWebhookEndpoint(id: string) {
  execute("DELETE FROM webhook_endpoints WHERE id = ?", id);
}

function assertWebhookWriteAccess(
  authContext: Awaited<ReturnType<typeof requireAuthenticatedActor>>["authContext"],
  input: Pick<WebhookEndpoint, "businessTeamId" | "teamId">,
) {
  assertBusinessTeamAccess(authContext, input.businessTeamId);
  const team = getAgentTeam(input.teamId);
  if (!team) {
    throw new ApiAccessError(404, uiText("ui.api.errors.agentTeamNotFound", "Agent team does not exist."));
  }
  assertBusinessTeamAccess(authContext, team.businessTeamId);
  if (team.businessTeamId !== input.businessTeamId) {
    throw new ApiAccessError(403, uiText("ui.api.errors.businessTeamAccessDenied", "Business team access denied."));
  }
}

export async function GET(request: Request) {
  try {
    const { authContext } = await requireAuthenticatedActor(request, "webhook-console");
    const webhooks = listWebhooks().filter((webhook) => canAccessBusinessTeam(authContext, webhook.businessTeamId));
    return NextResponse.json({ webhooks });
  } catch (error) {
    const accessError = apiAccessErrorResponse(error);
    if (accessError) return accessError;
    throw error;
  }
}

export async function POST(request: Request) {
  try {
    const { authContext } = await requireAuthenticatedActor(request, "webhook-console");
    const body = (await request.json()) as Parameters<typeof upsertWebhookEndpoint>[0];
    const current = body.id ? getWebhook(body.id) : null;
    if (body.id && !current) {
      throw new ApiAccessError(404, uiText("ui.api.errors.webhookEndpointNotFound", "Webhook endpoint does not exist."));
    }
    if (current) assertWebhookWriteAccess(authContext, current);
    assertWebhookWriteAccess(authContext, body);
    const webhook = upsertWebhookEndpoint(body);
    return NextResponse.json({ ok: true, webhook });
  } catch (error) {
    const accessError = apiAccessErrorResponse(error);
    if (accessError) return accessError;
    throw error;
  }
}

export async function PATCH(request: Request) {
  return POST(request);
}

export async function DELETE(request: Request) {
  try {
    const { authContext } = await requireAuthenticatedActor(request, "webhook-console");
    const body = (await request.json()) as { id: string };
    const current = getWebhook(body.id);
    if (!current) {
      throw new ApiAccessError(404, uiText("ui.api.errors.webhookEndpointNotFound", "Webhook endpoint does not exist."));
    }
    assertWebhookWriteAccess(authContext, current);
    deleteWebhookEndpoint(body.id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const accessError = apiAccessErrorResponse(error);
    if (accessError) return accessError;
    throw error;
  }
}
