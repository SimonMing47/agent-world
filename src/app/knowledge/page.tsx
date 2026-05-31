import Link from "next/link";
import {
  KnowledgeNotebookWorkspace,
  type KnowledgeNotebookEntry,
  type KnowledgeWorkspaceMetric,
  type KnowledgeNotebookSpace,
} from "@/components/knowledge-notebook-workspace";
import { KnowledgeSpaceForm } from "@/components/knowledge-space-form";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { translateWithPack } from "@/lib/language-pack";
import { formatBytes } from "@/lib/utils";
import {
  canAccessBusinessTeam,
  filterBusinessTeamsForAuthContext,
  getRequestAuthContext,
} from "@/server/auth-core";
import { listKnowledgeSpaceBindings, listKnowledgeSpaces } from "@/server/knowledge-core";
import { getKnowledgeFoundationStatus } from "@/server/knowledge-base-settings";
import { getActiveLanguagePack } from "@/server/language-pack-store";
import { getKnowledgeManagementSnapshot, listLayeredKnowledge, retryPendingKnowledgeSyncs } from "@/server/openviking-core";
import {
  listAgentDefinitions,
  listAgentTeams,
  listBusinessTeams,
  listTaskBlueprints,
  listTenantSpaces,
} from "@/server/queries";

function isSameDay(value: string, now: Date) {
  const date = new Date(value);
  return (
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()
  );
}

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

  const now = new Date();
  const totalBytes = allEntries.reduce((sum, entry) => sum + new TextEncoder().encode(entry.contentMd).length, 0);
  const todayEntryCount = allEntries.filter((entry) => isSameDay(entry.createdAt, now)).length;
  const uniqueConsumers = new Set(bindings.map((binding) => `${binding.targetType}:${binding.targetId}`)).size;
  const foundationStatus = getKnowledgeFoundationStatus();
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
  const metrics: KnowledgeWorkspaceMetric[] = [
    {
      label: t("knowledge.metrics.spaceCount"),
      value: spaces.length,
      detail: t("knowledge.metrics.spaceCountDetail", undefined, {
        count: businessTeams.filter((team) => spaces.some((space) => space.businessTeamId === team.id)).length,
      }),
    },
    {
      label: t("knowledge.metrics.entryCount"),
      value: allEntries.length,
      detail: t("knowledge.metrics.entryCountDetail", undefined, { count: todayEntryCount }),
      tone: "accent",
    },
    {
      label: t("knowledge.metrics.capacity"),
      value: formatBytes(totalBytes),
      detail: t("knowledge.metrics.capacityDetail"),
    },
    {
      label: t("knowledge.metrics.consumerCount"),
      value: uniqueConsumers,
      detail: t("knowledge.metrics.consumerCountDetail", undefined, {
        status: snapshot.process.status || "offline",
      }),
      tone: snapshot.health.ok ? "success" : "warning",
    },
  ];

  return (
    <div className="flex min-h-full flex-col gap-4">
      <PageHeader
        eyebrow="terminology.knowledge"
        title="nav.knowledge.label"
        description="nav.knowledge.description"
        className="pb-1"
        badges={[
          {
            label: `OpenViking ${t(snapshot.health.ok ? "labels.status.healthy" : "labels.status.degraded")}`,
            variant: snapshot.health.ok ? "success" : "warning",
          },
          { label: `${spaces.length} ${t("ui.common.count.knowledgeSpaces")}`, variant: "accent" },
          {
            label: `${t("settings.knowledgeBase.knowledgeFoundation.label")}: ${foundationLabel}`,
            variant: foundationStatus.state === "enabled" ? "success" : "warning",
          },
        ]}
        action={
          <div className="flex flex-wrap gap-2">
            <Button asChild size="md" variant="secondary">
              <Link href="/skills">nav.skills.label</Link>
            </Button>
            <KnowledgeSpaceForm
              tenantSpaces={tenantSpaceOptions}
              businessTeams={businessTeamOptions}
              agentTeams={agentTeamOptions}
            />
          </div>
        }
      />

      <section
        className={[
          "rounded-lg border px-4 py-3 text-sm leading-6",
          foundationStatus.state === "enabled"
            ? "border-[#bfdbfe] bg-[#eff6ff] text-[#1e3a8a]"
            : "border-[#fde68a] bg-[#fffbeb] text-[#713f12]",
        ].join(" ")}
      >
        <div className="font-semibold">
          {t("settings.knowledgeBase.knowledgeFoundation.label")} · {foundationLabel}
        </div>
        <div className="mt-1">
          {foundationModelDetail ? `${foundationModelDetail} ` : ""}
          {foundationDetail}
        </div>
      </section>

      <KnowledgeNotebookWorkspace
        spaces={notebookSpaces}
        entries={notebookEntries}
        tenantSpaces={tenantSpaceOptions}
        businessTeams={businessTeamOptions}
        agentTeams={agentTeamOptions}
        metrics={metrics}
      />
    </div>
  );
}
