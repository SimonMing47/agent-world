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
        eyebrow="ui.generated.c41decbbd6e"
        title="ui.generated.cca8171b97e"
        description="ui.generated.cea69c1cb77"
        badges={[
          { label: <>{visibleGrants.length} ui.common.count.assetGrants</>, variant: "accent" },
          { label: <>{new Set(visibleGrants.map((grant) => grant.assetType)).size} ui.common.count.categories</>, variant: "neutral" },
          ...(selectedTeam ? [{ label: selectedTeam.name, variant: "success" as const }] : []),
        ]}
      />

      <SummaryStrip
        items={[
          { label: "ui.generated.c4ffbca2945", value: selectedTeam?.name ?? "ui.generated.cbd2c65c3b9", detail: selectedTeam ? "ui.generated.cbc11cb027d" : "ui.generated.c37efe8d964" },
          { label: "ui.generated.c697e6f3e85", value: visibleGrants.filter((grant) => !grant.memberId).length, detail: "ui.generated.c39ad083712" },
          { label: "ui.generated.ce788115afc", value: visibleGrants.filter((grant) => Boolean(grant.memberId)).length, detail: "ui.generated.cdcb62e5950" },
          { label: "ui.generated.c74e3df5bd8", value: new Set(visibleGrants.map((grant) => grant.assetType)).size, detail: "ui.generated.c2b0869c742" },
        ]}
      />

      <Panel>
        <PanelHeader
          eyebrow="ui.generated.c778ab92119"
          title="ui.generated.ccdec5a201c"
          description={selectedTeam ? <>ui.common.detail.currentOnlyShows {selectedTeam.name} ui.common.detail.assetsOnly</> : "ui.generated.c40a38886dd"}
          action={
            <div className="flex flex-wrap gap-2">
              {selectedTeam ? (
                <Button asChild size="sm" variant="ghost"><Link href="/team-assets">ui.generated.ced2172fd78</Link></Button>
              ) : null}
              <Dialog>
                <DialogTrigger asChild><Button size="sm" variant="secondary"><Plus className="h-4 w-4" />ui.generated.ca6f30f10f3</Button></DialogTrigger>
                <DialogContent className="w-[min(94vw,860px)]">
                  <DialogHeader><DialogTitle>ui.generated.ca6f30f10f3</DialogTitle><DialogDescription>ui.generated.cad0e1ea67f</DialogDescription></DialogHeader>
                  <DialogBody>
                    <AssetGrantForm
                      businessTeams={teamOptions}
                      members={memberOptions}
	                      grant={{
	                        id: "",
	                        businessTeamId: selectedTeam?.id ?? "",
	                        memberId: null,
	                        assetType: "",
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
                <DataTableHead>ui.generated.c713fd96fb2</DataTableHead>
                <DataTableHead>ui.generated.c79b92cb768</DataTableHead>
                <DataTableHead>ui.generated.ce4e46c7235</DataTableHead>
                <DataTableHead>ui.generated.c560165a6d7</DataTableHead>
                <DataTableHead>ui.generated.c62e951a692</DataTableHead>
                <DataTableHead align="right">ui.generated.cf3ea6d345e</DataTableHead>
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
                      <div>{team?.name ?? "ui.generated.c718c1c03d6"}</div>
                      <div className="mt-1 text-xs text-[var(--ink-muted)]">{member?.name ?? "ui.generated.cc09ac5c242"}</div>
                    </DataTableCell>
                    <DataTableCell>{grant.assetType}</DataTableCell>
                    <DataTableCell className="max-w-[360px] truncate font-mono text-xs">{permission(grant.permissionJson)}</DataTableCell>
                    <DataTableCell><Badge variant={grant.status === "active" ? "success" : "neutral"}>{grant.status}</Badge></DataTableCell>
                    <DataTableCell align="right">
                      <div className="flex justify-end gap-2">
                        <Dialog>
                          <DialogTrigger asChild><Button size="sm" variant="ghost"><PencilLine className="h-4 w-4" />ui.generated.ca7f814c0a4</Button></DialogTrigger>
                          <DialogContent className="w-[min(94vw,860px)]">
                            <DialogHeader><DialogTitle>ui.generated.ccc191ecf7c</DialogTitle><DialogDescription>{grant.assetName}</DialogDescription></DialogHeader>
                            <DialogBody><AssetGrantForm businessTeams={teamOptions} members={memberOptions} grant={grant} /></DialogBody>
                          </DialogContent>
                        </Dialog>
                        <DeleteResourceButton endpoint="/api/team-assets" id={grant.id} confirmParams={{ resource: "ui.common.resources.assetGrant", name: grant.assetName }} />
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
