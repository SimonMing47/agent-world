import { Eye, PencilLine, Plus } from "lucide-react";
import { ServiceCatalogForm } from "@/components/admin-forms";
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
import { translateRecruitmentMode } from "@/lib/presentation";
import { formatPercent } from "@/lib/utils";
import { listAgentTeams, listServiceCatalogListings } from "@/server/queries";

function parseTags(value: string) {
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

function parseResume(value: string) {
  try {
    return JSON.parse(value) as { successRate?: number; avgLatencyMs?: number; avgCostUsd?: number };
  } catch {
    return {};
  }
}

export default function ServiceCatalogPage() {
  const listings = listServiceCatalogListings();
  const agentTeams = listAgentTeams();
  const agentTeamOptions = agentTeams.map((team) => ({ id: team.id, name: team.name }));

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="服务目录"
        title="服务目录"
        description="配置跨团队可招募的 Agent 团队服务能力，支持新增、查看、编辑和删除。"
        badges={[{ label: `${listings.length} 条目录记录`, variant: "accent" }]}
      />

      <Panel>
        <PanelHeader
          eyebrow="目录"
          title="服务目录"
          description="目录条目决定哪些 Agent 团队能被其他团队发现、申请和授权使用。"
          action={
            <Dialog>
              <DialogTrigger asChild><Button size="sm" variant="secondary"><Plus className="h-4 w-4" />新增目录</Button></DialogTrigger>
              <DialogContent className="w-[min(94vw,820px)]">
                <DialogHeader><DialogTitle>新增服务目录条目</DialogTitle><DialogDescription>选择 Agent 团队并配置招募模式和服务履历。</DialogDescription></DialogHeader>
                <DialogBody>
                  <ServiceCatalogForm
                    agentTeams={agentTeamOptions}
                    listing={{
                      id: "",
                      teamId: agentTeams[0]?.id ?? "",
                      resumeJson: JSON.stringify({ successRate: 0.95, avgLatencyMs: 60000, avgCostUsd: 1 }, null, 2),
                      recruitmentMode: "request",
                      tagsJson: "[]",
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
                <DataTableHead>Agent 团队</DataTableHead>
                <DataTableHead>招募模式</DataTableHead>
                <DataTableHead>成功率</DataTableHead>
                <DataTableHead>平均耗时</DataTableHead>
                <DataTableHead>标签</DataTableHead>
                <DataTableHead>状态</DataTableHead>
                <DataTableHead align="right">操作</DataTableHead>
              </DataTableRow>
            </DataTableHeader>
            <DataTableBody>
              {listings.map((listing) => {
                const team = agentTeams.find((item) => item.id === listing.teamId);
                const resume = parseResume(listing.resumeJson);
                const tags = parseTags(listing.tagsJson);
                return (
                  <DataTableRow key={listing.id}>
                    <DataTableCell>
                      <div className="font-semibold text-[var(--ink)]">{team?.name ?? listing.teamId}</div>
                      <div className="mt-1 text-xs text-[var(--ink-muted)]">{listing.id}</div>
                    </DataTableCell>
                    <DataTableCell>{translateRecruitmentMode(listing.recruitmentMode)}</DataTableCell>
                    <DataTableCell>{formatPercent(resume.successRate ?? 0)}</DataTableCell>
                    <DataTableCell>{Math.round((resume.avgLatencyMs ?? 0) / 1000)}s</DataTableCell>
                    <DataTableCell>{tags.join(", ") || "未标注"}</DataTableCell>
                    <DataTableCell><Badge variant={listing.status === "active" ? "success" : "neutral"}>{listing.status}</Badge></DataTableCell>
                    <DataTableCell align="right">
                      <div className="flex justify-end gap-2">
                        <Dialog>
                          <DialogTrigger asChild><Button size="sm" variant="ghost"><Eye className="h-4 w-4" />查看</Button></DialogTrigger>
                          <DialogContent>
                            <DialogHeader><DialogTitle>{team?.name ?? listing.teamId}</DialogTitle><DialogDescription>服务目录明细。</DialogDescription></DialogHeader>
                            <DialogBody><DefinitionList items={[{ label: "目录 ID", value: listing.id }, { label: "履历 JSON", value: listing.resumeJson }, { label: "标签", value: tags.join(", ") || "无" }]} /></DialogBody>
                          </DialogContent>
                        </Dialog>
                        <Dialog>
                          <DialogTrigger asChild><Button size="sm" variant="ghost"><PencilLine className="h-4 w-4" />编辑</Button></DialogTrigger>
                          <DialogContent className="w-[min(94vw,820px)]">
                            <DialogHeader><DialogTitle>编辑服务目录</DialogTitle><DialogDescription>{team?.name ?? listing.teamId}</DialogDescription></DialogHeader>
                            <DialogBody><ServiceCatalogForm agentTeams={agentTeamOptions} listing={listing} /></DialogBody>
                          </DialogContent>
                        </Dialog>
                        <DeleteResourceButton endpoint="/api/service-catalog" id={listing.id} confirmText="确认删除该服务目录条目？" />
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
