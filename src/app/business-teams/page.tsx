import Link from "next/link";
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
import { Panel, PanelBody, PanelHeader } from "@/components/ui/panel";
import { getDashboardSnapshot } from "@/server/queries";

export default function BusinessTeamsPage() {
  const snapshot = getDashboardSnapshot();

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Team Governance"
        title="组织结构定义"
        description="团队是业务、人、资产和任务的治理中心。当前支持手工维护，后续可从外部组织系统同步团队结构和成员归属。"
        badges={[
          { label: `${snapshot.businessTeamSummaries.length} 个业务团队`, variant: "accent" },
          { label: `${snapshot.taskBlueprints.length} 个任务定义`, variant: "neutral" },
        ]}
      />

      <Panel>
        <PanelHeader
          eyebrow="Organization"
          title="业务团队目录"
          description="团队和智能体团队是两个不同概念：团队与人和资产相关；智能体团队是任务调度单元。"
          action={
            <div className="flex gap-2">
              <Button asChild size="sm" variant="secondary">
                <Link href="/team-members">成员管理</Link>
              </Button>
              <Button asChild size="sm" variant="ghost">
                <Link href="/team-assets">资产治理</Link>
              </Button>
            </div>
          }
        />
        <PanelBody className="p-0">
          <DataTable>
            <DataTableHeader>
              <DataTableRow className="hover:bg-transparent">
                <DataTableHead>团队</DataTableHead>
                <DataTableHead>私有知识命名空间</DataTableHead>
                <DataTableHead>工具引用</DataTableHead>
                <DataTableHead>任务定义</DataTableHead>
                <DataTableHead>预算</DataTableHead>
                <DataTableHead>状态</DataTableHead>
              </DataTableRow>
            </DataTableHeader>
            <DataTableBody>
              {snapshot.businessTeamSummaries.map((team) => {
                const blueprints = snapshot.taskBlueprints.filter((blueprint) => blueprint.businessTeamName === team.name);
                return (
                  <DataTableRow key={team.id}>
                    <DataTableCell>
                      <div className="font-semibold text-[var(--ink)]">{team.name}</div>
                      <div className="mt-1 text-xs text-[var(--ink-muted)]">{team.id}</div>
                    </DataTableCell>
                    <DataTableCell>{team.privateMemoryNamespace}</DataTableCell>
                    <DataTableCell>{team.toolRefCount}</DataTableCell>
                    <DataTableCell>{blueprints.length}</DataTableCell>
                    <DataTableCell>${team.balance} / ${team.creditLimit}</DataTableCell>
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
