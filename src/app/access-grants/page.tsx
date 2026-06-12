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
import { filterBusinessTeamsForAuthContext, getRequestAuthContext } from "@/server/auth-core";
import { listAccessGrants, listAgentTeams, listBusinessTeams } from "@/server/queries";

function parseRecord(value: string) {
  try {
    return JSON.parse(value) as Record<string, number | string | boolean>;
  } catch {
    return {};
  }
}

export default async function AccessGrantsPage() {
  const authContext = await getRequestAuthContext();
  const businessTeams = filterBusinessTeamsForAuthContext(listBusinessTeams(), authContext);
  const visibleBusinessTeamIds = new Set(businessTeams.map((team) => team.id));
  const agentTeams = listAgentTeams().filter((team) => visibleBusinessTeamIds.has(team.businessTeamId));
  const visibleAgentTeamIds = new Set(agentTeams.map((team) => team.id));
  const accessGrants = listAccessGrants().filter(
    (grant) =>
      visibleBusinessTeamIds.has(grant.consumerBusinessTeamId) ||
      visibleAgentTeamIds.has(grant.providerTeamId),
  );
  const agentTeamOptions = agentTeams.map((team) => ({ id: team.id, name: team.name }));
  const businessTeamOptions = businessTeams.map((team) => ({ id: team.id, name: team.name }));

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="ui.generated.c2c4520c3e3"
        title="ui.generated.c2c4520c3e3"
        description="ui.generated.cf13f0d7c89"
        badges={[{ label: <>{accessGrants.length} ui.common.count.accessGrants</>, variant: "accent" }]}
      />

      <Panel>
        <PanelHeader
          eyebrow="ui.generated.c41e5243e2d"
          title="ui.generated.cfaf03eb6b4"
          description="ui.generated.cf3f92ce184"
          action={
            <Dialog>
              <DialogTrigger asChild><Button size="sm" variant="secondary"><Plus className="h-4 w-4" />ui.generated.cf31d0722b7</Button></DialogTrigger>
              <DialogContent className="w-[min(94vw,820px)]">
                <DialogHeader><DialogTitle>ui.generated.caf04158d81</DialogTitle><DialogDescription>ui.generated.c464f898bb9</DialogDescription></DialogHeader>
                <DialogBody>
                  <AccessGrantForm
                    agentTeams={agentTeamOptions}
                    businessTeams={businessTeamOptions}
	                    grant={{
	                      id: "",
	                      providerTeamId: "",
	                      consumerBusinessTeamId: "",
	                      pricingModelJson: "{}",
	                      slaJson: JSON.stringify({ responseSeconds: 60, successRateFloor: 0.95 }, null, 2),
	                      accessScopeJson: "{}",
	                      serviceAccountRef: "",
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
                <DataTableHead>ui.generated.c6a7069fb0c</DataTableHead>
                <DataTableHead>ui.generated.cfa32a6feeb</DataTableHead>
                <DataTableHead>ui.generated.c65596a6283</DataTableHead>
                <DataTableHead>SLA</DataTableHead>
                <DataTableHead>ui.generated.c62e951a692</DataTableHead>
                <DataTableHead align="right">ui.generated.cf3ea6d345e</DataTableHead>
              </DataTableRow>
            </DataTableHeader>
            <DataTableBody>
              {accessGrants.map((grant) => {
                const providerTeam = agentTeams.find((team) => team.id === grant.providerTeamId);
                const consumerTeam = businessTeams.find((team) => team.id === grant.consumerBusinessTeamId);
                const sla = parseRecord(grant.slaJson);
                return (
                  <DataTableRow key={grant.id}>
                    <DataTableCell>{providerTeam?.name ?? grant.providerTeamId}</DataTableCell>
                    <DataTableCell>{consumerTeam?.name ?? grant.consumerBusinessTeamId}</DataTableCell>
                    <DataTableCell>{grant.serviceAccountRef}</DataTableCell>
                    <DataTableCell>{sla.responseSeconds ?? 0}s / {Math.round(Number(sla.successRateFloor ?? 0) * 100)}%</DataTableCell>
                    <DataTableCell><Badge variant={grant.status === "active" ? "success" : "neutral"}>{translateStatus(grant.status)}</Badge></DataTableCell>
                    <DataTableCell align="right">
                      <div className="flex justify-end gap-2">
                        <Dialog>
                          <DialogTrigger asChild><Button size="sm" variant="ghost"><Eye className="h-4 w-4" />ui.generated.cf7acefd2d4</Button></DialogTrigger>
                          <DialogContent>
                            <DialogHeader><DialogTitle>{providerTeam?.name ?? "ui.generated.c3a6e607f0c"}</DialogTitle><DialogDescription>ui.generated.cd6ada860cf</DialogDescription></DialogHeader>
                            <DialogBody><DefinitionList items={[{ label: "ui.generated.c1af8d01a5d", value: grant.id }, { label: "SLA", value: grant.slaJson }, { label: "ui.generated.c241d8ef92f", value: grant.accessScopeJson }]} /></DialogBody>
                          </DialogContent>
                        </Dialog>
                        <Dialog>
                          <DialogTrigger asChild><Button size="sm" variant="ghost"><PencilLine className="h-4 w-4" />ui.generated.ca7f814c0a4</Button></DialogTrigger>
                          <DialogContent className="w-[min(94vw,820px)]">
                            <DialogHeader><DialogTitle>ui.generated.c5cfc7f9695</DialogTitle><DialogDescription>{grant.serviceAccountRef}</DialogDescription></DialogHeader>
                            <DialogBody><AccessGrantForm agentTeams={agentTeamOptions} businessTeams={businessTeamOptions} grant={grant} /></DialogBody>
                          </DialogContent>
                        </Dialog>
                        <DeleteResourceButton endpoint="/api/access-grants" id={grant.id} confirmText="ui.generated.cdd6ac8cd3f" />
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
