import { Eye, PencilLine, Plus } from "lucide-react";
import { McpServerForm } from "@/components/admin-forms";
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
import { listMcpServers } from "@/server/governance-core";
import { listBusinessTeams } from "@/server/queries";

function parseTools(value: string) {
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

export default function McpPage() {
  const servers = listMcpServers();
  const businessTeams = listBusinessTeams();
  const teamOptions = businessTeams.map((team) => ({ id: team.id, name: team.name }));

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="MCP"
        title="MCP 管理"
        description="按成熟 MCP 配置方式管理 server、transport、鉴权引用、工具白名单和健康状态，供运行约束在任务执行时挂载。"
        badges={[
          { label: `${servers.length} 个 Server`, variant: "accent" },
          { label: `${servers.filter((server) => server.status === "active").length} 个启用`, variant: "success" },
        ]}
      />

      <Panel>
        <PanelHeader
          eyebrow="服务目录"
          title="MCP Server 目录"
          description="stdio / HTTP / SSE 统一进入配置表，工具白名单明确可审计。"
          action={
            <Dialog>
              <DialogTrigger asChild>
                <Button size="sm" variant="secondary"><Plus className="h-4 w-4" />新增 MCP</Button>
              </DialogTrigger>
              <DialogContent className="w-[min(94vw,860px)]">
                <DialogHeader>
                  <DialogTitle>新增 MCP Server</DialogTitle>
                  <DialogDescription>配置 MCP 传输方式、命令或 URL，以及可暴露工具。</DialogDescription>
                </DialogHeader>
                <DialogBody>
                  <McpServerForm
                    businessTeams={teamOptions}
                    server={{
                      id: "",
                      businessTeamId: null,
                      name: "新增 MCP Server",
                      transport: "stdio",
                      command: "",
                      url: "",
                      authRef: "",
                      toolAllowlistJson: "[]",
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
                <DataTableHead>Server</DataTableHead>
                <DataTableHead>归属团队</DataTableHead>
                <DataTableHead>Transport</DataTableHead>
                <DataTableHead>工具</DataTableHead>
                <DataTableHead>健康</DataTableHead>
                <DataTableHead align="right">操作</DataTableHead>
              </DataTableRow>
            </DataTableHeader>
            <DataTableBody>
              {servers.map((server) => {
                const team = businessTeams.find((item) => item.id === server.businessTeamId);
                const tools = parseTools(server.toolAllowlistJson);
                return (
                  <DataTableRow key={server.id}>
                    <DataTableCell className="min-w-[260px]">
                      <div className="font-semibold text-[var(--ink)]">{server.name}</div>
                      <div className="mt-1 break-all text-xs text-[var(--ink-muted)]">{server.command || server.url || "未配置入口"}</div>
                    </DataTableCell>
                    <DataTableCell>{team?.name ?? "全局"}</DataTableCell>
                    <DataTableCell>{server.transport}</DataTableCell>
                    <DataTableCell>{tools.length ? tools.slice(0, 3).join(", ") : "未限制"}</DataTableCell>
                    <DataTableCell>
                      <Badge variant={server.status === "active" ? "success" : "neutral"}>{server.lastHealthStatus}</Badge>
                    </DataTableCell>
                    <DataTableCell align="right">
                      <div className="flex justify-end gap-2">
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button size="sm" variant="ghost"><Eye className="h-4 w-4" />查看</Button>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader><DialogTitle>{server.name}</DialogTitle><DialogDescription>MCP Server 明细。</DialogDescription></DialogHeader>
                            <DialogBody>
                              <DefinitionList
                                items={[
                                  { label: "ID", value: server.id },
                                  { label: "团队", value: team?.name ?? "全局" },
                                  { label: "Transport", value: server.transport },
                                  { label: "命令", value: server.command || "无" },
                                  { label: "URL", value: server.url || "无" },
                                  { label: "Auth Ref", value: server.authRef || "无" },
                                  { label: "工具", value: tools.join(", ") || "未限制" },
                                ]}
                              />
                            </DialogBody>
                          </DialogContent>
                        </Dialog>
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button size="sm" variant="ghost"><PencilLine className="h-4 w-4" />编辑</Button>
                          </DialogTrigger>
                          <DialogContent className="w-[min(94vw,860px)]">
                            <DialogHeader><DialogTitle>编辑 MCP Server</DialogTitle><DialogDescription>{server.name}</DialogDescription></DialogHeader>
                            <DialogBody><McpServerForm businessTeams={teamOptions} server={server} /></DialogBody>
                          </DialogContent>
                        </Dialog>
                        <DeleteResourceButton endpoint="/api/mcp-servers" id={server.id} confirmText={`确认删除 MCP Server「${server.name}」？`} />
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
