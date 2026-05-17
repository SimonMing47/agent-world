import { PencilLine, Plus, Upload } from "lucide-react";
import { TeamMemberForm, TeamMemberImportForm } from "@/components/admin-forms";
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
import { listTeamMembers } from "@/server/governance-core";
import { listBusinessTeams, listTenantSpaces } from "@/server/queries";

export default function TeamMembersPage() {
  const members = listTeamMembers();
  const businessTeams = listBusinessTeams();
  const tenantSpaceId = listTenantSpaces()[0]?.id ?? "";
  const teamOptions = businessTeams.map((team) => ({ id: team.id, name: team.name }));

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="团队治理"
        title="团队成员管理"
        description="录入成员姓名、工号、邮箱、归属团队和角色，支持从 Excel 复制表格后批量导入。"
        badges={[
          { label: `${members.length} 个成员`, variant: "accent" },
          { label: `${businessTeams.length} 个团队`, variant: "neutral" },
        ]}
      />

      <Panel>
        <PanelHeader
          eyebrow="成员"
          title="成员目录"
          description="团队是 AgentWorld 的业务治理中心，成员和权限都从这里进入。"
          action={
            <div className="flex gap-2">
              <Dialog>
                <DialogTrigger asChild><Button size="sm" variant="secondary"><Plus className="h-4 w-4" />新增成员</Button></DialogTrigger>
                <DialogContent className="w-[min(94vw,760px)]">
                  <DialogHeader><DialogTitle>新增团队成员</DialogTitle><DialogDescription>录入单个成员。</DialogDescription></DialogHeader>
                  <DialogBody>
                    <TeamMemberForm
                      tenantSpaceId={tenantSpaceId}
                      businessTeams={teamOptions}
                      member={{
                        id: "",
                        businessTeamId: businessTeams[0]?.id ?? "",
                        employeeNo: "",
                        name: "",
                        email: "",
                        role: "member",
                        title: "",
                        status: "active",
                      }}
                    />
                  </DialogBody>
                </DialogContent>
              </Dialog>
              <Dialog>
                <DialogTrigger asChild><Button size="sm" variant="ghost"><Upload className="h-4 w-4" />Excel 导入</Button></DialogTrigger>
                <DialogContent className="w-[min(94vw,760px)]">
                  <DialogHeader><DialogTitle>Excel 导入成员</DialogTitle><DialogDescription>从 Excel 复制五列：工号、姓名、邮箱、角色、岗位。</DialogDescription></DialogHeader>
                  <DialogBody><TeamMemberImportForm tenantSpaceId={tenantSpaceId} businessTeams={teamOptions} /></DialogBody>
                </DialogContent>
              </Dialog>
            </div>
          }
        />
        <PanelBody className="p-0">
          <DataTable>
            <DataTableHeader>
              <DataTableRow className="hover:bg-transparent">
                <DataTableHead>成员</DataTableHead>
                <DataTableHead>工号</DataTableHead>
                <DataTableHead>归属团队</DataTableHead>
                <DataTableHead>角色 / 岗位</DataTableHead>
                <DataTableHead>来源</DataTableHead>
                <DataTableHead>状态</DataTableHead>
                <DataTableHead align="right">操作</DataTableHead>
              </DataTableRow>
            </DataTableHeader>
            <DataTableBody>
              {members.map((member) => {
                const team = businessTeams.find((item) => item.id === member.businessTeamId);
                return (
                  <DataTableRow key={member.id}>
                    <DataTableCell>
                      <div className="font-semibold text-[var(--ink)]">{member.name}</div>
                      <div className="mt-1 text-xs text-[var(--ink-muted)]">{member.email || "未配置邮箱"}</div>
                    </DataTableCell>
                    <DataTableCell>{member.employeeNo || "未配置"}</DataTableCell>
                    <DataTableCell>{team?.name ?? "未知团队"}</DataTableCell>
                    <DataTableCell>{member.role} / {member.title || "未配置"}</DataTableCell>
                    <DataTableCell>{member.source}</DataTableCell>
                    <DataTableCell><Badge variant={member.status === "active" ? "success" : "neutral"}>{member.status}</Badge></DataTableCell>
                    <DataTableCell align="right">
                      <div className="flex justify-end gap-2">
                        <Dialog>
                          <DialogTrigger asChild><Button size="sm" variant="ghost"><PencilLine className="h-4 w-4" />编辑</Button></DialogTrigger>
                          <DialogContent className="w-[min(94vw,760px)]">
                            <DialogHeader><DialogTitle>编辑成员</DialogTitle><DialogDescription>{member.name}</DialogDescription></DialogHeader>
                            <DialogBody><TeamMemberForm tenantSpaceId={tenantSpaceId} businessTeams={teamOptions} member={member} /></DialogBody>
                          </DialogContent>
                        </Dialog>
                        <DeleteResourceButton endpoint="/api/team-members" id={member.id} confirmText={`确认删除成员「${member.name}」？`} />
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
