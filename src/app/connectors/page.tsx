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
import { canAccessBusinessTeam, filterBusinessTeamsForAuthContext, getRequestAuthContext } from "@/server/auth-core";
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

export default async function ConnectorsPage() {
  const authContext = await getRequestAuthContext();
  const businessTeams = filterBusinessTeamsForAuthContext(listBusinessTeams(), authContext);
  const connectors = listConnectors().filter((connector) =>
    canAccessBusinessTeam(authContext, connector.businessTeamId, { allowGlobal: true }),
  );
  const teamOptions = businessTeams.map((team) => ({ id: team.id, name: team.name }));

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="ui.common.resources.connector"
        title="nav.connectors.label"
        description="nav.connectors.description"
        badges={[
          { label: <>{connectors.length} ui.common.count.connectors</>, variant: "accent" },
          { label: <>{connectors.filter((connector) => connector.status === "active").length} ui.common.count.enabledItems</>, variant: "success" },
        ]}
      />

      <Panel>
        <PanelHeader
          eyebrow="ui.common.resources.connector"
          title="ui.common.resources.connector"
          description="nav.connectors.description"
          action={
            <Dialog>
              <DialogTrigger asChild>
                <Button size="sm" variant="secondary"><Plus className="h-4 w-4" />ui.generated.ce6767a1907</Button>
              </DialogTrigger>
              <DialogContent className="w-[min(94vw,860px)]">
                <DialogHeader><DialogTitle>ui.generated.ce6767a1907</DialogTitle><DialogDescription>ui.generated.c72fe56be98</DialogDescription></DialogHeader>
                <DialogBody>
                  <ConnectorForm
                    businessTeams={teamOptions}
                    connector={{
                      id: "",
                      businessTeamId: null,
                      name: "",
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
                <DataTableHead>ui.generated.c53d4919c45</DataTableHead>
                <DataTableHead>ui.generated.c8f1217bb00</DataTableHead>
                <DataTableHead>ui.generated.ceb9d53ce7f</DataTableHead>
                <DataTableHead>ui.generated.c62e951a692</DataTableHead>
                <DataTableHead align="right">ui.generated.cf3ea6d345e</DataTableHead>
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
                      <div className="mt-1 break-all text-xs text-[var(--ink-muted)]">{connector.endpoint || "ui.generated.c1b1046c19e"}</div>
                    </DataTableCell>
                    <DataTableCell>{team?.name ?? "ui.generated.ca5644f4bbf"}</DataTableCell>
                    <DataTableCell>{connector.connectorType} / {connector.provider}</DataTableCell>
                    <DataTableCell>{capabilities.slice(0, 3).join(", ") || "ui.generated.c63595e95b7"}</DataTableCell>
                    <DataTableCell><Badge variant={connector.status === "active" ? "success" : "neutral"}>{connector.status}</Badge></DataTableCell>
                    <DataTableCell align="right">
                      <div className="flex justify-end gap-2">
                        <Dialog>
                          <DialogTrigger asChild><Button size="sm" variant="ghost"><Eye className="h-4 w-4" />ui.generated.cf7acefd2d4</Button></DialogTrigger>
                          <DialogContent>
                            <DialogHeader><DialogTitle>{connector.name}</DialogTitle><DialogDescription>ui.generated.ca5ac75c844</DialogDescription></DialogHeader>
                            <DialogBody>
                              <DefinitionList
                                items={[
                                  { label: "ID", value: connector.id },
                                  { label: "ui.generated.c21d7042ff0", value: team?.name ?? "ui.generated.ca5644f4bbf" },
                                  { label: "ui.generated.ce4e46c7235", value: connector.connectorType },
                                  { label: "ui.generated.c6a7069fb0c", value: connector.provider },
                                  { label: "Endpoint", value: connector.endpoint || "ui.generated.c72077749f7" },
                                  { label: "Secret Ref", value: connector.secretRef || "ui.generated.c72077749f7" },
                                  { label: "ui.generated.ceb9d53ce7f", value: capabilities.join(", ") || "ui.generated.c72077749f7" },
                                ]}
                              />
                            </DialogBody>
                          </DialogContent>
                        </Dialog>
                        <Dialog>
                          <DialogTrigger asChild><Button size="sm" variant="ghost"><PencilLine className="h-4 w-4" />ui.generated.ca7f814c0a4</Button></DialogTrigger>
                          <DialogContent className="w-[min(94vw,860px)]">
                            <DialogHeader><DialogTitle>ui.generated.ce796a05817</DialogTitle><DialogDescription>{connector.name}</DialogDescription></DialogHeader>
                            <DialogBody><ConnectorForm businessTeams={teamOptions} connector={connector} /></DialogBody>
                          </DialogContent>
                        </Dialog>
                        <DeleteResourceButton endpoint="/api/connectors" id={connector.id} confirmParams={{ resource: "ui.common.resources.connector", name: connector.name }} />
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
