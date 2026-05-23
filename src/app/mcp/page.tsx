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
import { canAccessBusinessTeam, filterBusinessTeamsForAuthContext, getRequestAuthContext } from "@/server/auth-core";
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

export default async function McpPage() {
  const authContext = await getRequestAuthContext();
  const businessTeams = filterBusinessTeamsForAuthContext(listBusinessTeams(), authContext);
  const servers = listMcpServers().filter((server) =>
    canAccessBusinessTeam(authContext, server.businessTeamId, { allowGlobal: true }),
  );
  const teamOptions = businessTeams.map((team) => ({ id: team.id, name: team.name }));

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="MCP"
        title="ui.generated.c0950f9419b"
        description="ui.generated.cec6d685a99"
        badges={[
          { label: <>{servers.length} ui.common.count.servers</>, variant: "accent" },
          { label: <>{servers.filter((server) => server.status === "active").length} ui.common.count.enabledItems</>, variant: "success" },
        ]}
      />

      <Panel>
        <PanelHeader
          eyebrow="ui.generated.cab63588ee3"
          title="ui.generated.c847752d637"
          description="ui.generated.c88fd702a14"
          action={
            <Dialog>
              <DialogTrigger asChild>
                <Button size="sm" variant="secondary"><Plus className="h-4 w-4" />ui.generated.cc9bbf9d28c</Button>
              </DialogTrigger>
              <DialogContent className="w-[min(94vw,860px)]">
                <DialogHeader>
                  <DialogTitle>ui.generated.c80d3b4a082</DialogTitle>
                  <DialogDescription>ui.generated.c194a744ff1</DialogDescription>
                </DialogHeader>
                <DialogBody>
                  <McpServerForm
                    businessTeams={teamOptions}
                    server={{
                      id: "",
                      businessTeamId: null,
                      name: "",
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
                <DataTableHead>ui.generated.c53d4919c45</DataTableHead>
                <DataTableHead>Transport</DataTableHead>
                <DataTableHead>ui.generated.ca72ef18d9a</DataTableHead>
                <DataTableHead>ui.generated.c28ff5ffe95</DataTableHead>
                <DataTableHead align="right">ui.generated.cf3ea6d345e</DataTableHead>
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
                      <div className="mt-1 break-all text-xs text-[var(--ink-muted)]">{server.command || server.url || "ui.generated.cc63d0e243e"}</div>
                    </DataTableCell>
                    <DataTableCell>{team?.name ?? "ui.generated.ca5644f4bbf"}</DataTableCell>
                    <DataTableCell>{server.transport}</DataTableCell>
                    <DataTableCell>{tools.length ? tools.slice(0, 3).join(", ") : "ui.generated.c7a433d5959"}</DataTableCell>
                    <DataTableCell>
                      <Badge variant={server.status === "active" ? "success" : "neutral"}>{server.lastHealthStatus}</Badge>
                    </DataTableCell>
                    <DataTableCell align="right">
                      <div className="flex justify-end gap-2">
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button size="sm" variant="ghost"><Eye className="h-4 w-4" />ui.generated.cf7acefd2d4</Button>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader><DialogTitle>{server.name}</DialogTitle><DialogDescription>ui.generated.c9ea3e1dae0</DialogDescription></DialogHeader>
                            <DialogBody>
                              <DefinitionList
                                items={[
                                  { label: "ID", value: server.id },
                                  { label: "ui.generated.c21d7042ff0", value: team?.name ?? "ui.generated.ca5644f4bbf" },
                                  { label: "Transport", value: server.transport },
                                  { label: "ui.generated.cb114b91547", value: server.command || "ui.generated.c72077749f7" },
                                  { label: "URL", value: server.url || "ui.generated.c72077749f7" },
                                  { label: "Auth Ref", value: server.authRef || "ui.generated.c72077749f7" },
                                  { label: "ui.generated.ca72ef18d9a", value: tools.join(", ") || "ui.generated.c7a433d5959" },
                                ]}
                              />
                            </DialogBody>
                          </DialogContent>
                        </Dialog>
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button size="sm" variant="ghost"><PencilLine className="h-4 w-4" />ui.generated.ca7f814c0a4</Button>
                          </DialogTrigger>
                          <DialogContent className="w-[min(94vw,860px)]">
                            <DialogHeader><DialogTitle>ui.generated.ca787995e10</DialogTitle><DialogDescription>{server.name}</DialogDescription></DialogHeader>
                            <DialogBody><McpServerForm businessTeams={teamOptions} server={server} /></DialogBody>
                          </DialogContent>
                        </Dialog>
                        <DeleteResourceButton endpoint="/api/mcp-servers" id={server.id} confirmParams={{ resource: "ui.common.resources.mcpServer", name: server.name }} />
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
