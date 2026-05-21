import Link from "next/link";
import { ArrowRight, Bot, Eye, MessageSquareMore, Plus, Users, Workflow } from "lucide-react";
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
import { uiText } from "@/lib/language-pack";
import { translateSessionMode, translateStatus } from "@/lib/presentation";
import { formatDateTime } from "@/lib/utils";
import { canAccessBusinessTeam, filterBusinessTeamsForAuthContext, getRequestAuthContext } from "@/server/auth-core";
import {
  listAgentDefinitions,
  listAgentTeams,
  listBusinessTeams,
  listProviders,
  listProviderRuntimeBindings,
  listTenantSpaces,
} from "@/server/queries";
import { listRuntimeSessions } from "@/server/runtime-session-core";

function statusVariant(status: string): "neutral" | "accent" | "success" | "warning" | "danger" {
  if (status === "running") return "accent";
  if (status === "error") return "danger";
  if (status === "idle") return "neutral";
  return "success";
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

export default async function RuntimeInteractionsPage() {
  const authContext = await getRequestAuthContext();
  const businessTeams = filterBusinessTeamsForAuthContext(listBusinessTeams(), authContext);
  const visibleBusinessTeamIds = new Set(businessTeams.map((team) => team.id));
  const runtimeSessions = listRuntimeSessions().filter((session) => visibleBusinessTeamIds.has(session.businessTeamId));
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
  const recentSessions = runtimeSessions.slice(0, 3);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="console.interactions.eyebrow"
        title="console.interactions.title"
        description="console.interactions.pageDescription"
        badges={[
          { label: <>{runtimeSessions.length} ui.common.count.sessions</>, variant: "accent" },
          { label: <>{runningSessions.length} ui.common.detail.running</>, variant: "neutral" },
        ]}
      />

      <section className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <Panel className="border-white/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(248,249,252,0.96))]">
          <PanelBody className="space-y-6 px-6 py-6">
            <div className="space-y-3">
              <div className="inline-flex items-center gap-2 rounded-full bg-[rgba(29,78,216,0.08)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--accent)]">
                <MessageSquareMore className="h-3.5 w-3.5" />
                {uiText("console.interactions.heroTag")}
              </div>
              <div className="max-w-2xl space-y-2">
                <h2 className="text-[30px] font-semibold tracking-normal text-[var(--ink)] sm:text-[34px]">
                  {uiText("console.interactions.heroTitle")}
                </h2>
                <p className="text-sm leading-7 text-[var(--ink-muted)]">
                  {uiText("console.interactions.heroDescription")}
                </p>
              </div>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <div className="rounded-[24px] bg-white p-6 shadow-[var(--shadow-medium)] ring-1 ring-black/4">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-2">
                    <div className="flex h-11 w-11 items-center justify-center rounded-[16px] bg-[rgba(15,23,42,0.05)] text-[var(--ink)]">
                      <Bot className="h-5 w-5" />
                    </div>
                    <div className="text-base font-semibold text-[var(--ink)]">
                      {uiText("console.interactions.singleAgent.title")}
                    </div>
                  </div>
                  <Badge variant="neutral">{uiText("console.interactions.singleAgent.badge")}</Badge>
                </div>
                <p className="mt-3 text-sm leading-7 text-[var(--ink-muted)]">
                  {uiText("console.interactions.singleAgent.description")}
                </p>
                <div className="mt-5">
                  {launchDialog(
                    "single_agent",
                    uiText("console.interactions.singleAgent.dialogTitle"),
                    uiText("console.interactions.singleAgent.dialogDescription"),
                    uiText("console.interactions.singleAgent.action"),
                    createFormProps,
                  )}
                </div>
              </div>

              <div className="rounded-[24px] bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(241,245,255,0.96))] p-6 shadow-[var(--shadow-medium)] ring-1 ring-[rgba(29,78,216,0.08)]">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-2">
                    <div className="flex h-11 w-11 items-center justify-center rounded-[16px] bg-[rgba(29,78,216,0.12)] text-[var(--accent)]">
                      <Workflow className="h-5 w-5" />
                    </div>
                    <div className="text-base font-semibold text-[var(--ink)]">
                      {uiText("console.interactions.agentTeam.title")}
                    </div>
                  </div>
                  <Badge variant="accent">{uiText("console.interactions.agentTeam.badge")}</Badge>
                </div>
                <p className="mt-3 text-sm leading-7 text-[var(--ink-muted)]">
                  {uiText("console.interactions.agentTeam.description")}
                </p>
                <div className="mt-5">
                  {launchDialog(
                    "agent_team",
                    uiText("console.interactions.agentTeam.dialogTitle"),
                    uiText("console.interactions.agentTeam.dialogDescription"),
                    uiText("console.interactions.agentTeam.action"),
                    createFormProps,
                  )}
                </div>
              </div>
            </div>
          </PanelBody>
        </Panel>

        <Panel>
          <PanelHeader
            eyebrow="console.interactions.recent.eyebrow"
            title="console.interactions.recent.title"
            description="console.interactions.recent.description"
          />
          <PanelBody className="space-y-3">
            {recentSessions.length ? (
              recentSessions.map((session) => (
                <Link
                  key={session.id}
                  href={`/interactions/${session.id}`}
                  className="group block rounded-[22px] bg-white px-5 py-4 shadow-[var(--shadow-soft)] ring-1 ring-black/4 transition hover:-translate-y-0.5 hover:shadow-[var(--shadow-medium)]"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 space-y-1">
                      <div className="truncate text-sm font-semibold text-[var(--ink)]">{session.title}</div>
                      <div className="text-xs text-[var(--ink-subtle)]">{translateSessionMode(session.mode)}</div>
                    </div>
                    <Badge variant={statusVariant(session.status)}>{translateStatus(session.status)}</Badge>
                  </div>
                  <div className="mt-4 flex items-center justify-between gap-3 text-xs text-[var(--ink-muted)]">
                    <span>{formatDateTime(session.updatedAt)}</span>
                    <span className="inline-flex items-center gap-1 font-medium text-[var(--ink)]">
                      {uiText("console.interactions.openSession")}
                      <ArrowRight className="h-3.5 w-3.5 transition group-hover:translate-x-0.5" />
                    </span>
                  </div>
                </Link>
              ))
            ) : (
              <div className="rounded-[22px] bg-[rgba(255,255,255,0.82)] px-5 py-7 text-sm leading-7 text-[var(--ink-muted)] shadow-[var(--shadow-soft)] ring-1 ring-black/4">
                {uiText("console.interactions.recent.empty")}
              </div>
            )}
          </PanelBody>
        </Panel>
      </section>

      <SummaryStrip
        items={[
          {
            label: "ui.generated.c4d72abd2e9",
            value: runtimeSessions.length,
            detail: <>{runningSessions.length} ui.common.detail.running</>,
          },
          {
            label: "ui.generated.c6f6a995823",
            value: teamSessions.length,
            detail: "console.interactions.summary.teamDetail",
          },
          {
            label: "ui.generated.c8e175e7aa9",
            value: runtimeBindings.length,
            detail: <>{providerProfiles.length} ui.common.detail.modelServicesSelectable</>,
          },
        ]}
      />

      <Panel>
        <PanelHeader
          eyebrow="console.interactions.table.eyebrow"
          title="console.interactions.table.title"
          description="console.interactions.table.description"
        />
        <div className="overflow-hidden rounded-b-lg">
          <DataTable>
            <DataTableHeader>
              <DataTableRow>
                <DataTableHead>ui.generated.c836ffe0e10</DataTableHead>
                <DataTableHead>ui.generated.ced0eea8f20</DataTableHead>
                <DataTableHead>ui.generated.c8e175e7aa9</DataTableHead>
                <DataTableHead>ui.generated.c98fd0cbd9c</DataTableHead>
                <DataTableHead>ui.generated.c62e951a692</DataTableHead>
                <DataTableHead>ui.generated.c093dea88c9</DataTableHead>
                <DataTableHead align="right">ui.generated.cf3ea6d345e</DataTableHead>
              </DataTableRow>
            </DataTableHeader>
            <DataTableBody>
              {runtimeSessions.map((session) => {
                const runtime = runtimeBindings.find((binding) => binding.id === session.runtimeBindingId);
                return (
                  <DataTableRow key={session.id}>
                    <DataTableCell className="min-w-[220px]">
                      <div className="font-medium text-[var(--ink)]">{session.title}</div>
                      <div className="mt-1 text-xs text-[var(--ink-muted)]">{session.id}</div>
                    </DataTableCell>
                    <DataTableCell>{translateSessionMode(session.mode)}</DataTableCell>
                    <DataTableCell>{runtime?.name ?? "ui.generated.c53215c3826"}</DataTableCell>
                    <DataTableCell>{session.model}</DataTableCell>
                    <DataTableCell>
                      <Badge variant={statusVariant(session.status)}>{translateStatus(session.status)}</Badge>
                    </DataTableCell>
                    <DataTableCell>{formatDateTime(session.updatedAt)}</DataTableCell>
                    <DataTableCell align="right">
                      <div className="flex justify-end gap-2">
                        <Link href={`/interactions/${session.id}`}>
                          <Button size="sm" variant="ghost">
                            <Eye className="h-4 w-4" />
                            {uiText("console.interactions.openSession")}
                          </Button>
                        </Link>
                        <DeleteResourceButton
                          endpoint={`/api/runtime-sessions/${session.id}`}
                          id={session.id}
                          confirmParams={{ resource: "ui.common.resources.session", name: session.title }}
                        />
                      </div>
                    </DataTableCell>
                  </DataTableRow>
                );
              })}
            </DataTableBody>
          </DataTable>
        </div>
      </Panel>

      <Panel>
        <PanelBody className="grid gap-4 px-5 py-5 md:grid-cols-3">
          {[
            {
              icon: Bot,
              title: uiText("console.interactions.capabilities.dialogueTitle"),
              description: uiText("console.interactions.capabilities.dialogueDescription"),
            },
            {
              icon: Users,
              title: uiText("console.interactions.capabilities.teamTitle"),
              description: uiText("console.interactions.capabilities.teamDescription"),
            },
            {
              icon: Workflow,
              title: uiText("console.interactions.capabilities.traceTitle"),
              description: uiText("console.interactions.capabilities.traceDescription"),
            },
          ].map((item) => (
            <div key={item.title} className="rounded-[22px] bg-white px-5 py-5 shadow-[var(--shadow-soft)] ring-1 ring-black/4">
              <div className="flex h-10 w-10 items-center justify-center rounded-[16px] bg-[rgba(15,23,42,0.05)] text-[var(--ink)]">
                <item.icon className="h-4.5 w-4.5" />
              </div>
              <div className="mt-4 text-sm font-semibold text-[var(--ink)]">{item.title}</div>
              <p className="mt-2 text-sm leading-7 text-[var(--ink-muted)]">{item.description}</p>
            </div>
          ))}
        </PanelBody>
      </Panel>
    </div>
  );
}
