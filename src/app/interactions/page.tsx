import Link from "next/link";
import { Activity, Bot, Eye, Plus, UserRoundCheck, Users, Workflow } from "lucide-react";
import { DeleteResourceButton } from "@/components/delete-resource-button";
import { RuntimeSessionCreateForm } from "@/components/runtime-session-create-form";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DataTable,
  DataTableBody,
  DataTableCell,
  DataTableHead,
  DataTableHeader,
  DataTableRow,
} from "@/components/ui/data-table";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Panel, PanelBody, PanelHeader } from "@/components/ui/panel";
import { SummaryStrip } from "@/components/ui/summary-strip";
import { translateWithPack } from "@/lib/language-pack";
import { formatDateTime } from "@/lib/utils";
import { canAccessBusinessTeam, filterBusinessTeamsForAuthContext, getRequestAuthContext } from "@/server/auth-core";
import { getActiveLanguagePack } from "@/server/language-pack-store";
import {
  listAgentDefinitions,
  listAgentTeams,
  listBusinessTeams,
  listProviders,
  listProviderRuntimeBindings,
  listTenantSpaces,
} from "@/server/queries";
import { listRuntimeSessionWorkItems, listRuntimeSessions } from "@/server/runtime-session-core";

function statusVariant(status: string): "neutral" | "accent" | "success" | "warning" | "danger" {
  if (status === "running") return "accent";
  if (status === "error") return "danger";
  if (status === "idle") return "neutral";
  return "success";
}

function latestActivityVariant(type: string): "neutral" | "accent" | "success" | "warning" | "danger" {
  if (type.includes("failed") || type.includes("error")) return "danger";
  if (type.includes("approval") || type.includes("queued") || type.includes("waiting")) return "warning";
  if (type.includes("completed") || type.includes("finished")) return "success";
  if (type.includes("tool") || type.includes("message")) return "accent";
  return "neutral";
}

function compactActivityType(type: string) {
  return type.replace(/_/g, " ");
}

function activityLabel(
  t: (key: string, fallback?: string, params?: Record<string, string | number>) => string,
  type: string,
) {
  const key = `console.interactions.activity.${type}`;
  const translated = t(key);
  return translated === key ? compactActivityType(type) : translated;
}

function launchDialog(
  mode: "single_agent" | "agent_team",
  title: string,
  description: string,
  triggerLabel: string,
  props: Parameters<typeof RuntimeSessionCreateForm>[0],
) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button size="sm" variant={mode === "agent_team" ? "primary" : "secondary"}>
          <Plus className="h-4 w-4" />
          {triggerLabel}
        </Button>
      </DialogTrigger>
      <DialogContent className="w-[min(92vw,860px)]">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <DialogBody>
          <RuntimeSessionCreateForm {...props} initialMode={mode} />
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}

function ActionCard({
  icon,
  title,
  description,
  badge,
  action,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  badge: string;
  action: React.ReactNode;
}) {
  return (
    <div className="aw-kpi-card px-5 py-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--surface-subtle)] text-[var(--ink)]">
          {icon}
        </div>
        <Badge variant="neutral">{badge}</Badge>
      </div>
      <div className="mt-4 text-base font-semibold tracking-tight text-[var(--ink)]">{title}</div>
      <p className="mt-2 text-sm leading-6 text-[var(--ink-muted)]">{description}</p>
      <div className="mt-5">{action}</div>
    </div>
  );
}

export default async function RuntimeInteractionsPage() {
  const languagePack = getActiveLanguagePack();
  const t = (key: string, fallback?: string, params?: Record<string, string | number>) =>
    translateWithPack(languagePack, key, fallback, params);
  const label = (group: string, value: string) => t(`labels.${group}.${value}`, value);
  const authContext = await getRequestAuthContext();
  const businessTeams = filterBusinessTeamsForAuthContext(listBusinessTeams(), authContext);
  const visibleBusinessTeamIds = new Set(businessTeams.map((team) => team.id));
  const runtimeSessions = listRuntimeSessions().filter((session) => visibleBusinessTeamIds.has(session.businessTeamId));
  const workItems = listRuntimeSessionWorkItems().filter((item) =>
    visibleBusinessTeamIds.has(item.session.businessTeamId),
  );
  const runtimeBindings = listProviderRuntimeBindings().filter((binding) =>
    canAccessBusinessTeam(authContext, binding.businessTeamId, { allowGlobal: true }),
  );
  const providerProfiles = listProviders();
  const agentTeams = listAgentTeams().filter((team) => visibleBusinessTeamIds.has(team.businessTeamId));
  const agentDefinitions = listAgentDefinitions().filter((definition) =>
    definition.visibility === "global" ||
    canAccessBusinessTeam(authContext, definition.ownerBusinessTeamId, { allowGlobal: true }),
  );
  const visibleTenantSpaceIds = new Set(businessTeams.map((team) => team.tenantSpaceId));
  const tenantSpaces = authContext?.user.isSystemAdmin === 1
    ? listTenantSpaces()
    : listTenantSpaces().filter((space) => visibleTenantSpaceIds.has(space.id));

  const createFormProps = {
    tenantSpaces: tenantSpaces.map((space) => ({ id: space.id, name: space.name })),
    businessTeams: businessTeams.map((team) => ({ id: team.id, name: team.name })),
    runtimeBindings,
    providerProfiles,
    agentTeams: agentTeams.map((team) => ({ id: team.id, name: team.name })),
    agentDefinitions: agentDefinitions.map((definition) => ({
      id: definition.id,
      name: definition.name,
      systemPrompt: definition.systemPrompt,
      model: definition.model,
      defaultProviderProfileId: definition.defaultProviderProfileId,
      defaultRuntimeBindingId: definition.defaultRuntimeBindingId,
      harnessConfigJson: definition.harnessConfigJson,
      permissionPolicyJson: definition.permissionPolicyJson,
    })),
  } satisfies Parameters<typeof RuntimeSessionCreateForm>[0];

  const runningSessions = runtimeSessions.filter((session) => session.status === "running");
  const teamSessions = runtimeSessions.filter((session) => session.mode === "agent_team");
  const waitingWorkItems = workItems.filter((item) =>
    item.latestActivityType.includes("approval") ||
    item.latestActivityType.includes("queued") ||
    item.session.status === "error",
  );
  const recentWorkItems = workItems.slice(0, 5);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="console.interactions.eyebrow"
        title="console.interactions.title"
        description="console.interactions.pageDescription"
        badges={[
          { label: `${workItems.length} ${t("console.interactions.badges.workItems")}`, variant: "accent" },
          { label: `${runningSessions.length} ${t("ui.common.detail.running")}`, variant: "neutral" },
        ]}
      />

      <SummaryStrip
        items={[
          {
            label: "console.interactions.summary.sessions",
            value: runtimeSessions.length,
            detail: `${runningSessions.length} ${t("ui.common.detail.running")}`,
          },
          {
            label: "console.interactions.summary.workItems",
            value: workItems.length,
            detail: "console.interactions.summary.workItemsDetail",
          },
          {
            label: "console.interactions.summary.teamSessions",
            value: teamSessions.length,
            detail: "console.interactions.summary.teamDetail",
          },
          {
            label: "console.interactions.summary.waiting",
            value: waitingWorkItems.length,
            detail: "console.interactions.summary.waitingDetail",
          },
          {
            label: "ui.common.resources.runtimeBinding",
            value: runtimeBindings.length,
            detail: `${providerProfiles.length} ${t("ui.common.detail.modelServicesSelectable")}`,
          },
        ]}
      />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <Panel>
          <PanelHeader
            eyebrow="console.interactions.heroTag"
            title="console.interactions.launch.title"
            description="console.interactions.launch.description"
          />
          <PanelBody className="grid gap-4 lg:grid-cols-2">
            <ActionCard
              icon={<Bot className="h-4.5 w-4.5" />}
              title={t("console.interactions.singleAgent.title")}
              description={t("console.interactions.singleAgent.description")}
              badge={t("console.interactions.singleAgent.badge")}
              action={launchDialog(
                "single_agent",
                t("console.interactions.singleAgent.dialogTitle"),
                t("console.interactions.singleAgent.dialogDescription"),
                t("console.interactions.singleAgent.action"),
                createFormProps,
              )}
            />
            <ActionCard
              icon={<Workflow className="h-4.5 w-4.5" />}
              title={t("console.interactions.agentTeam.title")}
              description={t("console.interactions.agentTeam.description")}
              badge={t("console.interactions.agentTeam.badge")}
              action={launchDialog(
                "agent_team",
                t("console.interactions.agentTeam.dialogTitle"),
                t("console.interactions.agentTeam.dialogDescription"),
                t("console.interactions.agentTeam.action"),
                createFormProps,
              )}
            />
          </PanelBody>
        </Panel>

        <Panel>
          <PanelHeader
            eyebrow="console.interactions.recent.eyebrow"
            title="console.interactions.recent.title"
            description="console.interactions.recent.description"
          />
          <PanelBody className="p-0">
            {recentWorkItems.length ? (
              <DataTable>
                <DataTableHeader>
                  <DataTableRow className="hover:bg-transparent">
                    <DataTableHead>{t("console.interactions.columns.session")}</DataTableHead>
                    <DataTableHead>{t("console.interactions.columns.assignee")}</DataTableHead>
                    <DataTableHead>{t("console.interactions.columns.status")}</DataTableHead>
                    <DataTableHead>{t("console.interactions.columns.latestActivity")}</DataTableHead>
                    <DataTableHead align="right">{t("console.interactions.columns.actions")}</DataTableHead>
                  </DataTableRow>
                </DataTableHeader>
                <DataTableBody>
                  {recentWorkItems.map((item) => (
                    <DataTableRow key={item.session.id}>
                      <DataTableCell className="min-w-[260px]">
                        <div className="font-medium text-[var(--ink)]">{item.session.title}</div>
                        <div className="mt-1 text-xs text-[var(--ink-muted)]">{item.session.model}</div>
                      </DataTableCell>
                      <DataTableCell>
                        <div className="flex items-center gap-2">
                          {item.assigneeKind === "agent_team" ? <Users className="h-4 w-4 text-[var(--ink-subtle)]" /> : <UserRoundCheck className="h-4 w-4 text-[var(--ink-subtle)]" />}
                          <span>{item.assigneeName}</span>
                        </div>
                      </DataTableCell>
                      <DataTableCell>
                        <Badge variant={statusVariant(item.session.status)}>{label("status", item.session.status)}</Badge>
                      </DataTableCell>
                      <DataTableCell>
                        <Badge variant={latestActivityVariant(item.latestActivityType)}>
                          {activityLabel(t, item.latestActivityType)}
                        </Badge>
                      </DataTableCell>
                      <DataTableCell align="right">
                        <Link href={`/interactions/${item.session.id}`} className="text-sm font-medium text-[var(--accent)]">
                          {t("console.interactions.openSession")}
                        </Link>
                      </DataTableCell>
                    </DataTableRow>
                  ))}
                </DataTableBody>
              </DataTable>
            ) : (
              <PanelBody>
                  <div className="aw-compact-empty">
                    <div className="aw-compact-empty__title">{t("console.interactions.recent.empty")}</div>
                  <div className="aw-compact-empty__description">{t("console.interactions.recent.emptyDescription")}</div>
                </div>
              </PanelBody>
            )}
          </PanelBody>
        </Panel>
      </div>

      <Panel>
          <PanelHeader
            eyebrow="console.interactions.table.eyebrow"
            title="console.interactions.table.title"
          description="console.interactions.table.description"
        />
        <PanelBody className="p-0">
          <DataTable>
            <DataTableHeader>
              <DataTableRow className="hover:bg-transparent">
                <DataTableHead>{t("console.interactions.columns.session")}</DataTableHead>
                <DataTableHead>{t("console.interactions.columns.assignee")}</DataTableHead>
                <DataTableHead>{t("console.interactions.columns.lifecycle")}</DataTableHead>
                <DataTableHead>{t("console.interactions.columns.latestActivity")}</DataTableHead>
                <DataTableHead>{t("console.interactions.columns.runtime")}</DataTableHead>
                <DataTableHead>{t("console.interactions.columns.updatedAt")}</DataTableHead>
                <DataTableHead align="right">{t("console.interactions.columns.actions")}</DataTableHead>
              </DataTableRow>
            </DataTableHeader>
            <DataTableBody>
              {workItems.map((item) => (
                  <DataTableRow key={item.session.id}>
                    <DataTableCell className="min-w-[260px]">
                      <div className="font-medium text-[var(--ink)]">{item.session.title}</div>
                      <div className="mt-1 text-xs text-[var(--ink-muted)]">{item.session.id}</div>
                    </DataTableCell>
                    <DataTableCell>
                      <div className="flex items-center gap-2">
                        {item.assigneeKind === "agent_team" ? <Users className="h-4 w-4 text-[var(--ink-subtle)]" /> : <UserRoundCheck className="h-4 w-4 text-[var(--ink-subtle)]" />}
                        <div>
                          <div className="font-medium text-[var(--ink)]">{item.assigneeName}</div>
                          <div className="mt-0.5 text-xs text-[var(--ink-muted)]">{label("sessionMode", item.session.mode)}</div>
                        </div>
                      </div>
                    </DataTableCell>
                    <DataTableCell>
                      <Badge variant={statusVariant(item.session.status)}>{label("status", item.session.status)}</Badge>
                    </DataTableCell>
                    <DataTableCell className="min-w-[240px]">
                      <div className="flex items-center gap-2">
                        <Activity className="h-4 w-4 text-[var(--ink-subtle)]" />
                        <Badge variant={latestActivityVariant(item.latestActivityType)}>
                          {activityLabel(t, item.latestActivityType)}
                        </Badge>
                      </div>
                      <div className="mt-1 max-w-[320px] truncate text-xs text-[var(--ink-muted)]">
                        {item.latestActivityActor} · {item.latestActivitySummary || t("console.interactions.activity.noSummary")}
                      </div>
                    </DataTableCell>
                    <DataTableCell>
                      <div className="font-medium text-[var(--ink)]">{item.runtimeName}</div>
                      <div className="mt-1 text-xs text-[var(--ink-muted)]">{item.providerName} · {item.session.model}</div>
                    </DataTableCell>
                    <DataTableCell>{formatDateTime(item.latestActivityAt || item.session.updatedAt)}</DataTableCell>
                    <DataTableCell align="right">
                      <div className="flex justify-end gap-2">
                        <Link href={`/interactions/${item.session.id}`}>
                          <Button size="sm" variant="ghost">
                            <Eye className="h-4 w-4" />
                            {t("console.interactions.openSession")}
                          </Button>
                        </Link>
                        <DeleteResourceButton
                          endpoint={`/api/runtime-sessions/${item.session.id}`}
                          id={item.session.id}
                          confirmParams={{ resource: "ui.common.resources.session", name: item.session.title }}
                        />
                      </div>
                    </DataTableCell>
                  </DataTableRow>
              ))}
            </DataTableBody>
          </DataTable>
        </PanelBody>
      </Panel>

      <Panel>
        <PanelBody className="grid gap-4 md:grid-cols-3">
          {[
            {
              icon: Bot,
              title: t("console.interactions.capabilities.dialogueTitle"),
              description: t("console.interactions.capabilities.dialogueDescription"),
            },
            {
              icon: Users,
              title: t("console.interactions.capabilities.teamTitle"),
              description: t("console.interactions.capabilities.teamDescription"),
            },
            {
              icon: Workflow,
              title: t("console.interactions.capabilities.traceTitle"),
              description: t("console.interactions.capabilities.traceDescription"),
            },
          ].map((item) => (
            <div key={item.title} className="aw-kpi-card px-5 py-5">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--surface-subtle)] text-[var(--ink)]">
                <item.icon className="h-4.5 w-4.5" />
              </div>
              <div className="mt-4 text-sm font-semibold text-[var(--ink)]">{item.title}</div>
              <p className="mt-2 text-sm leading-6 text-[var(--ink-muted)]">{item.description}</p>
            </div>
          ))}
        </PanelBody>
      </Panel>
    </div>
  );
}
