import { Eye, PencilLine, Plus } from "lucide-react";
import { ConnectorForm } from "@/components/admin-forms";
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
import { listConnectors } from "@/server/governance-core";
import { listBusinessTeams } from "@/server/queries";

function parseCapabilities(value: string) {
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

export default function ConnectorsPage() {
  const connectors = listConnectors();
  const businessTeams = listBusinessTeams();
  const teamOptions = businessTeams.map((team) => ({ id: team.id, name: team.name }));

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="连接器"
        title="Connector 管理"
        description="IM、邮件、Web Push 和企业通知通道统一作为 Connector 配置，任务输出和人工审批都通过这些通道发布。"
        badges={[
          { label: `${connectors.length} 个 Connector`, variant: "accent" },
          { label: `${connectors.filter((connector) => connector.status === "active").length} 个启用`, variant: "success" },
        ]}
      />

      <Panel>
        <PanelHeader
          eyebrow="目录"
          title="Connector 目录"
          description="连接器只保存配置和 Secret 引用，具体实现通过插件扩展。"
          action={
            <Dialog>
              <DialogTrigger asChild>
                <Button size="sm" variant="secondary"><Plus className="h-4 w-4" />新增 Connector</Button>
              </DialogTrigger>
              <DialogContent className="w-[min(94vw,860px)]">
                <DialogHeader><DialogTitle>新增 Connector</DialogTitle><DialogDescription>配置通知或输出通道。</DialogDescription></DialogHeader>
                <DialogBody>
                  <ConnectorForm
                    businessTeams={teamOptions}
                    connector={{
                      id: "",
                      businessTeamId: null,
                      name: "新增 Connector",
                      connectorType: "email",
                      provider: "smtp",
                      endpoint: "",
                      secretRef: "",
                      capabilitiesJson: "[]",
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
                <DataTableHead>Connector</DataTableHead>
                <DataTableHead>归属团队</DataTableHead>
                <DataTableHead>类型 / 服务方</DataTableHead>
                <DataTableHead>能力</DataTableHead>
                <DataTableHead>状态</DataTableHead>
                <DataTableHead align="right">操作</DataTableHead>
              </DataTableRow>
            </DataTableHeader>
            <DataTableBody>
              {connectors.map((connector) => {
                const team = businessTeams.find((item) => item.id === connector.businessTeamId);
                const capabilities = parseCapabilities(connector.capabilitiesJson);
                return (
                  <DataTableRow key={connector.id}>
                    <DataTableCell className="min-w-[260px]">
                      <div className="font-semibold text-[var(--ink)]">{connector.name}</div>
                      <div className="mt-1 break-all text-xs text-[var(--ink-muted)]">{connector.endpoint || "未配置 Endpoint"}</div>
                    </DataTableCell>
                    <DataTableCell>{team?.name ?? "全局"}</DataTableCell>
                    <DataTableCell>{connector.connectorType} / {connector.provider}</DataTableCell>
                    <DataTableCell>{capabilities.slice(0, 3).join(", ") || "未配置"}</DataTableCell>
                    <DataTableCell><Badge variant={connector.status === "active" ? "success" : "neutral"}>{connector.status}</Badge></DataTableCell>
                    <DataTableCell align="right">
                      <div className="flex justify-end gap-2">
                        <Dialog>
                          <DialogTrigger asChild><Button size="sm" variant="ghost"><Eye className="h-4 w-4" />查看</Button></DialogTrigger>
                          <DialogContent>
                            <DialogHeader><DialogTitle>{connector.name}</DialogTitle><DialogDescription>Connector 明细。</DialogDescription></DialogHeader>
                            <DialogBody>
                              <DefinitionList
                                items={[
                                  { label: "ID", value: connector.id },
                                  { label: "团队", value: team?.name ?? "全局" },
                                  { label: "类型", value: connector.connectorType },
                                  { label: "服务方", value: connector.provider },
                                  { label: "Endpoint", value: connector.endpoint || "无" },
                                  { label: "Secret Ref", value: connector.secretRef || "无" },
                                  { label: "能力", value: capabilities.join(", ") || "无" },
                                ]}
                              />
                            </DialogBody>
                          </DialogContent>
                        </Dialog>
                        <Dialog>
                          <DialogTrigger asChild><Button size="sm" variant="ghost"><PencilLine className="h-4 w-4" />编辑</Button></DialogTrigger>
                          <DialogContent className="w-[min(94vw,860px)]">
                            <DialogHeader><DialogTitle>编辑 Connector</DialogTitle><DialogDescription>{connector.name}</DialogDescription></DialogHeader>
                            <DialogBody><ConnectorForm businessTeams={teamOptions} connector={connector} /></DialogBody>
                          </DialogContent>
                        </Dialog>
                        <DeleteResourceButton endpoint="/api/connectors" id={connector.id} confirmText={`确认删除 Connector「${connector.name}」？`} />
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
