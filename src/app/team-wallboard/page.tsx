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
        eyebrow="总览"
        title="团队任务看板"
        description="按业务团队查看任务、运行、Finding 和风险状态。"
        badges={[{ label: `${snapshot.businessTeamSummaries.length} 个团队`, variant: "accent" }]}
      />

      <Panel>
        <PanelHeader eyebrow="团队任务" title="团队任务概览" description="按团队统计任务和运行数据。" />
        <PanelBody className="p-0">
          <DataTable>
            <DataTableHeader>
              <DataTableRow className="hover:bg-transparent">
                <DataTableHead>业务团队</DataTableHead>
                <DataTableHead>任务定义</DataTableHead>
                <DataTableHead>运行实例</DataTableHead>
                <DataTableHead>Finding</DataTableHead>
                <DataTableHead>团队状态</DataTableHead>
              </DataTableRow>
            </DataTableHeader>
            <DataTableBody>
              {snapshot.businessTeamSummaries.map((team) => {
                const blueprints = snapshot.taskBlueprints.filter((blueprint) => blueprint.businessTeamName === team.name);
                const runs = snapshot.task_runs.filter((run) => run.businessTeamId === team.id);
                const findings =
                  snapshot.findingDashboard.byBusinessTeam.find((item) => item.businessTeamName === team.name)?.count ?? 0;
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
                    <DataTableCell>{findings}</DataTableCell>
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
