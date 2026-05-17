import { Eye, PencilLine, Plus } from "lucide-react";
import { AccessGrantForm } from "@/components/admin-forms";
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
import { translateStatus } from "@/lib/presentation";
import { listAccessGrants, listAgentTeams, listBusinessTeams } from "@/server/queries";

function parseRecord(value: string) {
  try {
    return JSON.parse(value) as Record<string, number | string | boolean>;
  } catch {
    return {};
  }
}

export default function AccessGrantsPage() {
  const accessGrants = listAccessGrants();
  const agentTeams = listAgentTeams();
  const businessTeams = listBusinessTeams();
  const agentTeamOptions = agentTeams.map((team) => ({ id: team.id, name: team.name }));
  const businessTeamOptions = businessTeams.map((team) => ({ id: team.id, name: team.name }));

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Access Grants"
        title="跨团队授权"
        description="跨业务团队使用 Agent Team 服务必须通过授权配置，支持新增、查看、编辑和删除。"
        badges={[{ label: `${accessGrants.length} 条授权`, variant: "accent" }]}
      />

      <Panel>
        <PanelHeader
          eyebrow="Registry"
          title="授权目录"
          description="配置服务方 Agent Team、消费方业务团队、价格、SLA 和服务账号引用。"
          action={
            <Dialog>
              <DialogTrigger asChild><Button size="sm" variant="secondary"><Plus className="h-4 w-4" />新增授权</Button></DialogTrigger>
              <DialogContent className="w-[min(94vw,820px)]">
                <DialogHeader><DialogTitle>新增跨团队授权</DialogTitle><DialogDescription>配置服务方、消费方和访问边界。</DialogDescription></DialogHeader>
                <DialogBody>
                  <AccessGrantForm
                    agentTeams={agentTeamOptions}
                    businessTeams={businessTeamOptions}
                    grant={{
                      id: "",
                      providerTeamId: agentTeams[0]?.id ?? "",
                      consumerBusinessTeamId: businessTeams[0]?.id ?? "",
                      pricingModelJson: JSON.stringify({ baseUsd: 0, tokenMultiplier: 1 }, null, 2),
                      slaJson: JSON.stringify({ responseSeconds: 60, successRateFloor: 0.95 }, null, 2),
                      accessScopeJson: "{}",
                      serviceAccountRef: "svc:",
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
                <DataTableHead>服务方</DataTableHead>
                <DataTableHead>消费方</DataTableHead>
                <DataTableHead>服务账号</DataTableHead>
                <DataTableHead>价格</DataTableHead>
                <DataTableHead>SLA</DataTableHead>
                <DataTableHead>状态</DataTableHead>
                <DataTableHead align="right">操作</DataTableHead>
              </DataTableRow>
            </DataTableHeader>
            <DataTableBody>
              {accessGrants.map((grant) => {
                const providerTeam = agentTeams.find((team) => team.id === grant.providerTeamId);
                const consumerTeam = businessTeams.find((team) => team.id === grant.consumerBusinessTeamId);
                const pricing = parseRecord(grant.pricingModelJson);
                const sla = parseRecord(grant.slaJson);
                return (
                  <DataTableRow key={grant.id}>
                    <DataTableCell>{providerTeam?.name ?? grant.providerTeamId}</DataTableCell>
                    <DataTableCell>{consumerTeam?.name ?? grant.consumerBusinessTeamId}</DataTableCell>
                    <DataTableCell>{grant.serviceAccountRef}</DataTableCell>
                    <DataTableCell>${pricing.baseUsd ?? 0} / x{pricing.tokenMultiplier ?? 1}</DataTableCell>
                    <DataTableCell>{sla.responseSeconds ?? 0}s / {Math.round(Number(sla.successRateFloor ?? 0) * 100)}%</DataTableCell>
                    <DataTableCell><Badge variant={grant.status === "active" ? "success" : "neutral"}>{translateStatus(grant.status)}</Badge></DataTableCell>
                    <DataTableCell align="right">
                      <div className="flex justify-end gap-2">
                        <Dialog>
                          <DialogTrigger asChild><Button size="sm" variant="ghost"><Eye className="h-4 w-4" />查看</Button></DialogTrigger>
                          <DialogContent>
                            <DialogHeader><DialogTitle>{providerTeam?.name ?? "授权"}</DialogTitle><DialogDescription>跨团队授权明细。</DialogDescription></DialogHeader>
                            <DialogBody><DefinitionList items={[{ label: "授权 ID", value: grant.id }, { label: "定价", value: grant.pricingModelJson }, { label: "SLA", value: grant.slaJson }, { label: "访问范围", value: grant.accessScopeJson }]} /></DialogBody>
                          </DialogContent>
                        </Dialog>
                        <Dialog>
                          <DialogTrigger asChild><Button size="sm" variant="ghost"><PencilLine className="h-4 w-4" />编辑</Button></DialogTrigger>
                          <DialogContent className="w-[min(94vw,820px)]">
                            <DialogHeader><DialogTitle>编辑跨团队授权</DialogTitle><DialogDescription>{grant.serviceAccountRef}</DialogDescription></DialogHeader>
                            <DialogBody><AccessGrantForm agentTeams={agentTeamOptions} businessTeams={businessTeamOptions} grant={grant} /></DialogBody>
                          </DialogContent>
                        </Dialog>
                        <DeleteResourceButton endpoint="/api/access-grants" id={grant.id} confirmText="确认删除该跨团队授权？" />
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
