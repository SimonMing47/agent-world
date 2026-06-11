import Link from "next/link";
import {
  KnowledgeNotebookWorkspace,
  type KnowledgeNotebookEntry,
  type KnowledgeNotebookSpace,
} from "@/components/knowledge-notebook-workspace";
import { KnowledgeSpaceForm } from "@/components/knowledge-space-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { translateWithPack } from "@/lib/language-pack";
import {
  canAccessBusinessTeam,
  filterBusinessTeamsForAuthContext,
  getRequestAuthContext,
} from "@/server/auth-core";
import { listKnowledgeSpaceBindings, listKnowledgeSpaces } from "@/server/knowledge-core";
import { getKnowledgeCodebaseEngineStatus, getKnowledgeFoundationStatus } from "@/server/knowledge-base-settings";
import { getActiveLanguagePack } from "@/server/language-pack-store";
import { getKnowledgeManagementSnapshot, listLayeredKnowledge, retryPendingKnowledgeSyncs } from "@/server/knowledge-engine";
import {
  listAgentDefinitions,
  listAgentTeams,
  listBusinessTeams,
  listTaskBlueprints,
  listTenantSpaces,
} from "@/server/queries";

export default async function KnowledgePage() {
  const languagePack = getActiveLanguagePack();
  const t = (key: string, fallback?: string, params?: Record<string, string | number>) =>
    translateWithPack(languagePack, key, fallback, params);
  const authContext = await getRequestAuthContext();
  await retryPendingKnowledgeSyncs(3);
  const [
    snapshot,
    rawSpaces,
    rawBindings,
    tenantSpaces,
    rawBusinessTeams,
    rawAgentTeams,
    rawAgentDefinitions,
    rawTaskBlueprints,
    rawEntries,
  ] = await Promise.all([
    getKnowledgeManagementSnapshot(),
    Promise.resolve(listKnowledgeSpaces()),
    Promise.resolve(listKnowledgeSpaceBindings()),
    Promise.resolve(listTenantSpaces()),
    Promise.resolve(listBusinessTeams()),
    Promise.resolve(listAgentTeams()),
    Promise.resolve(listAgentDefinitions()),
    Promise.resolve(listTaskBlueprints()),
    Promise.resolve(listLayeredKnowledge(500)),
  ]);

  const businessTeams = filterBusinessTeamsForAuthContext(rawBusinessTeams, authContext);
  const visibleBusinessTeamIds = new Set(businessTeams.map((team) => team.id));
  const agentTeams = rawAgentTeams.filter((team) => visibleBusinessTeamIds.has(team.businessTeamId));
  const visibleAgentTeamIds = new Set(agentTeams.map((team) => team.id));
  const agentDefinitions = rawAgentDefinitions.filter((agent) =>
    canAccessBusinessTeam(authContext, agent.ownerBusinessTeamId, { allowGlobal: true }),
  );
  const taskBlueprints = rawTaskBlueprints.filter((blueprint) =>
    canAccessBusinessTeam(authContext, blueprint.ownerBusinessTeamId),
  );
  const spaces = rawSpaces.filter((space) => {
    if (space.agentTeamId) return visibleAgentTeamIds.has(space.agentTeamId);
    return canAccessBusinessTeam(authContext, space.businessTeamId, { allowGlobal: space.visibility === "global" });
  });
  const visibleSpaceIds = new Set(spaces.map((space) => space.id));
  const bindings = rawBindings.filter((binding) => visibleSpaceIds.has(binding.knowledgeSpaceId));
  const allEntries = rawEntries.filter((entry) => entry.knowledgeSpaceId && visibleSpaceIds.has(entry.knowledgeSpaceId));
  const visibleTenantSpaceIds = new Set(businessTeams.map((team) => team.tenantSpaceId));
  const visibleTenantSpaces =
    authContext?.user.isSystemAdmin === 1
      ? tenantSpaces
      : tenantSpaces.filter((space) => visibleTenantSpaceIds.has(space.id));

  const foundationStatus = getKnowledgeFoundationStatus();
  const codebaseEngineStatus = getKnowledgeCodebaseEngineStatus();
  const foundationStatusLabelKey =
    foundationStatus.state === "enabled"
      ? "settings.knowledgeBase.status.enabled"
      : foundationStatus.state === "pending_api_key"
        ? "settings.knowledgeBase.status.apiKeyRequired"
        : "settings.knowledgeBase.status.unconfigured";
  const foundationDetailKey =
    foundationStatus.state === "enabled"
      ? "settings.knowledgeBase.messages.foundationReady"
      : foundationStatus.state === "pending_api_key"
        ? "settings.knowledgeBase.warnings.apiKeyMissing"
        : "settings.knowledgeBase.warnings.foundationMissing";
  const foundationLabel = t(foundationStatusLabelKey);
  const foundationDetail = t(foundationDetailKey);
  const codebaseEngineProviderKey =
    codebaseEngineStatus.provider === "tree_sitter"
      ? "settings.knowledgeBase.codebaseEngine.providers.treeSitter"
      : `settings.knowledgeBase.codebaseEngine.providers.${codebaseEngineStatus.provider}`;
  const foundationModelDetail = foundationStatus.model
    ? `${foundationStatus.model} · ${foundationStatus.provider || t("settings.knowledgeBase.status.unconfigured")}`
    : "";

  const tenantNameById = new Map(visibleTenantSpaces.map((space) => [space.id, space.name]));
  const businessTeamById = new Map(businessTeams.map((team) => [team.id, team]));
  const agentTeamById = new Map(agentTeams.map((team) => [team.id, team]));
  const agentDefinitionById = new Map(agentDefinitions.map((agent) => [agent.id, agent]));
  const taskBlueprintById = new Map(taskBlueprints.map((blueprint) => [blueprint.id, blueprint]));
  const entriesBySpaceId = new Map<string, number>();
  for (const entry of allEntries) {
    if (!entry.knowledgeSpaceId) continue;
    entriesBySpaceId.set(entry.knowledgeSpaceId, (entriesBySpaceId.get(entry.knowledgeSpaceId) ?? 0) + 1);
  }

  const consumerGroups = new Map<
    string,
    Array<{
      id: string;
      name: string;
      targetType: string;
      accessLevel: string;
      loadOrder: number;
    }>
  >();
  for (const binding of bindings) {
    const targetName =
      (binding.targetType === "business_team" ? businessTeamById.get(binding.targetId)?.name : null) ??
      (binding.targetType === "agent_team" ? agentTeamById.get(binding.targetId)?.name : null) ??
      (binding.targetType === "agent_definition" ? agentDefinitionById.get(binding.targetId)?.name : null) ??
      (binding.targetType === "task_blueprint" ? taskBlueprintById.get(binding.targetId)?.name : null) ??
      binding.targetId;
    const current = consumerGroups.get(binding.knowledgeSpaceId) ?? [];
    current.push({
      id: binding.id,
      name: targetName || binding.targetId,
      targetType: binding.targetType,
      accessLevel: binding.accessLevel,
      loadOrder: binding.loadOrder,
    });
    consumerGroups.set(binding.knowledgeSpaceId, current);
  }

  const notebookSpaces: KnowledgeNotebookSpace[] = spaces.map((space) => {
    const teamName = space.businessTeamId ? businessTeamById.get(space.businessTeamId)?.name : null;
    const tenantName = tenantNameById.get(space.tenantSpaceId) ?? t("overview.common.empty");
    const agentTeamName = space.agentTeamId ? agentTeamById.get(space.agentTeamId)?.name : null;
    const consumers = (consumerGroups.get(space.id) ?? []).sort((left, right) => left.loadOrder - right.loadOrder);
    const consumerName = consumers[0]?.name;

    return {
      ...space,
      tenantName,
      ownerName: teamName ?? agentTeamName ?? consumerName ?? space.projectKey ?? t("knowledge.spaces.unscoped"),
      entryCount: entriesBySpaceId.get(space.id) ?? 0,
    };
  });

  const notebookEntries: KnowledgeNotebookEntry[] = allEntries.map((entry) => ({
    id: entry.id,
    knowledgeSpaceId: entry.knowledgeSpaceId,
    layer: entry.layer,
    scopeKey: entry.scopeKey,
    skillId: entry.skillId,
    vikingUri: entry.vikingUri,
    title: entry.title,
    contentMd: entry.contentMd,
    metadataJson: entry.metadataJson,
    sourceType: entry.sourceType,
    syncStatus: entry.syncStatus,
    syncError: entry.syncError,
    createdAt: entry.createdAt,
    updatedAt: entry.updatedAt,
    updatedBy: entry.updatedBy,
    revision: entry.revision,
  }));

  const tenantSpaceOptions = visibleTenantSpaces.map((space) => ({ id: space.id, name: space.name }));
  const businessTeamOptions = businessTeams.map((team) => ({
    id: team.id,
    name: team.name,
    tenantSpaceId: team.tenantSpaceId,
  }));
  const agentTeamOptions = agentTeams.map((team) => ({
    id: team.id,
    businessTeamId: team.businessTeamId,
    name: team.name,
  }));
  return (
    <div className="flex min-h-full flex-col gap-3">
      <section className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-[var(--line)] pb-2">
        <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1.5">
          <div className="min-w-0">
            <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--ink-subtle)]">
              {t("knowledge.hub.eyebrow")}
            </div>
            <h1 className="truncate text-xl font-semibold tracking-normal text-[var(--ink)]">
              {t("knowledge.hub.title")}
            </h1>
          </div>
          <div className="hidden max-w-[520px] text-xs leading-5 text-[var(--ink-muted)] xl:block">
            {t("knowledge.hub.description")}
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <Badge variant={snapshot.health.ok ? "success" : "warning"}>
            {t("settings.knowledge.engineName")} {t(snapshot.health.ok ? "labels.status.healthy" : "labels.status.degraded")}
          </Badge>
          <Badge variant="accent">{t("knowledge.hub.spaceBadge", undefined, { count: spaces.length })}</Badge>
          <Badge variant={foundationStatus.state === "enabled" ? "success" : "warning"}>
            {foundationLabel}
          </Badge>
          <Badge
            variant={
              codebaseEngineStatus.state === "configured"
                ? "success"
                : codebaseEngineStatus.state === "disabled"
                  ? "neutral"
                  : "warning"
            }
          >
            {t(codebaseEngineProviderKey)} · {codebaseEngineStatus.label}
          </Badge>
          {foundationModelDetail ? (
            <span className="hidden max-w-[260px] truncate text-xs text-[var(--ink-subtle)] lg:inline">
              {foundationModelDetail} · {foundationDetail}
            </span>
          ) : null}
          <Button asChild size="sm" variant="secondary">
            <Link href="/skills">nav.skills.label</Link>
          </Button>
          <KnowledgeSpaceForm
            tenantSpaces={tenantSpaceOptions}
            businessTeams={businessTeamOptions}
            agentTeams={agentTeamOptions}
          />
        </div>
      </section>

      <KnowledgeNotebookWorkspace
        spaces={notebookSpaces}
        entries={notebookEntries}
        tenantSpaces={tenantSpaceOptions}
        businessTeams={businessTeamOptions}
        agentTeams={agentTeamOptions}
      />
    </div>
  );
}
