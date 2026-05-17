import Link from "next/link";
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
import { SummaryStrip } from "@/components/ui/summary-strip";
import { listTeamAssetGrants, listTeamMembers } from "@/server/governance-core";
import { listBusinessTeams } from "@/server/queries";

function permission(value: string) {
  try {
    return JSON.stringify(JSON.parse(value));
  } catch {
    return value;
  }
}

export default async function TeamAssetsPage({
  searchParams,
}: {
  searchParams?: Promise<{ teamId?: string }>;
}) {
  const params = await searchParams;
  const grants = listTeamAssetGrants();
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
        title="团队资产治理"
        description="维护团队可使用的 Skill、知识库、Codebase 和 Connector。"
        badges={[
          { label: `${visibleGrants.length} 条资产授权`, variant: "accent" },
          { label: `${new Set(visibleGrants.map((grant) => grant.assetType)).size} 类资产`, variant: "neutral" },
          ...(selectedTeam ? [{ label: selectedTeam.name, variant: "success" as const }] : []),
        ]}
      />

      <SummaryStrip
        items={[
          { label: "当前视角", value: selectedTeam?.name ?? "全部团队", detail: selectedTeam ? "来自组织树跳转" : "未限定业务团队" },
          { label: "团队级资产", value: visibleGrants.filter((grant) => !grant.memberId).length, detail: "团队共享使用" },
          { label: "成员级资产", value: visibleGrants.filter((grant) => Boolean(grant.memberId)).length, detail: "授权到具体成员" },
          { label: "资产类型", value: new Set(visibleGrants.map((grant) => grant.assetType)).size, detail: "Skill / 知识库 / Codebase / Connector" },
        ]}
      />

      <Panel>
        <PanelHeader
          eyebrow="资产授权"
          title="团队资产授权"
          description={selectedTeam ? `当前仅展示 ${selectedTeam.name} 的资产授权。` : "查看资产、授权对象、范围和有效期。"}
          action={
            <div className="flex flex-wrap gap-2">
              {selectedTeam ? (
                <Button asChild size="sm" variant="ghost"><Link href="/team-assets">查看全部</Link></Button>
              ) : null}
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
                        businessTeamId: selectedTeam?.id ?? businessTeams[0]?.id ?? "",
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
            </div>
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
              {visibleGrants.map((grant) => {
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
