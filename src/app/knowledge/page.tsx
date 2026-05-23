import Link from "next/link";
import { CircleDot, Eye, FolderSearch } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DeleteResourceButton } from "@/components/delete-resource-button";
import { KnowledgeEntryForm } from "@/components/knowledge-entry-form";
import { KnowledgeRetrievalTestDialog } from "@/components/knowledge-retrieval-test-dialog";
import { KnowledgeSpaceForm } from "@/components/knowledge-space-form";
import { PageHeader } from "@/components/page-header";
import {
  DataTable,
  DataTableBody,
  DataTableCell,
  DataTableHead,
  DataTableHeader,
  DataTableRow,
} from "@/components/ui/data-table";
import { DefinitionList } from "@/components/ui/definition-list";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Panel, PanelHeader } from "@/components/ui/panel";
import { SummaryStrip } from "@/components/ui/summary-strip";
import { translateWithPack } from "@/lib/language-pack";
import { formatBytes, formatDateTime } from "@/lib/utils";
import {
  canAccessBusinessTeam,
  filterBusinessTeamsForAuthContext,
  getRequestAuthContext,
} from "@/server/auth-core";
import { getActiveLanguagePack } from "@/server/language-pack-store";
import { listKnowledgeSpaceBindings, listKnowledgeSpaces } from "@/server/knowledge-core";
import { listLayeredKnowledge, getKnowledgeManagementSnapshot } from "@/server/openviking-core";
import {
  listAgentDefinitions,
  listAgentTeams,
  listBusinessTeams,
  listTaskBlueprints,
  listTenantSpaces,
} from "@/server/queries";

function syncStatusLabel(status: string) {
  if (status.startsWith("remote_")) return "ui.generated.c90c4dd94ff";
  if (status === "local_shadow") return "ui.generated.c76fb7df6ca";
  if (status === "remote_failed_local_shadow") return "ui.generated.c0a16be860e";
  return "ui.generated.c59a9eb4e65";
}

function syncStatusVariant(status: string): "neutral" | "accent" | "success" | "warning" | "danger" {
  if (status.startsWith("remote_")) return "success";
  if (status === "remote_failed_local_shadow") return "warning";
  if (status === "local_shadow") return "accent";
  return "neutral";
}

function typeLabel(type: string) {
  const labels: Record<string, string> = {
    global: "ui.common.knowledgeType.global",
    team: "ui.common.knowledgeType.team",
    project: "ui.common.knowledgeType.project",
    agent_team: "ui.common.knowledgeType.agentTeam",
  };
  return labels[type] ?? type;
}

function statusLabel(status: string) {
  const labels: Record<string, string> = {
    active: "labels.status.active",
    paused: "labels.status.paused",
    archived: "labels.status.archived",
  };
  return labels[status] ?? status;
}

function statusVariant(status: string): "neutral" | "accent" | "success" | "warning" | "danger" {
  if (status === "active") return "success";
  if (status === "paused") return "warning";
  if (status === "archived") return "neutral";
  return "neutral";
}

function visibilityLabel(visibility: string) {
  const labels: Record<string, string> = {
    private: "labels.visibility.private",
    team: "labels.visibility.team",
    global: "labels.visibility.global",
  };
  return labels[visibility] ?? visibility;
}

function visibilityVariant(visibility: string): "neutral" | "accent" | "success" | "warning" | "danger" {
  if (visibility === "private") return "danger";
  if (visibility === "team") return "success";
  if (visibility === "global") return "accent";
  return "neutral";
}

function accessLevelVariant(accessLevel: string): "neutral" | "accent" | "success" | "warning" | "danger" {
  if (accessLevel === "write") return "accent";
  if (accessLevel === "archive") return "warning";
  return "neutral";
}

function isSameDay(value: string, now: Date) {
  const date = new Date(value);
  return (
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()
  );
}

function EmptyTableState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="px-4 py-8">
      <div className="aw-compact-empty">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-[18px] bg-white text-[var(--ink)] shadow-[var(--shadow-soft)]">
          <FolderSearch className="h-5 w-5" />
        </div>
        <div className="aw-compact-empty__title">{title}</div>
        <p className="aw-compact-empty__description">{description}</p>
        {action ? <div className="pt-1">{action}</div> : null}
      </div>
    </div>
  );
}

export default async function KnowledgePage() {
  const languagePack = getActiveLanguagePack();
  const t = (key: string, fallback?: string, params?: Record<string, string | number>) =>
    translateWithPack(languagePack, key, fallback, params);
  const authContext = await getRequestAuthContext();
  const [snapshot, rawSpaces, rawBindings, tenantSpaces, rawBusinessTeams, rawAgentTeams, rawAgentDefinitions, rawTaskBlueprints, rawEntries] =
    await Promise.all([
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
  const visibleTenantSpaces = authContext?.user.isSystemAdmin === 1
    ? tenantSpaces
    : tenantSpaces.filter((space) => visibleTenantSpaceIds.has(space.id));

  const now = new Date();
  const totalBytes = allEntries.reduce((sum, entry) => sum + new TextEncoder().encode(entry.contentMd).length, 0);
  const todayEntryCount = allEntries.filter((entry) => isSameDay(entry.createdAt, now)).length;
  const uniqueConsumers = new Set(bindings.map((binding) => `${binding.targetType}:${binding.targetId}`)).size;

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

  const recentEntries = allEntries.slice(0, 100);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="ui.generated.c1dda51f9e3"
        title="knowledge.page.title"
        description="knowledge.page.description"
        badges={[
          {
            label: snapshot.health.ok ? "knowledge.status.connected" : "knowledge.status.degraded",
            variant: snapshot.health.ok ? "success" : "warning",
          },
          { label: `${spaces.length} ${t("ui.common.count.knowledgeSpaces", "个知识空间")}`, variant: "accent" },
        ]}
        action={
          <div className="flex flex-wrap gap-2">
            <Button asChild size="md" variant="secondary">
              <Link href="/skills">knowledge.page.skillAction</Link>
            </Button>
            <KnowledgeSpaceForm
              tenantSpaces={visibleTenantSpaces.map((space) => ({ id: space.id, name: space.name }))}
              businessTeams={businessTeams.map((team) => ({ id: team.id, name: team.name, tenantSpaceId: team.tenantSpaceId }))}
              agentTeams={agentTeams.map((team) => ({ id: team.id, businessTeamId: team.businessTeamId, name: team.name }))}
            />
          </div>
        }
      />

      <SummaryStrip
        items={[
          {
            label: "knowledge.metrics.spaceCount",
            value: spaces.length,
            detail: t("knowledge.metrics.spaceCountDetail", undefined, {
              count: businessTeams.filter((team) => spaces.some((space) => space.businessTeamId === team.id)).length,
            }),
          },
          {
            label: "knowledge.metrics.entryCount",
            value: allEntries.length,
            detail: t("knowledge.metrics.entryCountDetail", undefined, { count: todayEntryCount }),
          },
          {
            label: "knowledge.metrics.capacity",
            value: formatBytes(totalBytes),
            detail: "knowledge.metrics.capacityDetail",
          },
          {
            label: (
              <span className="inline-flex items-center gap-2">
                <CircleDot className={`h-3.5 w-3.5 ${snapshot.health.ok ? "text-[#16a34a]" : "text-[var(--warning)]"}`} />
                knowledge.metrics.consumerCount
              </span>
            ),
            value: uniqueConsumers,
            detail: t("knowledge.metrics.consumerCountDetail", undefined, {
              status: snapshot.process.status || "offline",
            }),
          },
        ]}
      />

      <Panel>
        <PanelHeader
          eyebrow="knowledge.spaces.eyebrow"
          title="knowledge.spaces.title"
          description="knowledge.spaces.description"
        />
        {spaces.length ? (
          <DataTable>
            <DataTableHeader>
              <DataTableRow>
                <DataTableHead>knowledge.spaces.columns.name</DataTableHead>
                <DataTableHead>ui.generated.ce4e46c7235</DataTableHead>
                <DataTableHead>knowledge.spaces.columns.visibility</DataTableHead>
                <DataTableHead>knowledge.spaces.columns.consumers</DataTableHead>
                <DataTableHead>knowledge.spaces.columns.entries</DataTableHead>
                <DataTableHead>knowledge.spaces.columns.uri</DataTableHead>
                <DataTableHead align="right">ui.generated.cf3ea6d345e</DataTableHead>
              </DataTableRow>
            </DataTableHeader>
            <DataTableBody>
              {spaces.map((space) => {
                const teamName = space.businessTeamId ? businessTeamById.get(space.businessTeamId)?.name : null;
                const tenantName = tenantNameById.get(space.tenantSpaceId) ?? t("overview.common.empty");
                const agentTeamName = space.agentTeamId ? agentTeamById.get(space.agentTeamId)?.name : null;
                const consumers = (consumerGroups.get(space.id) ?? []).sort((left, right) => left.loadOrder - right.loadOrder);
                return (
                  <DataTableRow key={space.id}>
                    <DataTableCell className="min-w-[260px]">
                      <div className="font-semibold text-[var(--ink)]">{space.name}</div>
                      <div className="mt-1 text-xs text-[var(--ink-subtle)]">{tenantName}</div>
                      <div className="mt-1 text-xs leading-5 text-[var(--ink-muted)]">
                        {teamName ?? agentTeamName ?? space.projectKey ?? t("knowledge.spaces.unscoped")}
                      </div>
                    </DataTableCell>
                    <DataTableCell>
                      <div className="flex flex-wrap gap-2">
                        <Badge variant="neutral">{typeLabel(space.spaceType)}</Badge>
                        <Badge variant={statusVariant(space.status)}>{statusLabel(space.status)}</Badge>
                      </div>
                    </DataTableCell>
                    <DataTableCell>
                      <Badge variant={visibilityVariant(space.visibility)}>{visibilityLabel(space.visibility)}</Badge>
                    </DataTableCell>
                    <DataTableCell className="min-w-[260px]">
                      {consumers.length ? (
                        <div className="flex flex-wrap gap-2">
                          {consumers.slice(0, 3).map((consumer) => (
                            <Badge key={consumer.id} variant={accessLevelVariant(consumer.accessLevel)}>
                              {consumer.name}
                            </Badge>
                          ))}
                          {consumers.length > 3 ? (
                            <Badge variant="neutral">
                              {t("knowledge.spaces.moreConsumers", undefined, { count: consumers.length - 3 })}
                            </Badge>
                          ) : null}
                        </div>
                      ) : (
                        <span className="text-sm text-[var(--ink-subtle)]">knowledge.spaces.noConsumers</span>
                      )}
                    </DataTableCell>
                    <DataTableCell>{entriesBySpaceId.get(space.id) ?? 0}</DataTableCell>
                    <DataTableCell className="max-w-[360px] break-all font-mono text-xs">{space.vikingUri}</DataTableCell>
                    <DataTableCell align="right">
                      <div className="flex flex-wrap justify-end gap-2">
                        <KnowledgeRetrievalTestDialog knowledgeSpaceId={space.id} knowledgeSpaceName={space.name} />
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button size="sm" variant="ghost">
                              <Eye className="h-4 w-4" />
                              ui.generated.cf7acefd2d4
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="w-[min(92vw,960px)]">
                            <DialogHeader>
                              <DialogTitle>{space.name}</DialogTitle>
                              <DialogDescription>knowledge.spaces.detailDescription</DialogDescription>
                            </DialogHeader>
                            <DialogBody className="space-y-5">
                              <DefinitionList
                                columnsClassName="sm:grid-cols-2"
                                items={[
                                  { label: "ID", value: space.id },
                                  { label: "ui.generated.c3537d5ef90", value: space.slug },
                                  { label: "ui.generated.ce4e46c7235", value: typeLabel(space.spaceType) },
                                  { label: "knowledge.spaces.columns.visibility", value: visibilityLabel(space.visibility) },
                                  { label: "ui.generated.c62e951a692", value: statusLabel(space.status) },
                                  { label: "knowledge.spaces.columns.entries", value: String(entriesBySpaceId.get(space.id) ?? 0) },
                                  { label: "knowledge.spaces.columns.uri", value: <span className="break-all font-mono text-xs">{space.vikingUri}</span> },
                                  { label: "knowledge.spaces.ownerTeam", value: teamName ?? t("overview.common.empty") },
                                  { label: "ui.generated.c70f970c1fc", value: agentTeamName ?? t("overview.common.empty") },
                                  { label: "ui.generated.cc7e9d69ec3", value: space.projectKey ?? t("overview.common.empty") },
                                ]}
                              />
                              <div className="rounded-[20px] bg-[rgba(245,245,247,0.92)] px-5 py-5 ring-1 ring-black/4">
                                <div className="text-sm font-semibold text-[var(--ink)]">knowledge.spaces.consumerPanelTitle</div>
                                <div className="mt-3 flex flex-wrap gap-2">
                                  {consumers.length ? consumers.map((consumer) => (
                                    <Badge key={consumer.id} variant={accessLevelVariant(consumer.accessLevel)}>
                                      {consumer.name}
                                    </Badge>
                                  )) : (
                                    <span className="text-sm text-[var(--ink-subtle)]">knowledge.spaces.noConsumers</span>
                                  )}
                                </div>
                              </div>
                              <div className="rounded-[20px] bg-[rgba(245,245,247,0.92)] px-5 py-5 text-sm leading-7 text-[var(--ink-muted)] ring-1 ring-black/4">
                                {space.description || t("knowledge.spaces.noDescription")}
                              </div>
                            </DialogBody>
                          </DialogContent>
                        </Dialog>
                        <KnowledgeSpaceForm
                          tenantSpaces={visibleTenantSpaces.map((tenantSpace) => ({ id: tenantSpace.id, name: tenantSpace.name }))}
                          businessTeams={businessTeams.map((team) => ({ id: team.id, name: team.name, tenantSpaceId: team.tenantSpaceId }))}
                          agentTeams={agentTeams.map((team) => ({ id: team.id, businessTeamId: team.businessTeamId, name: team.name }))}
                          space={space}
                          triggerLabel="ui.generated.ca7f814c0a4"
                        />
                        <DeleteResourceButton
                          endpoint="/api/knowledge/spaces"
                          id={space.id}
                          confirmParams={{ resource: "ui.common.resources.knowledgeSpace", name: space.name }}
                        />
                      </div>
                    </DataTableCell>
                  </DataTableRow>
                );
              })}
            </DataTableBody>
          </DataTable>
        ) : (
          <EmptyTableState
            title={t("knowledge.spaces.emptyTitle")}
            description={t("knowledge.spaces.emptyDescription")}
            action={
              <KnowledgeSpaceForm
                tenantSpaces={visibleTenantSpaces.map((space) => ({ id: space.id, name: space.name }))}
                businessTeams={businessTeams.map((team) => ({ id: team.id, name: team.name, tenantSpaceId: team.tenantSpaceId }))}
                agentTeams={agentTeams.map((team) => ({ id: team.id, businessTeamId: team.businessTeamId, name: team.name }))}
              />
            }
          />
        )}
      </Panel>

      <Panel>
        <PanelHeader
          eyebrow="knowledge.entries.eyebrow"
          title="knowledge.entries.title"
          description="knowledge.entries.description"
          action={
            <div className="flex flex-wrap gap-2">
              <Button asChild size="sm" variant="ghost">
                <Link href="/skills">knowledge.entries.skillAction</Link>
              </Button>
              <KnowledgeEntryForm
                spaces={spaces.map((space) => ({ id: space.id, name: space.name }))}
                triggerLabel="ui.generated.c1880d5bbcc"
              />
            </div>
          }
        />
        {recentEntries.length ? (
          <DataTable>
            <DataTableHeader>
              <DataTableRow>
                <DataTableHead>knowledge.entries.columns.title</DataTableHead>
                <DataTableHead>knowledge.entries.columns.space</DataTableHead>
                <DataTableHead>knowledge.entries.columns.sync</DataTableHead>
                <DataTableHead>knowledge.entries.columns.size</DataTableHead>
                <DataTableHead>knowledge.entries.columns.updated</DataTableHead>
                <DataTableHead>knowledge.entries.columns.uri</DataTableHead>
                <DataTableHead align="right">ui.generated.cf3ea6d345e</DataTableHead>
              </DataTableRow>
            </DataTableHeader>
            <DataTableBody>
              {recentEntries.map((entry) => {
                const space = entry.knowledgeSpaceId ? spaces.find((item) => item.id === entry.knowledgeSpaceId) : null;
                return (
                  <DataTableRow key={entry.id}>
                    <DataTableCell className="min-w-[260px]">
                      <div className="font-semibold text-[var(--ink)]">{entry.title}</div>
                      <div className="mt-1 text-xs text-[var(--ink-muted)]">{entry.sourceType}</div>
                    </DataTableCell>
                    <DataTableCell>{space?.name ?? "knowledge.entries.unassignedSpace"}</DataTableCell>
                    <DataTableCell>
                      <Badge variant={syncStatusVariant(entry.syncStatus)}>{syncStatusLabel(entry.syncStatus)}</Badge>
                    </DataTableCell>
                    <DataTableCell>{formatBytes(new TextEncoder().encode(entry.contentMd).length)}</DataTableCell>
                    <DataTableCell>{formatDateTime(entry.createdAt)}</DataTableCell>
                    <DataTableCell className="max-w-[360px] break-all font-mono text-xs">{entry.vikingUri}</DataTableCell>
                    <DataTableCell align="right">
                      <div className="flex flex-wrap justify-end gap-2">
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button size="sm" variant="ghost">
                              <Eye className="h-4 w-4" />
                              ui.generated.cf7acefd2d4
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="w-[min(96vw,980px)]">
                            <DialogHeader>
                              <DialogTitle>{entry.title}</DialogTitle>
                              <DialogDescription>knowledge.entries.detailDescription</DialogDescription>
                            </DialogHeader>
                            <DialogBody className="space-y-5">
                              <DefinitionList
                                columnsClassName="sm:grid-cols-2"
                                items={[
                                  { label: "ID", value: entry.id },
                                  { label: "knowledge.entries.columns.space", value: space?.name ?? t("knowledge.entries.unassignedSpace") },
                                  { label: "ui.generated.c7895e237ab", value: entry.layer },
                                  { label: "Scope", value: entry.scopeKey },
                                  { label: "ui.generated.cc63f79e636", value: entry.sourceType },
                                  { label: "knowledge.entries.columns.sync", value: t(syncStatusLabel(entry.syncStatus)) },
                                  { label: "knowledge.entries.columns.uri", value: <span className="break-all font-mono text-xs">{entry.vikingUri}</span> },
                                  {
                                    label: "ui.generated.cdb9e375556",
                                    value: <pre className="whitespace-pre-wrap break-all font-mono text-xs">{entry.metadataJson}</pre>,
                                  },
                                ]}
                              />
                              <pre className="max-h-[420px] overflow-auto rounded-[18px] bg-[rgba(245,245,247,0.92)] p-4 text-xs leading-6 text-[var(--ink-muted)] ring-1 ring-black/4">
                                {entry.contentMd}
                              </pre>
                            </DialogBody>
                          </DialogContent>
                        </Dialog>
                        <KnowledgeEntryForm
                          spaces={spaces.map((spaceItem) => ({ id: spaceItem.id, name: spaceItem.name }))}
                          entry={entry}
                          triggerLabel="ui.generated.ca7f814c0a4"
                        />
                        <DeleteResourceButton
                          endpoint="/api/knowledge/entries"
                          id={entry.id}
                          confirmParams={{ resource: "ui.common.resources.knowledgeEntry", name: entry.title }}
                        />
                      </div>
                    </DataTableCell>
                  </DataTableRow>
                );
              })}
            </DataTableBody>
          </DataTable>
        ) : (
          <EmptyTableState
            title={t("knowledge.entries.emptyTitle")}
            description={t("knowledge.entries.emptyDescription")}
            action={
              <KnowledgeEntryForm
                spaces={spaces.map((space) => ({ id: space.id, name: space.name }))}
                triggerLabel="ui.generated.c1880d5bbcc"
              />
            }
          />
        )}
      </Panel>
    </div>
  );
}
