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
      <Button asChild size="sm" variant="ghost"><Link href={teamHref("/team-members", teamId)}>成员</Link></Button>
      <Button asChild size="sm" variant="ghost"><Link href={teamHref("/team-permissions", teamId)}>权限</Link></Button>
      <Button asChild size="sm" variant="ghost"><Link href={teamHref("/team-assets", teamId)}>资产</Link></Button>
      <Button asChild size="sm" variant="ghost"><Link href={teamHref("/task-blueprints", teamId)}>任务</Link></Button>
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
              {children.length ? <Badge variant="neutral">{children.length} 个下级</Badge> : null}
            </div>
            <div className="mt-1 text-xs text-[var(--ink-muted)]">{team.slug}</div>
            {team.description ? (
              <div className="mt-2 max-w-3xl text-sm leading-6 text-[var(--ink-muted)]">{team.description}</div>
            ) : null}
          </div>
          <TeamOperationLinks teamId={team.id} />
        </div>
        <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          <MetricPill icon={<Users className="h-4 w-4" />} label="成员" value={summary?.memberCount ?? 0} />
          <MetricPill icon={<Bot className="h-4 w-4" />} label="执行团队" value={summary?.agentTeamCount ?? 0} />
          <MetricPill icon={<ScrollText className="h-4 w-4" />} label="任务" value={summary?.taskBlueprintCount ?? 0} />
          <MetricPill icon={<Boxes className="h-4 w-4" />} label="资产" value={summary?.assetCount ?? 0} />
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
        <Button size="sm" variant="ghost"><Eye className="h-4 w-4" />查看</Button>
      </DialogTrigger>
      <DialogContent className="w-[min(94vw,980px)]">
        <DialogHeader>
          <DialogTitle>{team.name}</DialogTitle>
          <DialogDescription>团队画像、组织关系、资产和任务情况。</DialogDescription>
        </DialogHeader>
        <DialogBody className="space-y-5">
          <DefinitionList
            columnsClassName="sm:grid-cols-2 xl:grid-cols-3"
            items={[
              { label: "团队 ID", value: team.id },
              { label: "租户空间", value: tenantName },
              { label: "上级团队", value: parent?.name ?? "无上级团队" },
              { label: "Owner", value: team.ownerUserId },
              { label: "私有知识命名空间", value: team.privateMemoryNamespace },
              { label: "预算使用", value: `${money(team.balance)} / ${money(team.creditLimit)} (${budgetPercent}%)` },
              { label: "团队说明", value: team.description || "未填写" },
              { label: "私有工具引用", value: team.privateToolRefsJson },
              { label: "团队策略", value: team.policyJson },
            ]}
          />
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
            <MetricPill icon={<Users className="h-4 w-4" />} label="成员" value={`${summary.activeMemberCount}/${summary.memberCount}`} />
            <MetricPill icon={<KeyRound className="h-4 w-4" />} label="权限规则" value={summary.permissionCount} />
            <MetricPill icon={<Boxes className="h-4 w-4" />} label="资产授权" value={summary.assetCount} />
            <MetricPill icon={<ScrollText className="h-4 w-4" />} label="任务定义" value={summary.taskBlueprintCount} />
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
        eyebrow="团队治理"
        title="组织结构定义"
        description="维护业务团队结构，并从团队视角查看成员、权限、资产和任务情况。"
        badges={[
          { label: `${businessTeams.length} 个业务团队`, variant: "accent" },
          { label: `${totalActiveMembers} 个活跃成员`, variant: "neutral" },
        ]}
      />

      <SummaryStrip
        items={[
          { label: "业务团队", value: businessTeams.length, detail: `${activeTeamCount} 个启用中` },
          { label: "团队成员", value: members.length, detail: `${totalActiveMembers} 个启用中` },
          { label: "团队资产", value: assetGrants.length, detail: "Skill / 知识库 / Codebase / Connector" },
          { label: "团队任务", value: taskBlueprints.length, detail: "按业务团队归属治理" },
        ]}
      />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <Panel>
          <PanelHeader
            eyebrow="组织结构"
            title="团队树"
            description="按租户和上级团队展示组织结构。"
            action={
              <Dialog>
                <DialogTrigger asChild>
                  <Button size="sm" variant="secondary"><Plus className="h-4 w-4" />新增团队</Button>
                </DialogTrigger>
                <DialogContent className="w-[min(94vw,900px)]">
                  <DialogHeader>
                    <DialogTitle>新增业务团队</DialogTitle>
                    <DialogDescription>配置团队归属、上级团队、预算、知识命名空间和团队策略。</DialogDescription>
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
                        name: "新增业务团队",
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
                        暂无业务团队。
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
            eyebrow="团队情况"
            title="团队治理概览"
            description="配置完成后，可以在这里直接看到每个团队的成员、权限、资产和任务情况。"
          />
          <PanelBody className="p-0">
            <DataTable>
              <DataTableHeader>
                <DataTableRow className="hover:bg-transparent">
                  <DataTableHead>团队</DataTableHead>
                  <DataTableHead>组织关系</DataTableHead>
                  <DataTableHead>成员</DataTableHead>
                  <DataTableHead>资产 / 任务</DataTableHead>
                  <DataTableHead>预算</DataTableHead>
                  <DataTableHead align="right">操作</DataTableHead>
                </DataTableRow>
              </DataTableHeader>
              <DataTableBody>
                {businessTeams.map((team) => {
                  const tenantName = tenantNameById.get(team.tenantSpaceId) ?? "未绑定";
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
                        <div className="mt-1 text-xs text-[var(--ink-muted)]">{parent ? `上级：${parent.name}` : "根团队"}</div>
                      </DataTableCell>
                      <DataTableCell>
                        <div className="font-medium text-[var(--ink)]">{summary.activeMemberCount} / {summary.memberCount}</div>
                        <div className="mt-1 text-xs text-[var(--ink-muted)]">{summary.permissionCount} 条权限 · {summary.denyPermissionCount} 条拒绝</div>
                      </DataTableCell>
                      <DataTableCell>
                        <div className="font-medium text-[var(--ink)]">{summary.assetCount} 项资产 · {summary.taskBlueprintCount} 个任务</div>
                        <div className="mt-1 text-xs text-[var(--ink-muted)]">{summary.agentTeamCount} 个 Agent 团队 · {summary.knowledgeSpaceCount} 个知识空间</div>
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
                            <DialogTrigger asChild><Button size="sm" variant="ghost"><PencilLine className="h-4 w-4" />编辑</Button></DialogTrigger>
                            <DialogContent className="w-[min(94vw,900px)]">
                              <DialogHeader><DialogTitle>编辑业务团队</DialogTitle><DialogDescription>{team.name}</DialogDescription></DialogHeader>
                              <DialogBody><BusinessTeamForm tenantSpaces={tenantOptions} businessTeams={teamOptions} team={team} /></DialogBody>
                            </DialogContent>
                          </Dialog>
                          <DeleteResourceButton endpoint="/api/business-teams" id={team.id} confirmText={`确认删除业务团队「${team.name}」？`} />
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
