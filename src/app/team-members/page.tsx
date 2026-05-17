import Link from "next/link";
import { PencilLine, Plus, Upload } from "lucide-react";
import { TeamMemberForm, TeamMemberImportForm } from "@/components/admin-forms";
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
import { listTeamMembers } from "@/server/governance-core";
import { listBusinessTeams, listTenantSpaces } from "@/server/queries";

export default async function TeamMembersPage({
  searchParams,
}: {
  searchParams?: Promise<{ teamId?: string }>;
}) {
  const params = await searchParams;
  const members = listTeamMembers();
  const businessTeams = listBusinessTeams();
  const selectedTeamId = params?.teamId ?? "";
  const selectedTeam = businessTeams.find((team) => team.id === selectedTeamId);
  const visibleMembers = selectedTeam ? members.filter((member) => member.businessTeamId === selectedTeam.id) : members;
  const tenantSpaceId = listTenantSpaces()[0]?.id ?? "";
  const teamOptions = businessTeams.map((team) => ({ id: team.id, name: team.name }));

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="ui.generated.c41decbbd6e"
        title="ui.generated.c9d03935192"
        description="ui.generated.c1d8c135166"
        badges={[
          { label: <>{visibleMembers.length} ui.common.count.members</>, variant: "accent" },
          { label: <>{businessTeams.length} ui.common.count.teams</>, variant: "neutral" },
          ...(selectedTeam ? [{ label: selectedTeam.name, variant: "success" as const }] : []),
        ]}
      />

      <SummaryStrip
        items={[
          { label: "ui.generated.c4ffbca2945", value: selectedTeam?.name ?? "ui.generated.cbd2c65c3b9", detail: selectedTeam ? "ui.generated.cbc11cb027d" : "ui.generated.c37efe8d964" },
          { label: "ui.generated.c90e267d830", value: visibleMembers.filter((member) => member.status === "active").length, detail: "ui.generated.cca9f383284" },
          { label: "ui.generated.c0cec5c3a05", value: visibleMembers.filter((member) => member.source === "manual").length, detail: "ui.generated.c7e6c422500" },
          { label: "ui.generated.c7ae9acb5ad", value: visibleMembers.filter((member) => member.source === "excel_import").length, detail: "ui.generated.c1c82099998" },
        ]}
      />

      <Panel>
        <PanelHeader
          eyebrow="ui.generated.cc1ee9f0190"
          title="ui.generated.cd841a634f8"
          description={selectedTeam ? <>ui.common.detail.currentOnlyShows {selectedTeam.name} ui.common.detail.membersOnly</> : "ui.generated.c7a1e0c8398"}
          action={
            <div className="flex flex-wrap gap-2">
              {selectedTeam ? (
                <Button asChild size="sm" variant="ghost"><Link href="/team-members">ui.generated.ced2172fd78</Link></Button>
              ) : null}
              <Dialog>
                <DialogTrigger asChild><Button size="sm" variant="secondary"><Plus className="h-4 w-4" />ui.generated.cb74c7e162f</Button></DialogTrigger>
                <DialogContent className="w-[min(94vw,760px)]">
                  <DialogHeader><DialogTitle>ui.generated.ca0ea3f8562</DialogTitle><DialogDescription>ui.generated.c52ec0060ba</DialogDescription></DialogHeader>
                  <DialogBody>
                    <TeamMemberForm
                      tenantSpaceId={tenantSpaceId}
                      businessTeams={teamOptions}
                      member={{
                        id: "",
                        businessTeamId: businessTeams[0]?.id ?? "",
                        employeeNo: "",
                        name: "",
                        email: "",
                        role: "member",
                        title: "",
                        status: "active",
                      }}
                    />
                  </DialogBody>
                </DialogContent>
              </Dialog>
              <Dialog>
                <DialogTrigger asChild><Button size="sm" variant="ghost"><Upload className="h-4 w-4" />ui.generated.cb7cf68c0cf</Button></DialogTrigger>
                <DialogContent className="w-[min(94vw,760px)]">
                  <DialogHeader><DialogTitle>ui.generated.c336333de1b</DialogTitle><DialogDescription>ui.generated.cd8506c3d96</DialogDescription></DialogHeader>
                  <DialogBody><TeamMemberImportForm tenantSpaceId={tenantSpaceId} businessTeams={teamOptions} /></DialogBody>
                </DialogContent>
              </Dialog>
            </div>
          }
        />
        <PanelBody className="p-0">
          <DataTable>
            <DataTableHeader>
              <DataTableRow className="hover:bg-transparent">
                <DataTableHead>ui.generated.cc1ee9f0190</DataTableHead>
                <DataTableHead>ui.generated.c29f4c9b495</DataTableHead>
                <DataTableHead>ui.generated.c53d4919c45</DataTableHead>
                <DataTableHead>ui.generated.c5a084d5f30</DataTableHead>
                <DataTableHead>ui.generated.cc63f79e636</DataTableHead>
                <DataTableHead>ui.generated.c62e951a692</DataTableHead>
                <DataTableHead align="right">ui.generated.cf3ea6d345e</DataTableHead>
              </DataTableRow>
            </DataTableHeader>
            <DataTableBody>
              {visibleMembers.map((member) => {
                const team = businessTeams.find((item) => item.id === member.businessTeamId);
                return (
                  <DataTableRow key={member.id}>
                    <DataTableCell>
                      <div className="font-semibold text-[var(--ink)]">{member.name}</div>
                      <div className="mt-1 text-xs text-[var(--ink-muted)]">{member.email || "ui.generated.cd348381126"}</div>
                    </DataTableCell>
                    <DataTableCell>{member.employeeNo || "ui.generated.c63595e95b7"}</DataTableCell>
                    <DataTableCell>{team?.name ?? "ui.generated.c718c1c03d6"}</DataTableCell>
                    <DataTableCell>{member.role} / {member.title || "ui.generated.c63595e95b7"}</DataTableCell>
                    <DataTableCell>{member.source}</DataTableCell>
                    <DataTableCell><Badge variant={member.status === "active" ? "success" : "neutral"}>{member.status}</Badge></DataTableCell>
                    <DataTableCell align="right">
                      <div className="flex justify-end gap-2">
                        <Dialog>
                          <DialogTrigger asChild><Button size="sm" variant="ghost"><PencilLine className="h-4 w-4" />ui.generated.ca7f814c0a4</Button></DialogTrigger>
                          <DialogContent className="w-[min(94vw,760px)]">
                            <DialogHeader><DialogTitle>ui.generated.cab5fcb9927</DialogTitle><DialogDescription>{member.name}</DialogDescription></DialogHeader>
                            <DialogBody><TeamMemberForm tenantSpaceId={tenantSpaceId} businessTeams={teamOptions} member={member} /></DialogBody>
                          </DialogContent>
                        </Dialog>
                        <DeleteResourceButton endpoint="/api/team-members" id={member.id} confirmParams={{ resource: "ui.common.resources.member", name: member.name }} />
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
