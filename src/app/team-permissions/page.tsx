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

export default function TeamPermissionsPage() {
  const grants = listTeamPermissionGrants();
  const members = listTeamMembers();
  const businessTeams = listBusinessTeams();
  const teamOptions = businessTeams.map((team) => ({ id: team.id, name: team.name }));
  const memberOptions = members.map((member) => ({ id: member.id, name: `${member.name} / ${member.employeeNo}` }));

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="团队治理"
        title="团队成员权限"
        description="配置团队成员或团队角色对 AgentWorld 资源的操作权限，支持 allow、ask、deny 三类效果。"
        badges={[
          { label: `${grants.length} 条权限`, variant: "accent" },
          { label: `${grants.filter((grant) => grant.effect === "deny").length} 条拒绝`, variant: "warning" },
        ]}
      />

      <Panel>
        <PanelHeader
          eyebrow="权限规则"
          title="权限规则"
          description="权限显式落库，供 Agent、任务和资产治理共同引用。"
          action={
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
                      businessTeamId: businessTeams[0]?.id ?? "",
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
              {grants.map((grant) => {
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
