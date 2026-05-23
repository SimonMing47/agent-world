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
import { getDashboardSnapshot } from "@/server/queries";

export default function TeamWallboardPage() {
  const snapshot = getDashboardSnapshot();

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="ui.generated.cc122e1758c"
        title="ui.generated.c40b17f7982"
        description="ui.generated.c1305e9c72f"
        badges={[{ label: <>{snapshot.businessTeamSummaries.length} ui.common.count.teams</>, variant: "accent" }]}
      />

      <Panel>
        <PanelHeader eyebrow="ui.generated.cc371224569" title="ui.generated.c633560b55a" description="ui.generated.cc19c3953d9" />
        <PanelBody className="p-0">
          <DataTable>
            <DataTableHeader>
              <DataTableRow className="hover:bg-transparent">
                <DataTableHead>ui.generated.c2b90028ff3</DataTableHead>
                <DataTableHead>ui.generated.c971c6e5190</DataTableHead>
                <DataTableHead>ui.generated.c95ce6f5cb5</DataTableHead>
                <DataTableHead>ui.generated.c389af6fb71</DataTableHead>
              </DataTableRow>
            </DataTableHeader>
            <DataTableBody>
              {snapshot.businessTeamSummaries.map((team) => {
                const blueprints = snapshot.taskBlueprints.filter((blueprint) => blueprint.businessTeamName === team.name);
                const runs = snapshot.task_runs.filter((run) => run.businessTeamId === team.id);
                return (
                  <DataTableRow key={team.id}>
                    <DataTableCell>
                      <Link href="/business-teams" className="font-semibold text-[var(--ink)] hover:underline">
                        {team.name}
                      </Link>
                      <div className="mt-1 text-xs text-[var(--ink-muted)]">{team.privateMemoryNamespace}</div>
                    </DataTableCell>
                    <DataTableCell>{blueprints.length}</DataTableCell>
                    <DataTableCell>{runs.length}</DataTableCell>
                    <DataTableCell>
                      <Badge variant={team.status === "active" ? "success" : "neutral"}>{team.status}</Badge>
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
