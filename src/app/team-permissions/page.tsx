import Link from "next/link";
import { PencilLine, Plus } from "lucide-react";
import { PermissionGrantForm } from "@/components/admin-forms";
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
import { listTeamMembers, listTeamPermissionGrants } from "@/server/governance-core";
import { listBusinessTeams } from "@/server/queries";

function actions(value: string) {
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? parsed.map(String).join(", ") : "";
  } catch {
    return "";
  }
}

export default async function TeamPermissionsPage({
  searchParams,
}: {
  searchParams?: Promise<{ teamId?: string }>;
}) {
  const params = await searchParams;
  const grants = listTeamPermissionGrants();
  const members = listTeamMembers();
  const businessTeams = listBusinessTeams();
  const selectedTeamId = params?.teamId ?? "";
  const selectedTeam = businessTeams.find((team) => team.id === selectedTeamId);
  const visibleGrants = selectedTeam ? grants.filter((grant) => grant.businessTeamId === selectedTeam.id) : grants;
  const teamOptions = businessTeams.map((team) => ({ id: team.id, name: team.name }));
  const memberOptions = members.map((member) => ({ id: member.id, name: `${member.name} / ${member.employeeNo}` }));

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="团队治理"
        title="团队成员权限"
        description="维护成员和角色对系统资源的操作权限。"
        badges={[
          { label: `${visibleGrants.length} 条权限`, variant: "accent" },
          { label: `${visibleGrants.filter((grant) => grant.effect === "deny").length} 条拒绝`, variant: "warning" },
          ...(selectedTeam ? [{ label: selectedTeam.name, variant: "success" as const }] : []),
        ]}
      />

      <SummaryStrip
        items={[
          { label: "当前视角", value: selectedTeam?.name ?? "全部团队", detail: selectedTeam ? "来自组织树跳转" : "未限定业务团队" },
          { label: "允许", value: visibleGrants.filter((grant) => grant.effect === "allow").length, detail: "直接放行规则" },
          { label: "需审批", value: visibleGrants.filter((grant) => grant.effect === "ask").length, detail: "运行时确认" },
          { label: "拒绝", value: visibleGrants.filter((grant) => grant.effect === "deny").length, detail: "优先阻断规则" },
        ]}
      />

      <Panel>
        <PanelHeader
          eyebrow="权限规则"
          title="权限规则"
          description={selectedTeam ? `当前仅展示 ${selectedTeam.name} 的权限规则。` : "查看主体、资源、范围和策略效果。"}
          action={
            <div className="flex flex-wrap gap-2">
              {selectedTeam ? (
                <Button asChild size="sm" variant="ghost"><Link href="/team-permissions">查看全部</Link></Button>
              ) : null}
              <Dialog>
                <DialogTrigger asChild><Button size="sm" variant="secondary"><Plus className="h-4 w-4" />新增权限</Button></DialogTrigger>
                <DialogContent className="w-[min(94vw,860px)]">
                  <DialogHeader><DialogTitle>新增权限规则</DialogTitle><DialogDescription>配置成员、资源范围和允许动作。</DialogDescription></DialogHeader>
                  <DialogBody>
                    <PermissionGrantForm
                      businessTeams={teamOptions}
                      members={memberOptions}
                      grant={{
                        id: "",
                        businessTeamId: selectedTeam?.id ?? businessTeams[0]?.id ?? "",
                        memberId: null,
                        principalType: "team_role",
                        roleKey: "operator",
                        resourceType: "task_blueprint",
                        resourceScope: "team:*",
                        actionsJson: "[]",
                        effect: "allow",
                        status: "active",
                      }}
                    />
                  </DialogBody>
                </DialogContent>
              </Dialog>
            </div>
          }
        />
        <PanelBody className="p-0">
          <DataTable>
            <DataTableHeader>
              <DataTableRow className="hover:bg-transparent">
                <DataTableHead>角色</DataTableHead>
                <DataTableHead>团队 / 成员</DataTableHead>
                <DataTableHead>资源</DataTableHead>
                <DataTableHead>动作</DataTableHead>
                <DataTableHead>效果</DataTableHead>
                <DataTableHead align="right">操作</DataTableHead>
              </DataTableRow>
            </DataTableHeader>
            <DataTableBody>
              {visibleGrants.map((grant) => {
                const team = businessTeams.find((item) => item.id === grant.businessTeamId);
                const member = members.find((item) => item.id === grant.memberId);
                return (
                  <DataTableRow key={grant.id}>
                    <DataTableCell>{grant.roleKey}</DataTableCell>
                    <DataTableCell>
                      <div className="font-medium text-[var(--ink)]">{team?.name ?? "未知团队"}</div>
                      <div className="mt-1 text-xs text-[var(--ink-muted)]">{member?.name ?? "团队角色"}</div>
                    </DataTableCell>
                    <DataTableCell>{grant.resourceType} · {grant.resourceScope}</DataTableCell>
                    <DataTableCell className="max-w-[320px]">{actions(grant.actionsJson)}</DataTableCell>
                    <DataTableCell><Badge variant={grant.effect === "allow" ? "success" : grant.effect === "deny" ? "warning" : "neutral"}>{grant.effect}</Badge></DataTableCell>
                    <DataTableCell align="right">
                      <div className="flex justify-end gap-2">
                        <Dialog>
                          <DialogTrigger asChild><Button size="sm" variant="ghost"><PencilLine className="h-4 w-4" />编辑</Button></DialogTrigger>
                          <DialogContent className="w-[min(94vw,860px)]">
                            <DialogHeader><DialogTitle>编辑权限</DialogTitle><DialogDescription>{grant.roleKey}</DialogDescription></DialogHeader>
                            <DialogBody><PermissionGrantForm businessTeams={teamOptions} members={memberOptions} grant={grant} /></DialogBody>
                          </DialogContent>
                        </Dialog>
                        <DeleteResourceButton endpoint="/api/team-permissions" id={grant.id} confirmText={`确认删除权限规则「${grant.roleKey}」？`} />
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
  );
}
