import Link from "next/link";
import type { ReactNode } from "react";
import {
  Boxes,
  Bot,
  Eye,
  GitBranch,
  KeyRound,
  PencilLine,
  Plus,
  ScrollText,
  Users,
} from "lucide-react";
import { BusinessTeamForm } from "@/components/admin-forms";
import { DeleteResourceButton } from "@/components/delete-resource-button";
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
import { Panel, PanelBody, PanelHeader } from "@/components/ui/panel";
import { SummaryStrip } from "@/components/ui/summary-strip";
import {
  listCodebases,
  listConnectors,
  listTeamAssetGrants,
  listTeamMembers,
  listTeamPermissionGrants,
} from "@/server/governance-core";
import { listKnowledgeSpaces } from "@/server/knowledge-core";
import {
  listAgentTeams,
  listBusinessTeams,
  listTaskBlueprints,
  listTenantSpaces,
} from "@/server/queries";
import type { BusinessTeam } from "@/server/db";

type TeamSummary = {
  memberCount: number;
  activeMemberCount: number;
  permissionCount: number;
  denyPermissionCount: number;
  assetCount: number;
  agentTeamCount: number;
  taskBlueprintCount: number;
  codebaseCount: number;
  connectorCount: number;
  knowledgeSpaceCount: number;
};

function statusVariant(status: string): "success" | "neutral" | "warning" {
  if (status === "active") return "success";
  if (status === "disabled" || status === "archived") return "neutral";
  return "warning";
}

function safePercent(value: number, total: number) {
  if (!total) return 0;
  return Math.round(Math.min(100, Math.max(0, (value / total) * 100)));
}

function money(value: number) {
  return `$${Math.round(value).toLocaleString("en-US")}`;
}

function teamHref(path: string, teamId: string) {
  return `${path}?teamId=${encodeURIComponent(teamId)}`;
}

function TeamOperationLinks({ teamId }: { teamId: string }) {
  return (
    <div className="flex flex-wrap gap-2">
      <Button asChild size="sm" variant="ghost"><Link href={teamHref("/team-members", teamId)}>ui.generated.cc1ee9f0190</Link></Button>
      <Button asChild size="sm" variant="ghost"><Link href={teamHref("/team-permissions", teamId)}>ui.generated.c560165a6d7</Link></Button>
      <Button asChild size="sm" variant="ghost"><Link href={teamHref("/team-assets", teamId)}>ui.generated.c713fd96fb2</Link></Button>
      <Button asChild size="sm" variant="ghost"><Link href={teamHref("/task-blueprints", teamId)}>ui.generated.c3172b317f9</Link></Button>
    </div>
  );
}

function MetricPill({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: ReactNode;
}) {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3 py-2">
      <span className="text-[var(--ink-subtle)]">{icon}</span>
      <span className="text-xs text-[var(--ink-muted)]">{label}</span>
      <span className="ml-auto text-sm font-semibold text-[var(--ink)]">{value}</span>
    </div>
  );
}

function TeamTreeNode({
  team,
  teamsByParent,
  summaries,
  depth = 0,
  visited = new Set<string>(),
}: {
  team: BusinessTeam;
  teamsByParent: Map<string | null, BusinessTeam[]>;
  summaries: Map<string, TeamSummary>;
  depth?: number;
  visited?: Set<string>;
}) {
  const children = teamsByParent.get(team.id) ?? [];
  const summary = summaries.get(team.id);
  const nextVisited = new Set(visited);
  nextVisited.add(team.id);

  return (
    <div className="relative">
      <div
        className="rounded-lg border border-[var(--line)] bg-[var(--surface)] px-4 py-3"
        style={{ marginLeft: depth ? `${Math.min(depth * 22, 88)}px` : undefined }}
      >
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <div className="font-semibold text-[var(--ink)]">{team.name}</div>
              <Badge variant={statusVariant(team.status)}>{team.status}</Badge>
              {children.length ? <Badge variant="neutral">{children.length} ui.generated.c99dfa3e2ed</Badge> : null}
            </div>
            <div className="mt-1 text-xs text-[var(--ink-muted)]">{team.slug}</div>
            {team.description ? (
              <div className="mt-2 max-w-3xl text-sm leading-6 text-[var(--ink-muted)]">{team.description}</div>
            ) : null}
          </div>
          <TeamOperationLinks teamId={team.id} />
        </div>
        <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          <MetricPill icon={<Users className="h-4 w-4" />} label="ui.generated.cc1ee9f0190" value={summary?.memberCount ?? 0} />
          <MetricPill icon={<Bot className="h-4 w-4" />} label="ui.generated.cd4f6dd33b7" value={summary?.agentTeamCount ?? 0} />
          <MetricPill icon={<ScrollText className="h-4 w-4" />} label="ui.generated.c3172b317f9" value={summary?.taskBlueprintCount ?? 0} />
          <MetricPill icon={<Boxes className="h-4 w-4" />} label="ui.generated.c713fd96fb2" value={summary?.assetCount ?? 0} />
        </div>
      </div>
      {children.length ? (
        <div className="mt-3 space-y-3 border-l border-[var(--line)] pl-3">
          {children
            .filter((child) => !nextVisited.has(child.id))
            .map((child) => (
              <TeamTreeNode
                key={child.id}
                team={child}
                teamsByParent={teamsByParent}
                summaries={summaries}
                depth={depth + 1}
                visited={nextVisited}
              />
            ))}
        </div>
      ) : null}
    </div>
  );
}

function TeamDetailDialog({
  team,
  parent,
  tenantName,
  summary,
}: {
  team: BusinessTeam;
  parent?: BusinessTeam;
  tenantName: string;
  summary: TeamSummary;
}) {
  const budgetPercent = safePercent(team.balance, team.creditLimit);
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button size="sm" variant="ghost"><Eye className="h-4 w-4" />ui.generated.cf7acefd2d4</Button>
      </DialogTrigger>
      <DialogContent className="w-[min(94vw,980px)]">
        <DialogHeader>
          <DialogTitle>{team.name}</DialogTitle>
          <DialogDescription>ui.generated.c659cf80ea8</DialogDescription>
        </DialogHeader>
        <DialogBody className="space-y-5">
          <DefinitionList
            columnsClassName="sm:grid-cols-2 xl:grid-cols-3"
            items={[
              { label: "ui.generated.cc581b5b399", value: team.id },
              { label: "ui.generated.c3db35d2741", value: tenantName },
              { label: "ui.generated.c8febffdb94", value: parent?.name ?? "ui.generated.c7c6b663c4c" },
              { label: "Owner", value: team.ownerUserId },
              { label: "ui.generated.c095885b526", value: team.privateMemoryNamespace },
              { label: "ui.generated.ceadd946554", value: `${money(team.balance)} / ${money(team.creditLimit)} (${budgetPercent}%)` },
              { label: "ui.generated.c0ed5cf4445", value: team.description || "ui.generated.c287a1d1034" },
              { label: "ui.generated.c17324cd203", value: team.privateToolRefsJson },
              { label: "ui.generated.c628a862a9b", value: team.policyJson },
            ]}
          />
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
            <MetricPill icon={<Users className="h-4 w-4" />} label="ui.generated.cc1ee9f0190" value={`${summary.activeMemberCount}/${summary.memberCount}`} />
            <MetricPill icon={<KeyRound className="h-4 w-4" />} label="ui.generated.c95f4519aab" value={summary.permissionCount} />
            <MetricPill icon={<Boxes className="h-4 w-4" />} label="ui.generated.c778ab92119" value={summary.assetCount} />
            <MetricPill icon={<ScrollText className="h-4 w-4" />} label="ui.generated.c971c6e5190" value={summary.taskBlueprintCount} />
          </div>
          <TeamOperationLinks teamId={team.id} />
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}

export default function BusinessTeamsPage() {
  const businessTeams = listBusinessTeams();
  const tenantSpaces = listTenantSpaces();
  const taskBlueprints = listTaskBlueprints();
  const members = listTeamMembers();
  const permissionGrants = listTeamPermissionGrants();
  const assetGrants = listTeamAssetGrants();
  const agentTeams = listAgentTeams();
  const codebases = listCodebases();
  const connectors = listConnectors();
  const knowledgeSpaces = listKnowledgeSpaces();

  const tenantOptions = tenantSpaces.map((space) => ({ id: space.id, name: space.name }));
  const teamOptions = businessTeams.map((team) => ({ id: team.id, name: team.name }));
  const defaultTenantSpaceId = tenantSpaces[0]?.id ?? "";
  const teamsById = new Map(businessTeams.map((team) => [team.id, team]));
  const tenantNameById = new Map(tenantSpaces.map((space) => [space.id, space.name]));

  const summaries = new Map<string, TeamSummary>(
    businessTeams.map((team) => [
      team.id,
      {
        memberCount: members.filter((member) => member.businessTeamId === team.id).length,
        activeMemberCount: members.filter((member) => member.businessTeamId === team.id && member.status === "active").length,
        permissionCount: permissionGrants.filter((grant) => grant.businessTeamId === team.id).length,
        denyPermissionCount: permissionGrants.filter((grant) => grant.businessTeamId === team.id && grant.effect === "deny").length,
        assetCount: assetGrants.filter((grant) => grant.businessTeamId === team.id).length,
        agentTeamCount: agentTeams.filter((agentTeam) => agentTeam.businessTeamId === team.id).length,
        taskBlueprintCount: taskBlueprints.filter((blueprint) => blueprint.ownerBusinessTeamId === team.id).length,
        codebaseCount: codebases.filter((codebase) => codebase.businessTeamId === team.id).length,
        connectorCount: connectors.filter((connector) => connector.businessTeamId === team.id).length,
        knowledgeSpaceCount: knowledgeSpaces.filter((space) => space.businessTeamId === team.id).length,
      },
    ]),
  );

  const teamsByParent = new Map<string | null, BusinessTeam[]>();
  for (const team of businessTeams) {
    const parentId = team.parentBusinessTeamId && teamsById.has(team.parentBusinessTeamId)
      ? team.parentBusinessTeamId
      : null;
    const list = teamsByParent.get(parentId) ?? [];
    list.push(team);
    teamsByParent.set(parentId, list);
  }
  for (const list of teamsByParent.values()) {
    list.sort((a, b) => a.name.localeCompare(b.name, "zh-Hans-CN"));
  }

  const activeTeamCount = businessTeams.filter((team) => team.status === "active").length;
  const totalActiveMembers = members.filter((member) => member.status === "active").length;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="ui.generated.c41decbbd6e"
        title="ui.generated.c1b746595c2"
        description="ui.generated.c32315d277c"
        badges={[
          { label: <>{businessTeams.length} ui.common.count.teams</>, variant: "accent" },
          { label: <>{totalActiveMembers} ui.common.count.activeMembers</>, variant: "neutral" },
        ]}
      />

      <SummaryStrip
        items={[
          { label: "ui.generated.c2b90028ff3", value: businessTeams.length, detail: <>{activeTeamCount} ui.common.detail.enabled</> },
          { label: "ui.generated.c7de0251fdd", value: members.length, detail: <>{totalActiveMembers} ui.common.detail.enabled</> },
          { label: "ui.generated.ce40458cdde", value: assetGrants.length, detail: "ui.generated.c2b0869c742" },
          { label: "ui.generated.cc371224569", value: taskBlueprints.length, detail: "ui.generated.cc90de61dca" },
        ]}
      />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <Panel>
          <PanelHeader
            eyebrow="ui.generated.c21dfec6104"
            title="ui.generated.c4ba393db14"
            description="ui.generated.c438e4a540a"
            action={
              <Dialog>
                <DialogTrigger asChild>
                  <Button size="sm" variant="secondary"><Plus className="h-4 w-4" />ui.generated.c4996d49a42</Button>
                </DialogTrigger>
                <DialogContent className="w-[min(94vw,900px)]">
                  <DialogHeader>
                    <DialogTitle>ui.generated.c25deec1bd3</DialogTitle>
                    <DialogDescription>ui.generated.c7d1cf58091</DialogDescription>
                  </DialogHeader>
                  <DialogBody>
                    <BusinessTeamForm
                      tenantSpaces={tenantOptions}
                      businessTeams={teamOptions}
                      team={{
                        id: "",
                        tenantSpaceId: defaultTenantSpaceId,
                        parentBusinessTeamId: null,
                        slug: "new-team",
                        name: "",
                        description: "",
                        ownerUserId: "console",
                        status: "active",
                        balance: 0,
                        creditLimit: 1000,
                        privateToolRefsJson: "[]",
                        privateMemoryNamespace: "viking://teams/new-team/",
                        policyJson: "{}",
                      }}
                    />
                  </DialogBody>
                </DialogContent>
              </Dialog>
            }
          />
          <PanelBody>
            <div className="space-y-5">
              {tenantSpaces.map((tenant) => {
                const rootTeams = (teamsByParent.get(null) ?? []).filter((team) => team.tenantSpaceId === tenant.id);
                return (
                  <section key={tenant.id} className="space-y-3">
                    <div className="flex items-center gap-2 text-sm font-semibold text-[var(--ink)]">
                      <GitBranch className="h-4 w-4 text-[var(--ink-subtle)]" />
                      {tenant.name}
                    </div>
                    {rootTeams.length ? (
                      <div className="space-y-3">
                        {rootTeams.map((team) => (
                          <TeamTreeNode
                            key={team.id}
                            team={team}
                            teamsByParent={teamsByParent}
                            summaries={summaries}
                          />
                        ))}
                      </div>
                    ) : (
                      <div className="rounded-lg border border-dashed border-[var(--line)] px-4 py-8 text-sm text-[var(--ink-muted)]">
                        ui.generated.c4e6f52d038
                      </div>
                    )}
                  </section>
                );
              })}
            </div>
          </PanelBody>
        </Panel>

        <Panel>
          <PanelHeader
            eyebrow="ui.generated.c4ad934b950"
            title="ui.generated.c042d6729c4"
            description="ui.generated.c975b1afa5b"
          />
          <PanelBody className="p-0">
            <DataTable>
              <DataTableHeader>
                <DataTableRow className="hover:bg-transparent">
                  <DataTableHead>ui.generated.c21d7042ff0</DataTableHead>
                  <DataTableHead>ui.generated.c6d5f2521b4</DataTableHead>
                  <DataTableHead>ui.generated.cc1ee9f0190</DataTableHead>
                  <DataTableHead>ui.generated.c37f2163e2f</DataTableHead>
                  <DataTableHead>ui.generated.c0dcf0e012a</DataTableHead>
                  <DataTableHead align="right">ui.generated.cf3ea6d345e</DataTableHead>
                </DataTableRow>
              </DataTableHeader>
              <DataTableBody>
                {businessTeams.map((team) => {
                  const tenantName = tenantNameById.get(team.tenantSpaceId) ?? "ui.generated.c3bf179d8d0";
                  const parent = team.parentBusinessTeamId ? teamsById.get(team.parentBusinessTeamId) : undefined;
                  const summary = summaries.get(team.id) ?? {
                    memberCount: 0,
                    activeMemberCount: 0,
                    permissionCount: 0,
                    denyPermissionCount: 0,
                    assetCount: 0,
                    agentTeamCount: 0,
                    taskBlueprintCount: 0,
                    codebaseCount: 0,
                    connectorCount: 0,
                    knowledgeSpaceCount: 0,
                  };
                  const budgetPercent = safePercent(team.balance, team.creditLimit);
                  return (
                    <DataTableRow key={team.id}>
                      <DataTableCell>
                        <div className="font-semibold text-[var(--ink)]">{team.name}</div>
                        <div className="mt-1 text-xs text-[var(--ink-muted)]">{team.slug}</div>
                        <div className="mt-2"><Badge variant={statusVariant(team.status)}>{team.status}</Badge></div>
                      </DataTableCell>
                      <DataTableCell>
                        <div className="text-[var(--ink)]">{tenantName}</div>
                        <div className="mt-1 text-xs text-[var(--ink-muted)]">{parent ? <>ui.common.parentPrefix{parent.name}</> : "ui.generated.c3c5b0132ad"}</div>
                      </DataTableCell>
                      <DataTableCell>
                        <div className="font-medium text-[var(--ink)]">{summary.activeMemberCount} / {summary.memberCount}</div>
                        <div className="mt-1 text-xs text-[var(--ink-muted)]">{summary.permissionCount} ui.generated.c096bff697a {summary.denyPermissionCount} ui.generated.c9814ee699c</div>
                      </DataTableCell>
                      <DataTableCell>
                        <div className="font-medium text-[var(--ink)]">{summary.assetCount} ui.generated.c9a9997a2da {summary.taskBlueprintCount} ui.generated.cc5680a85b1</div>
                        <div className="mt-1 text-xs text-[var(--ink-muted)]">{summary.agentTeamCount} ui.generated.c65b0845cb8 {summary.knowledgeSpaceCount} ui.generated.c4b183f17ca</div>
                      </DataTableCell>
                      <DataTableCell>
                        <div className="font-medium text-[var(--ink)]">{money(team.balance)} / {money(team.creditLimit)}</div>
                        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[var(--surface-muted)]">
                          <div className="h-full rounded-full bg-[var(--accent)]" style={{ width: `${budgetPercent}%` }} />
                        </div>
                      </DataTableCell>
                      <DataTableCell align="right">
                        <div className="flex flex-wrap justify-end gap-2">
                          <TeamDetailDialog team={team} parent={parent} tenantName={tenantName} summary={summary} />
                          <Dialog>
                            <DialogTrigger asChild><Button size="sm" variant="ghost"><PencilLine className="h-4 w-4" />ui.generated.ca7f814c0a4</Button></DialogTrigger>
                            <DialogContent className="w-[min(94vw,900px)]">
                              <DialogHeader><DialogTitle>ui.generated.c6379b5b772</DialogTitle><DialogDescription>{team.name}</DialogDescription></DialogHeader>
                              <DialogBody><BusinessTeamForm tenantSpaces={tenantOptions} businessTeams={teamOptions} team={team} /></DialogBody>
                            </DialogContent>
                          </Dialog>
                          <DeleteResourceButton endpoint="/api/business-teams" id={team.id} confirmParams={{ resource: "ui.common.resources.businessTeam", name: team.name }} />
                        </div>
                      </DataTableCell>
                    </DataTableRow>
                  );
                })}
              </DataTableBody>
            </DataTable>
          </PanelBody>
        </Panel>
      </div>
    </div>
  );
}
