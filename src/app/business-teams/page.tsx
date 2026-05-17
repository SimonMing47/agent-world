import { Eye, PencilLine, Plus } from "lucide-react";
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
import { listBusinessTeams, listTaskBlueprints, listTenantSpaces } from "@/server/queries";

export default function BusinessTeamsPage() {
  const businessTeams = listBusinessTeams();
  const tenantSpaces = listTenantSpaces();
  const taskBlueprints = listTaskBlueprints();
  const tenantOptions = tenantSpaces.map((space) => ({ id: space.id, name: space.name }));
  const defaultTenantSpaceId = tenantSpaces[0]?.id ?? "";

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="团队治理"
        title="组织结构定义"
        description="业务团队是人、资产、权限和任务归属的核心对象，支持新增、查看、编辑和删除。"
        badges={[
          { label: `${businessTeams.length} 个业务团队`, variant: "accent" },
          { label: `${taskBlueprints.length} 个任务定义`, variant: "neutral" },
        ]}
      />

      <Panel>
        <PanelHeader
          eyebrow="组织结构"
          title="业务团队目录"
          description="团队和智能体团队是两个不同概念：团队与人和资产相关；智能体团队是任务调度单元。"
          action={
            <Dialog>
              <DialogTrigger asChild>
                <Button size="sm" variant="secondary"><Plus className="h-4 w-4" />新增团队</Button>
              </DialogTrigger>
              <DialogContent className="w-[min(94vw,900px)]">
                <DialogHeader>
                  <DialogTitle>新增业务团队</DialogTitle>
                  <DialogDescription>配置团队归属、预算、私有知识命名空间和团队策略。</DialogDescription>
                </DialogHeader>
                <DialogBody>
                  <BusinessTeamForm
                    tenantSpaces={tenantOptions}
                    team={{
                      id: "",
                      tenantSpaceId: defaultTenantSpaceId,
                      slug: "new-team",
                      name: "新增业务团队",
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
        <PanelBody className="p-0">
          <DataTable>
            <DataTableHeader>
              <DataTableRow className="hover:bg-transparent">
                <DataTableHead>团队</DataTableHead>
                <DataTableHead>租户空间</DataTableHead>
                <DataTableHead>私有知识命名空间</DataTableHead>
                <DataTableHead>任务定义</DataTableHead>
                <DataTableHead>预算</DataTableHead>
                <DataTableHead>状态</DataTableHead>
                <DataTableHead align="right">操作</DataTableHead>
              </DataTableRow>
            </DataTableHeader>
            <DataTableBody>
              {businessTeams.map((team) => {
                const tenant = tenantSpaces.find((space) => space.id === team.tenantSpaceId);
                const blueprints = taskBlueprints.filter((blueprint) => blueprint.ownerBusinessTeamId === team.id);
                return (
                  <DataTableRow key={team.id}>
                    <DataTableCell>
                      <div className="font-semibold text-[var(--ink)]">{team.name}</div>
                      <div className="mt-1 text-xs text-[var(--ink-muted)]">{team.slug}</div>
                    </DataTableCell>
                    <DataTableCell>{tenant?.name ?? "未绑定"}</DataTableCell>
                    <DataTableCell>{team.privateMemoryNamespace}</DataTableCell>
                    <DataTableCell>{blueprints.length}</DataTableCell>
                    <DataTableCell>${team.balance} / ${team.creditLimit}</DataTableCell>
                    <DataTableCell><Badge variant={team.status === "active" ? "success" : "neutral"}>{team.status}</Badge></DataTableCell>
                    <DataTableCell align="right">
                      <div className="flex justify-end gap-2">
                        <Dialog>
                          <DialogTrigger asChild><Button size="sm" variant="ghost"><Eye className="h-4 w-4" />查看</Button></DialogTrigger>
                          <DialogContent>
                            <DialogHeader><DialogTitle>{team.name}</DialogTitle><DialogDescription>业务团队配置明细。</DialogDescription></DialogHeader>
                            <DialogBody>
                              <DefinitionList
                                items={[
                                  { label: "团队 ID", value: team.id },
                                  { label: "租户空间", value: tenant?.name ?? "未绑定" },
                                  { label: "Owner", value: team.ownerUserId },
                                  { label: "私有知识命名空间", value: team.privateMemoryNamespace },
                                  { label: "私有工具引用", value: team.privateToolRefsJson },
                                  { label: "团队策略", value: team.policyJson },
                                ]}
                              />
                            </DialogBody>
                          </DialogContent>
                        </Dialog>
                        <Dialog>
                          <DialogTrigger asChild><Button size="sm" variant="ghost"><PencilLine className="h-4 w-4" />编辑</Button></DialogTrigger>
                          <DialogContent className="w-[min(94vw,900px)]">
                            <DialogHeader><DialogTitle>编辑业务团队</DialogTitle><DialogDescription>{team.name}</DialogDescription></DialogHeader>
                            <DialogBody><BusinessTeamForm tenantSpaces={tenantOptions} team={team} /></DialogBody>
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
  );
}
