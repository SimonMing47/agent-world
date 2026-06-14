import { NextResponse } from "next/server";
import { uiText } from "@/lib/language-pack";
import { canAccessBusinessTeam, getRequestAuthContext, type AuthContext } from "@/server/auth-core";
import {
  queryAll,
  queryOne,
  type AgentDefinition,
  type AgentDefinitionShare,
  type AgentTeam,
  type AgentTeamShare,
  type CodebaseOperatorToken,
  type CodebaseProfile,
  type ConnectorProfile,
  type ExecutionEnvironment,
  type McpServerProfile,
  type InspectionSkill,
  type ProviderRuntimeBinding,
  type RuntimeSession,
  type TenantSpace,
  type TeamAssetGrant,
  type TeamMember,
  type TeamPermissionGrant,
  type TaskBlueprint,
  type TaskRun,
  type TaskRunIntervention,
} from "@/server/db";

export class ApiAccessError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiAccessError";
  }
}

export function apiAccessErrorResponse(error: unknown) {
  if (!(error instanceof ApiAccessError)) return null;
  return NextResponse.json({ ok: false, error: error.message }, { status: error.status });
}

export function actorFromAuthContext(authContext: AuthContext, fallback = "console") {
  return (
    authContext.user.email?.trim() ||
    authContext.user.name?.trim() ||
    authContext.user.id?.trim() ||
    fallback
  );
}

export async function requireAuthenticatedActor(request: Request, fallback = "console") {
  const authContext = await getRequestAuthContext(request);
  if (!authContext) {
    throw new ApiAccessError(401, uiText("ui.api.errors.authenticationRequired", "Authentication required."));
  }
  if (!authContext.access.allowed) {
    throw new ApiAccessError(403, uiText("ui.api.errors.businessTeamAccessDenied", "Business team access denied."));
  }

  return {
    actor: actorFromAuthContext(authContext, fallback),
    authContext,
  };
}

export async function requireSystemAdminActor(request: Request, fallback = "system-settings") {
  const access = await requireAuthenticatedActor(request, fallback);
  if (access.authContext.user.isSystemAdmin !== 1) {
    throw new ApiAccessError(403, uiText("identityAccess.errors.adminRequired", "System administrator access is required."));
  }
  return access;
}

export function assertBusinessTeamAccess(
  authContext: AuthContext | null,
  businessTeamId: string | null | undefined,
  options: { allowGlobal?: boolean } = {},
) {
  if (!authContext) {
    throw new ApiAccessError(401, uiText("ui.api.errors.authenticationRequired", "Authentication required."));
  }
  if (!canAccessBusinessTeam(authContext, businessTeamId, options)) {
    throw new ApiAccessError(403, uiText("ui.api.errors.businessTeamAccessDenied", "Business team access denied."));
  }
}

export async function requireAgentTeamActor(request: Request, teamId: string, fallback = "console") {
  const access = await requireAuthenticatedActor(request, fallback);
  const team = queryOne<AgentTeam>("SELECT * FROM agent_teams WHERE id = ?", teamId);
  if (!team) {
    throw new ApiAccessError(404, uiText("ui.api.errors.agentTeamNotFound", "Agent team does not exist."));
  }
  assertBusinessTeamAccess(access.authContext, team.businessTeamId);
  return { ...access, team };
}

export function canReadAgentDefinition(
  authContext: AuthContext | null,
  definition: AgentDefinition,
  shares: AgentDefinitionShare[] = [],
) {
  if (!authContext?.access.allowed) return false;
  if (definition.visibility === "global") return true;
  if (canAccessBusinessTeam(authContext, definition.ownerBusinessTeamId, { allowGlobal: true })) return true;
  return shares.some((share) => canAccessBusinessTeam(authContext, share.businessTeamId));
}

export function canReadAgentTeam(
  authContext: AuthContext | null,
  team: AgentTeam,
  shares: AgentTeamShare[] = [],
) {
  if (!authContext?.access.allowed) return false;
  if (canAccessBusinessTeam(authContext, team.businessTeamId, { allowGlobal: true })) return true;
  return shares.some((share) => canAccessBusinessTeam(authContext, share.businessTeamId));
}

export function assertAgentTeamWriteAccess(authContext: AuthContext | null, team: AgentTeam) {
  assertBusinessTeamAccess(authContext, team.businessTeamId);
}

export function assertAgentTeamSaveAccess(
  authContext: AuthContext | null,
  currentTeam: AgentTeam | null,
  targetBusinessTeamId: string | null | undefined,
  shareBusinessTeamIds: string[] = [],
) {
  if (currentTeam) {
    assertAgentTeamWriteAccess(authContext, currentTeam);
  }
  assertBusinessTeamAccess(authContext, targetBusinessTeamId);
  for (const teamId of shareBusinessTeamIds) {
    assertBusinessTeamAccess(authContext, teamId);
  }
}

export function assertAgentDefinitionWriteAccess(
  authContext: AuthContext | null,
  definition: AgentDefinition,
) {
  assertBusinessTeamAccess(authContext, definition.ownerBusinessTeamId);
}

export function assertAgentDefinitionSaveAccess(
  authContext: AuthContext | null,
  currentDefinition: AgentDefinition | null,
  targetOwnerBusinessTeamId: string | null | undefined,
  shareBusinessTeamIds: string[] = [],
) {
  if (currentDefinition) {
    assertAgentDefinitionWriteAccess(authContext, currentDefinition);
  }
  assertBusinessTeamAccess(authContext, targetOwnerBusinessTeamId);
  for (const teamId of shareBusinessTeamIds) {
    assertBusinessTeamAccess(authContext, teamId);
  }
}

export async function requireAgentDefinitionReader(
  request: Request,
  definitionId: string,
  fallback = "agent-definition-console",
) {
  const access = await requireAuthenticatedActor(request, fallback);
  const definition = queryOne<AgentDefinition>(
    "SELECT * FROM agent_definitions WHERE id = ? AND status <> 'deleted'",
    definitionId,
  );
  if (!definition) {
    throw new ApiAccessError(404, uiText("ui.api.errors.agentDefinitionNotFound", "Agent definition does not exist."));
  }
  const shares = queryAll<AgentDefinitionShare>(
    "SELECT * FROM agent_definition_shares WHERE agent_definition_id = ?",
    definitionId,
  );
  if (!canReadAgentDefinition(access.authContext, definition, shares)) {
    throw new ApiAccessError(403, uiText("ui.api.errors.businessTeamAccessDenied", "Business team access denied."));
  }
  return { ...access, definition, shares };
}

export async function requireAgentDefinitionWriter(
  request: Request,
  definitionId: string,
  fallback = "agent-definition-console",
) {
  const access = await requireAgentDefinitionReader(request, definitionId, fallback);
  assertAgentDefinitionWriteAccess(access.authContext, access.definition);
  return access;
}

export async function requireTaskBlueprintActor(request: Request, blueprintId: string, fallback = "blueprint-console") {
  const access = await requireAuthenticatedActor(request, fallback);
  const blueprint = queryOne<TaskBlueprint>("SELECT * FROM task_blueprints WHERE id = ?", blueprintId);
  if (!blueprint) {
    throw new ApiAccessError(404, uiText("ui.api.errors.taskBlueprintNotFound", "Task definition does not exist."));
  }
  assertBusinessTeamAccess(access.authContext, blueprint.ownerBusinessTeamId);
  return { ...access, blueprint };
}

export function assertTaskBlueprintSaveAccess(
  authContext: AuthContext | null,
  currentBlueprint: TaskBlueprint | null,
  targetOwnerBusinessTeamId: string | null | undefined,
  targetAgentTeam: AgentTeam | null | undefined,
) {
  if (currentBlueprint) {
    assertBusinessTeamAccess(authContext, currentBlueprint.ownerBusinessTeamId);
  }
  assertBusinessTeamAccess(authContext, targetOwnerBusinessTeamId);
  if (targetAgentTeam) {
    assertBusinessTeamAccess(authContext, targetAgentTeam.businessTeamId);
  }
}

export function canReadSkill(authContext: AuthContext | null, skill: InspectionSkill) {
  return canAccessBusinessTeam(authContext, skill.ownerBusinessTeamId, { allowGlobal: true });
}

export function assertSkillWriteAccess(authContext: AuthContext | null, skill: InspectionSkill) {
  assertBusinessTeamAccess(authContext, skill.ownerBusinessTeamId, {
    allowGlobal: authContext?.user.isSystemAdmin === 1,
  });
}

export function assertSkillSaveAccess(
  authContext: AuthContext | null,
  currentSkill: InspectionSkill | null,
  targetOwnerBusinessTeamId: string | null | undefined,
) {
  if (currentSkill) {
    assertSkillWriteAccess(authContext, currentSkill);
  }
  assertBusinessTeamAccess(authContext, targetOwnerBusinessTeamId, {
    allowGlobal: authContext?.user.isSystemAdmin === 1,
  });
}

export async function requireProviderRuntimeBindingActor(
  request: Request,
  bindingId: string,
  fallback = "runtime-binding-console",
) {
  const access = await requireAuthenticatedActor(request, fallback);
  const binding = queryOne<ProviderRuntimeBinding>(
    "SELECT * FROM provider_runtime_bindings WHERE id = ?",
    bindingId,
  );
  if (!binding) {
    throw new ApiAccessError(404, uiText("ui.api.errors.runtimeBindingNotFound", "Runtime binding does not exist."));
  }
  assertBusinessTeamAccess(access.authContext, binding.businessTeamId);
  return { ...access, binding };
}

export async function requireExecutionEnvironmentActor(
  request: Request,
  environmentId: string,
  fallback = "environment-console",
) {
  const access = await requireAuthenticatedActor(request, fallback);
  const environment = queryOne<ExecutionEnvironment>(
    "SELECT * FROM execution_environments WHERE id = ? AND status <> 'deleted'",
    environmentId,
  );
  if (!environment) {
    throw new ApiAccessError(
      404,
      uiText("ui.api.errors.executionEnvironmentNotFound", "Execution environment does not exist."),
    );
  }
  assertBusinessTeamAccess(access.authContext, environment.businessTeamId);
  return { ...access, environment };
}

export async function requireConnectorActor(request: Request, connectorId: string, fallback = "connector-console") {
  const access = await requireAuthenticatedActor(request, fallback);
  const connector = queryOne<ConnectorProfile>(
    "SELECT * FROM connector_profiles WHERE id = ? AND status <> 'deleted'",
    connectorId,
  );
  if (!connector) {
    throw new ApiAccessError(404, uiText("ui.api.errors.connectorNotFound", "Connector does not exist."));
  }
  assertBusinessTeamAccess(access.authContext, connector.businessTeamId);
  return { ...access, connector };
}

export async function requireMcpServerActor(request: Request, serverId: string, fallback = "mcp-server-console") {
  const access = await requireAuthenticatedActor(request, fallback);
  const server = queryOne<McpServerProfile>(
    "SELECT * FROM mcp_servers WHERE id = ? AND status <> 'deleted'",
    serverId,
  );
  if (!server) {
    throw new ApiAccessError(404, uiText("ui.api.errors.mcpServerNotFound", "MCP server does not exist."));
  }
  assertBusinessTeamAccess(access.authContext, server.businessTeamId);
  return { ...access, server };
}

export async function requireCodebaseActor(request: Request, codebaseId: string, fallback = "codebase-console") {
  const access = await requireAuthenticatedActor(request, fallback);
  const codebase = queryOne<CodebaseProfile>(
    "SELECT * FROM codebase_profiles WHERE id = ? AND status <> 'deleted'",
    codebaseId,
  );
  if (!codebase) {
    throw new ApiAccessError(404, uiText("ui.api.errors.codebaseNotFound", "Codebase does not exist."));
  }
  assertBusinessTeamAccess(access.authContext, codebase.businessTeamId);
  return { ...access, codebase };
}

export async function requireCodebaseOperatorTokenActor(
  request: Request,
  tokenId: string,
  fallback = "codebase-console",
) {
  const access = await requireAuthenticatedActor(request, fallback);
  const token = queryOne<CodebaseOperatorToken>(
    "SELECT * FROM codebase_operator_tokens WHERE id = ? AND status <> 'deleted'",
    tokenId,
  );
  if (!token) {
    throw new ApiAccessError(
      404,
      uiText("ui.api.errors.codebaseOperatorTokenNotFound", "Codebase operator token does not exist."),
    );
  }
  const codebase = queryOne<CodebaseProfile>(
    "SELECT * FROM codebase_profiles WHERE id = ? AND status <> 'deleted'",
    token.codebaseId,
  );
  if (!codebase) {
    throw new ApiAccessError(404, uiText("ui.api.errors.codebaseNotFound", "Codebase does not exist."));
  }
  assertBusinessTeamAccess(access.authContext, codebase.businessTeamId);
  return { ...access, token, codebase };
}

export async function requireTeamMemberActor(request: Request, memberId: string, fallback = "team-member-console") {
  const access = await requireAuthenticatedActor(request, fallback);
  const member = queryOne<TeamMember>(
    "SELECT * FROM team_members WHERE id = ? AND status <> 'deleted'",
    memberId,
  );
  if (!member) {
    throw new ApiAccessError(404, uiText("ui.api.errors.teamMemberNotFound", "Team member does not exist."));
  }
  assertBusinessTeamAccess(access.authContext, member.businessTeamId);
  return { ...access, member };
}

export async function requireTeamPermissionGrantActor(
  request: Request,
  grantId: string,
  fallback = "team-permission-console",
) {
  const access = await requireAuthenticatedActor(request, fallback);
  const grant = queryOne<TeamPermissionGrant>("SELECT * FROM team_permission_grants WHERE id = ?", grantId);
  if (!grant) {
    throw new ApiAccessError(
      404,
      uiText("ui.api.errors.teamPermissionGrantNotFound", "Team permission grant does not exist."),
    );
  }
  assertBusinessTeamAccess(access.authContext, grant.businessTeamId);
  return { ...access, grant };
}

export async function requireTeamAssetGrantActor(
  request: Request,
  grantId: string,
  fallback = "team-asset-console",
) {
  const access = await requireAuthenticatedActor(request, fallback);
  const grant = queryOne<TeamAssetGrant>("SELECT * FROM team_asset_grants WHERE id = ?", grantId);
  if (!grant) {
    throw new ApiAccessError(404, uiText("ui.api.errors.teamAssetGrantNotFound", "Team asset grant does not exist."));
  }
  assertBusinessTeamAccess(access.authContext, grant.businessTeamId);
  return { ...access, grant };
}

export async function requireRuntimeSessionActor(
  request: Request,
  sessionId: string,
  fallback = "runtime-session-console",
) {
  const access = await requireAuthenticatedActor(request, fallback);
  const session = queryOne<RuntimeSession>("SELECT * FROM runtime_sessions WHERE id = ?", sessionId);
  if (!session) {
    throw new ApiAccessError(404, uiText("ui.api.errors.sessionNotFound", "Session does not exist."));
  }
  assertBusinessTeamAccess(access.authContext, session.businessTeamId);
  return { ...access, session };
}

export function assertRuntimeSessionCreateAccess(
  authContext: AuthContext | null,
  input: {
    agentDefinitionId?: string | null;
    agentTeamId?: string | null;
    businessTeamId?: string | null;
    mode?: string | null;
    runtimeBindingId?: string | null;
    tenantSpaceId?: string | null;
  },
) {
  assertBusinessTeamAccess(authContext, input.businessTeamId);

  const businessTeam = queryOne<{ id: string; tenantSpaceId: string }>(
    "SELECT id, tenant_space_id FROM business_teams WHERE id = ? AND status <> 'deleted'",
    input.businessTeamId ?? "",
  );
  if (!businessTeam) {
    throw new ApiAccessError(404, uiText("ui.api.errors.businessTeamNotFound", "Business team does not exist."));
  }

  const tenantSpace = queryOne<TenantSpace>(
    "SELECT * FROM tenant_spaces WHERE id = ? AND status <> 'deleted'",
    input.tenantSpaceId ?? "",
  );
  if (!tenantSpace || tenantSpace.id !== businessTeam.tenantSpaceId) {
    throw new ApiAccessError(403, uiText("ui.api.errors.businessTeamAccessDenied", "Business team access denied."));
  }

  const runtimeBinding = queryOne<ProviderRuntimeBinding>(
    "SELECT * FROM provider_runtime_bindings WHERE id = ?",
    input.runtimeBindingId ?? "",
  );
  if (!runtimeBinding || runtimeBinding.isEnabled !== 1) {
    throw new ApiAccessError(404, uiText("ui.api.errors.runtimeBindingNotFound", "Runtime binding does not exist."));
  }
  assertBusinessTeamAccess(authContext, runtimeBinding.businessTeamId, { allowGlobal: true });
  if (runtimeBinding.businessTeamId && runtimeBinding.businessTeamId !== input.businessTeamId) {
    throw new ApiAccessError(403, uiText("ui.api.errors.businessTeamAccessDenied", "Business team access denied."));
  }

  if (input.mode === "agent_team") {
    const team = queryOne<AgentTeam>(
      "SELECT * FROM agent_teams WHERE id = ? AND status <> 'deleted'",
      input.agentTeamId ?? "",
    );
    if (!team) {
      throw new ApiAccessError(404, uiText("ui.api.errors.agentTeamNotFound", "Agent team does not exist."));
    }
    assertBusinessTeamAccess(authContext, team.businessTeamId);
    if (team.businessTeamId !== input.businessTeamId) {
      throw new ApiAccessError(403, uiText("ui.api.errors.businessTeamAccessDenied", "Business team access denied."));
    }
  }

  if (input.mode === "single_agent" && input.agentDefinitionId) {
    const definition = queryOne<AgentDefinition>(
      "SELECT * FROM agent_definitions WHERE id = ? AND status <> 'deleted'",
      input.agentDefinitionId,
    );
    if (!definition) {
      throw new ApiAccessError(404, uiText("ui.api.errors.agentDefinitionNotFound", "Agent definition does not exist."));
    }
    const shares = queryAll<AgentDefinitionShare>(
      "SELECT * FROM agent_definition_shares WHERE agent_definition_id = ?",
      input.agentDefinitionId,
    );
    if (!canReadAgentDefinition(authContext, definition, shares)) {
      throw new ApiAccessError(403, uiText("ui.api.errors.businessTeamAccessDenied", "Business team access denied."));
    }
  }
}

export async function requireTaskRunActor(request: Request, taskRunId: string, fallback = "console") {
  const access = await requireAuthenticatedActor(request, fallback);
  const taskRun = queryOne<TaskRun>("SELECT * FROM task_runs WHERE id = ?", taskRunId);
  if (!taskRun) {
    throw new ApiAccessError(404, uiText("ui.api.errors.taskRunNotFound", "Task run does not exist."));
  }
  assertBusinessTeamAccess(access.authContext, taskRun.businessTeamId);
  return { ...access, taskRun };
}

export async function requireTaskRunInterventionActor(
  request: Request,
  interventionId: string,
  fallback = "console",
) {
  const access = await requireAuthenticatedActor(request, fallback);
  const intervention = queryOne<TaskRunIntervention>(
    "SELECT * FROM task_run_interventions WHERE id = ?",
    interventionId,
  );
  if (!intervention) {
    throw new ApiAccessError(
      404,
      uiText("ui.api.errors.taskRunInterventionNotFound", "Task intervention does not exist."),
    );
  }
  const taskRun = queryOne<TaskRun>("SELECT * FROM task_runs WHERE id = ?", intervention.taskRunId);
  if (!taskRun) {
    throw new ApiAccessError(404, uiText("ui.api.errors.taskRunNotFound", "Task run does not exist."));
  }
  assertBusinessTeamAccess(access.authContext, taskRun.businessTeamId);
  return { ...access, intervention, taskRun };
}
