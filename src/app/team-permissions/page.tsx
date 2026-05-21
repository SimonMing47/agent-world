import Link from "next/link";
import { PencilLine, Plus } from "lucide-react";
import { PermissionGrantForm } from "@/components/admin-forms";
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
import { filterBusinessTeamsForAuthContext, getRequestAuthContext } from "@/server/auth-core";
import { listTeamMembers, listTeamPermissionGrants } from "@/server/governance-core";
import { listBusinessTeams } from "@/server/queries";

function actions(value: string) {
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? parsed.map(String).join(", ") : "";
  } catch {
    return "";
  }
}

export default async function TeamPermissionsPage({
  searchParams,
}: {
  searchParams?: Promise<{ teamId?: string }>;
}) {
  const params = await searchParams;
  const authContext = await getRequestAuthContext();
  const businessTeams = filterBusinessTeamsForAuthContext(listBusinessTeams(), authContext);
  const visibleBusinessTeamIds = new Set(businessTeams.map((team) => team.id));
  const grants = listTeamPermissionGrants().filter((grant) => visibleBusinessTeamIds.has(grant.businessTeamId));
  const members = listTeamMembers().filter((member) => visibleBusinessTeamIds.has(member.businessTeamId));
  const selectedTeamId = params?.teamId ?? "";
  const selectedTeam = businessTeams.find((team) => team.id === selectedTeamId);
  const visibleGrants = selectedTeam ? grants.filter((grant) => grant.businessTeamId === selectedTeam.id) : grants;
  const teamOptions = businessTeams.map((team) => ({ id: team.id, name: team.name }));
  const memberOptions = members.map((member) => ({ id: member.id, name: `${member.name} / ${member.employeeNo}` }));

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="ui.generated.c41decbbd6e"
        title="ui.generated.cee253da8fd"
        description="ui.generated.c1a899e8410"
        badges={[
          { label: <>{visibleGrants.length} ui.common.count.permissionRules</>, variant: "accent" },
          { label: <>{visibleGrants.filter((grant) => grant.effect === "deny").length} ui.common.count.rejectionRules</>, variant: "warning" },
          ...(selectedTeam ? [{ label: selectedTeam.name, variant: "success" as const }] : []),
        ]}
      />

      <SummaryStrip
        items={[
          { label: "ui.generated.c4ffbca2945", value: selectedTeam?.name ?? "ui.generated.cbd2c65c3b9", detail: selectedTeam ? "ui.generated.cbc11cb027d" : "ui.generated.c37efe8d964" },
          { label: "ui.generated.c4c0c0aed67", value: visibleGrants.filter((grant) => grant.effect === "allow").length, detail: "ui.generated.c67a85b8c85" },
          { label: "ui.generated.cd00dc39af5", value: visibleGrants.filter((grant) => grant.effect === "ask").length, detail: "ui.generated.cff7c9677f6" },
          { label: "ui.generated.c03e210a66d", value: visibleGrants.filter((grant) => grant.effect === "deny").length, detail: "ui.generated.c09f0ffea66" },
        ]}
      />

      <Panel>
        <PanelHeader
          eyebrow="ui.generated.c95f4519aab"
          title="ui.generated.c95f4519aab"
          description={selectedTeam ? <>ui.common.detail.currentOnlyShows {selectedTeam.name} ui.common.detail.permissionsOnly</> : "ui.generated.cbd2a8e919d"}
          action={
            <div className="flex flex-wrap gap-2">
              {selectedTeam ? (
                <Button asChild size="sm" variant="ghost"><Link href="/team-permissions">ui.generated.ced2172fd78</Link></Button>
              ) : null}
              <Dialog>
                <DialogTrigger asChild><Button size="sm" variant="secondary"><Plus className="h-4 w-4" />ui.generated.c31493c4a03</Button></DialogTrigger>
                <DialogContent className="w-[min(94vw,860px)]">
                  <DialogHeader><DialogTitle>ui.generated.c5b3707437a</DialogTitle><DialogDescription>ui.generated.ce6f2bfc65d</DialogDescription></DialogHeader>
                  <DialogBody>
                    <PermissionGrantForm
                      businessTeams={teamOptions}
                      members={memberOptions}
	                      grant={{
	                        id: "",
	                        businessTeamId: selectedTeam?.id ?? "",
	                        memberId: null,
	                        principalType: "",
	                        roleKey: "",
	                        resourceType: "",
	                        resourceScope: "",
                        actionsJson: "[]",
                        effect: "allow",
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
                <DataTableHead>ui.generated.c6b26695e4d</DataTableHead>
                <DataTableHead>ui.generated.c79b92cb768</DataTableHead>
                <DataTableHead>ui.generated.cc5ca3950cb</DataTableHead>
                <DataTableHead>ui.generated.cd9d9827827</DataTableHead>
                <DataTableHead>ui.generated.c151ddd4f1f</DataTableHead>
                <DataTableHead align="right">ui.generated.cf3ea6d345e</DataTableHead>
              </DataTableRow>
            </DataTableHeader>
            <DataTableBody>
              {visibleGrants.map((grant) => {
                const team = businessTeams.find((item) => item.id === grant.businessTeamId);
                const member = members.find((item) => item.id === grant.memberId);
                return (
                  <DataTableRow key={grant.id}>
                    <DataTableCell>{grant.roleKey}</DataTableCell>
                    <DataTableCell>
                      <div className="font-medium text-[var(--ink)]">{team?.name ?? "ui.generated.c718c1c03d6"}</div>
                      <div className="mt-1 text-xs text-[var(--ink-muted)]">{member?.name ?? "ui.generated.cf39bcb6746"}</div>
                    </DataTableCell>
                    <DataTableCell>{grant.resourceType} · {grant.resourceScope}</DataTableCell>
                    <DataTableCell className="max-w-[320px]">{actions(grant.actionsJson)}</DataTableCell>
                    <DataTableCell><Badge variant={grant.effect === "allow" ? "success" : grant.effect === "deny" ? "warning" : "neutral"}>{grant.effect}</Badge></DataTableCell>
                    <DataTableCell align="right">
                      <div className="flex justify-end gap-2">
                        <Dialog>
                          <DialogTrigger asChild><Button size="sm" variant="ghost"><PencilLine className="h-4 w-4" />ui.generated.ca7f814c0a4</Button></DialogTrigger>
                          <DialogContent className="w-[min(94vw,860px)]">
                            <DialogHeader><DialogTitle>ui.generated.c143e809caf</DialogTitle><DialogDescription>{grant.roleKey}</DialogDescription></DialogHeader>
                            <DialogBody><PermissionGrantForm businessTeams={teamOptions} members={memberOptions} grant={grant} /></DialogBody>
                          </DialogContent>
                        </Dialog>
                        <DeleteResourceButton endpoint="/api/team-permissions" id={grant.id} confirmParams={{ resource: "ui.common.resources.permissionRules", name: grant.roleKey }} />
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
