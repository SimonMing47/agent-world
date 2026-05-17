import Link from "next/link";
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
import { SummaryStrip } from "@/components/ui/summary-strip";
import { listTeamMembers } from "@/server/governance-core";
import { listBusinessTeams, listTenantSpaces } from "@/server/queries";

export default async function TeamMembersPage({
  searchParams,
}: {
  searchParams?: Promise<{ teamId?: string }>;
}) {
  const params = await searchParams;
  const members = listTeamMembers();
  const businessTeams = listBusinessTeams();
  const selectedTeamId = params?.teamId ?? "";
  const selectedTeam = businessTeams.find((team) => team.id === selectedTeamId);
  const visibleMembers = selectedTeam ? members.filter((member) => member.businessTeamId === selectedTeam.id) : members;
  const tenantSpaceId = listTenantSpaces()[0]?.id ?? "";
  const teamOptions = businessTeams.map((team) => ({ id: team.id, name: team.name }));

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="团队治理"
        title="团队成员管理"
        description="维护成员、工号、邮箱、团队和角色，支持表格导入。"
        badges={[
          { label: `${visibleMembers.length} 个成员`, variant: "accent" },
          { label: `${businessTeams.length} 个团队`, variant: "neutral" },
          ...(selectedTeam ? [{ label: selectedTeam.name, variant: "success" as const }] : []),
        ]}
      />

      <SummaryStrip
        items={[
          { label: "当前视角", value: selectedTeam?.name ?? "全部团队", detail: selectedTeam ? "来自组织树跳转" : "未限定业务团队" },
          { label: "活跃成员", value: visibleMembers.filter((member) => member.status === "active").length, detail: "可参与团队任务" },
          { label: "手工录入", value: visibleMembers.filter((member) => member.source === "manual").length, detail: "控制台维护" },
          { label: "导入成员", value: visibleMembers.filter((member) => member.source === "excel_import").length, detail: "Excel 批量录入" },
        ]}
      />

      <Panel>
        <PanelHeader
          eyebrow="成员"
          title="成员目录"
          description={selectedTeam ? `当前仅展示 ${selectedTeam.name} 的成员。` : "查看成员归属、角色和状态。"}
          action={
            <div className="flex flex-wrap gap-2">
              {selectedTeam ? (
                <Button asChild size="sm" variant="ghost"><Link href="/team-members">查看全部</Link></Button>
              ) : null}
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
              {visibleMembers.map((member) => {
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
