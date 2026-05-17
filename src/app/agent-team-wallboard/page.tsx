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
        eyebrow="总览"
        title="Agent 团队看板"
        description="查看 Agent 团队的成员规模、任务量和运行表现。"
        badges={[{ label: `${snapshot.teamSummaries.length} 个 Agent 团队`, variant: "accent" }]}
      />

      <Panel>
        <PanelHeader eyebrow="执行团队" title="Agent 团队概览" description="按团队查看任务和成员数据。" />
        <PanelBody className="p-0">
          <DataTable>
            <DataTableHeader>
              <DataTableRow className="hover:bg-transparent">
                <DataTableHead>Agent 团队</DataTableHead>
                <DataTableHead>业务团队</DataTableHead>
                <DataTableHead>成员</DataTableHead>
                <DataTableHead>任务定义</DataTableHead>
                <DataTableHead>运行实例</DataTableHead>
                <DataTableHead>成功率门槛</DataTableHead>
                <DataTableHead>可见性</DataTableHead>
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
                    <DataTableCell>{businessTeam?.name ?? "未知团队"}</DataTableCell>
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
