import { PencilLine, Plus } from "lucide-react";
import { AssetGrantForm } from "@/components/admin-forms";
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
import { listTeamAssetGrants, listTeamMembers } from "@/server/governance-core";
import { listBusinessTeams } from "@/server/queries";

function permission(value: string) {
  try {
    return JSON.stringify(JSON.parse(value));
  } catch {
    return value;
  }
}

export default function TeamAssetsPage() {
  const grants = listTeamAssetGrants();
  const members = listTeamMembers();
  const businessTeams = listBusinessTeams();
  const teamOptions = businessTeams.map((team) => ({ id: team.id, name: team.name }));
  const memberOptions = members.map((member) => ({ id: member.id, name: `${member.name} / ${member.employeeNo}` }));

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="团队治理"
        title="团队资产治理"
        description="给团队和成员配置 Skill、知识库、Codebase、Connector、Agent 团队等资产的使用和治理权限。"
        badges={[
          { label: `${grants.length} 条资产授权`, variant: "accent" },
          { label: `${new Set(grants.map((grant) => grant.assetType)).size} 类资产`, variant: "neutral" },
        ]}
      />

      <Panel>
        <PanelHeader
          eyebrow="资产授权"
          title="团队资产授权"
          description="资产授权明确谁能看、谁能用、谁能编辑和谁能授权。"
          action={
            <Dialog>
              <DialogTrigger asChild><Button size="sm" variant="secondary"><Plus className="h-4 w-4" />新增资产授权</Button></DialogTrigger>
              <DialogContent className="w-[min(94vw,860px)]">
                <DialogHeader><DialogTitle>新增资产授权</DialogTitle><DialogDescription>选择资产类型和权限 JSON。</DialogDescription></DialogHeader>
                <DialogBody>
                  <AssetGrantForm
                    businessTeams={teamOptions}
                    members={memberOptions}
                    grant={{
                      id: "",
                      businessTeamId: businessTeams[0]?.id ?? "",
                      memberId: null,
                      assetType: "skill",
                      assetId: "",
                      assetName: "",
                      permissionJson: "{}",
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
                <DataTableHead>资产</DataTableHead>
                <DataTableHead>团队 / 成员</DataTableHead>
                <DataTableHead>类型</DataTableHead>
                <DataTableHead>权限</DataTableHead>
                <DataTableHead>状态</DataTableHead>
                <DataTableHead align="right">操作</DataTableHead>
              </DataTableRow>
            </DataTableHeader>
            <DataTableBody>
              {grants.map((grant) => {
                const team = businessTeams.find((item) => item.id === grant.businessTeamId);
                const member = members.find((item) => item.id === grant.memberId);
                return (
                  <DataTableRow key={grant.id}>
                    <DataTableCell>
                      <div className="font-semibold text-[var(--ink)]">{grant.assetName}</div>
                      <div className="mt-1 text-xs text-[var(--ink-muted)]">{grant.assetId}</div>
                    </DataTableCell>
                    <DataTableCell>
                      <div>{team?.name ?? "未知团队"}</div>
                      <div className="mt-1 text-xs text-[var(--ink-muted)]">{member?.name ?? "团队级"}</div>
                    </DataTableCell>
                    <DataTableCell>{grant.assetType}</DataTableCell>
                    <DataTableCell className="max-w-[360px] truncate font-mono text-xs">{permission(grant.permissionJson)}</DataTableCell>
                    <DataTableCell><Badge variant={grant.status === "active" ? "success" : "neutral"}>{grant.status}</Badge></DataTableCell>
                    <DataTableCell align="right">
                      <div className="flex justify-end gap-2">
                        <Dialog>
                          <DialogTrigger asChild><Button size="sm" variant="ghost"><PencilLine className="h-4 w-4" />编辑</Button></DialogTrigger>
                          <DialogContent className="w-[min(94vw,860px)]">
                            <DialogHeader><DialogTitle>编辑资产授权</DialogTitle><DialogDescription>{grant.assetName}</DialogDescription></DialogHeader>
                            <DialogBody><AssetGrantForm businessTeams={teamOptions} members={memberOptions} grant={grant} /></DialogBody>
                          </DialogContent>
                        </Dialog>
                        <DeleteResourceButton endpoint="/api/team-assets" id={grant.id} confirmText={`确认删除资产授权「${grant.assetName}」？`} />
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
