import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import {
  DataTable,
  DataTableBody,
  DataTableCell,
  DataTableHead,
  DataTableHeader,
  DataTableRow,
} from "@/components/ui/data-table";
import { Panel, PanelBody, PanelHeader } from "@/components/ui/panel";
import { getDashboardSnapshot, listAgentTeams } from "@/server/queries";
import { formatPercent } from "@/lib/utils";

export default function AgentTeamWallboardPage() {
  const snapshot = getDashboardSnapshot();
  const rawTeams = listAgentTeams();

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="ui.generated.cc122e1758c"
        title="ui.generated.c0309379742"
        description="ui.generated.c06c454a5b4"
        badges={[{ label: <>{snapshot.teamSummaries.length} ui.common.count.agentTeams</>, variant: "accent" }]}
      />

      <Panel>
        <PanelHeader eyebrow="ui.generated.cd4f6dd33b7" title="ui.generated.c9ec68a11fb" description="ui.generated.c2c03ac5959" />
        <PanelBody className="p-0">
          <DataTable>
            <DataTableHeader>
              <DataTableRow className="hover:bg-transparent">
                <DataTableHead>ui.generated.c70f970c1fc</DataTableHead>
                <DataTableHead>ui.generated.c2b90028ff3</DataTableHead>
                <DataTableHead>ui.generated.cc1ee9f0190</DataTableHead>
                <DataTableHead>ui.generated.c971c6e5190</DataTableHead>
                <DataTableHead>ui.generated.c95ce6f5cb5</DataTableHead>
                <DataTableHead>ui.generated.cdb3140b58c</DataTableHead>
                <DataTableHead>ui.generated.c747b74cec9</DataTableHead>
              </DataTableRow>
            </DataTableHeader>
            <DataTableBody>
              {snapshot.teamSummaries.map((team) => {
                const rawTeam = rawTeams.find((item) => item.id === team.id);
                const blueprints = snapshot.taskBlueprints.filter((blueprint) => blueprint.agentTeamName === team.name);
                const runs = snapshot.task_runs.filter((run) => run.teamId === team.id);
                const businessTeam = snapshot.businessTeamSummaries.find((item) => item.id === rawTeam?.businessTeamId);
                return (
                  <DataTableRow key={team.id}>
                    <DataTableCell>
                      <Link href="/agent-teams" className="font-semibold text-[var(--ink)] hover:underline">{team.name}</Link>
                      <div className="mt-1 text-xs text-[var(--ink-muted)]">{team.workflowType}</div>
                    </DataTableCell>
                    <DataTableCell>{businessTeam?.name ?? "ui.generated.c718c1c03d6"}</DataTableCell>
                    <DataTableCell>{team.agentCount}</DataTableCell>
                    <DataTableCell>{blueprints.length}</DataTableCell>
                    <DataTableCell>{runs.length}</DataTableCell>
                    <DataTableCell>{formatPercent(team.successRateTarget)}</DataTableCell>
                    <DataTableCell><Badge variant={team.visibility === "public" ? "success" : "neutral"}>{team.visibility}</Badge></DataTableCell>
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
