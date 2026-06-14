import { uiText } from "@/lib/language-pack";
import { ApiAccessError, assertBusinessTeamAccess } from "@/server/api-access-control";
import { type AuthContext } from "@/server/auth-core";
import { queryOne, type AgentTeam } from "@/server/db";
import { listKnowledgeSpaces } from "@/server/knowledge-core";

type KnowledgeSpaceAccessTarget = {
  businessTeamId?: string | null;
  agentTeamId?: string | null;
  visibility?: string | null;
};

export function resolveKnowledgeSpaceBusinessTeamId(
  target: string | KnowledgeSpaceAccessTarget | null | undefined,
) {
  if (!target) return null;
  const space = typeof target === "string" ? listKnowledgeSpaces().find((item) => item.id === target) : target;
  if (!space) return null;
  if (space.businessTeamId) return space.businessTeamId;
  if (space.agentTeamId) {
    return queryOne<AgentTeam>("SELECT * FROM agent_teams WHERE id = ?", space.agentTeamId)?.businessTeamId ?? null;
  }
  return null;
}

export function getKnowledgeSpaceOrThrow(spaceId: string | null | undefined) {
  const space = spaceId ? listKnowledgeSpaces().find((item) => item.id === spaceId) : null;
  if (!space) {
    throw new ApiAccessError(
      404,
      uiText("ui.api.errors.knowledgeSpaceNotFound", "Knowledge space does not exist."),
    );
  }
  return space;
}

export function assertKnowledgeSpaceAccess(
  authContext: AuthContext | null,
  spaceId: string | null | undefined,
  options: { allowGlobal?: boolean } = {},
) {
  const space = getKnowledgeSpaceOrThrow(spaceId);
  assertBusinessTeamAccess(authContext, resolveKnowledgeSpaceBusinessTeamId(space), {
    allowGlobal: options.allowGlobal && space.visibility === "global",
  });
  return space;
}
