import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Panel, PanelBody, PanelHeader } from "@/components/ui/panel";
import { getDashboardSnapshot } from "@/server/queries";
import { translateStatus } from "@/lib/presentation";

export default function TenantSpacesPage() {
  const snapshot = getDashboardSnapshot();

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Tenant Spaces"
        title="租户空间"
        description="从业务团队数量、预算上限和最大并发任务数观察租户级治理边界。"
        badges={[
          { label: `${snapshot.tenantSpaceSummaries.length} 个租户空间`, variant: "accent" },
        ]}
      />

      {snapshot.tenantSpaceSummaries.map((tenantSpace) => (
        <Panel key={tenantSpace.id}>
          <PanelHeader
            eyebrow="租户空间"
            title={tenantSpace.name}
            action={<Badge variant="neutral">{translateStatus(tenantSpace.status)}</Badge>}
          />
          <PanelBody className="grid gap-3 md:grid-cols-3 text-sm text-[var(--ink-muted)]">
            <div>业务团队数量: <span className="font-medium text-[var(--ink)]">{tenantSpace.businessTeamCount}</span></div>
            <div>月度预算上限: <span className="font-medium text-[var(--ink)]">${tenantSpace.monthlyUsd}</span></div>
            <div>最大并发任务: <span className="font-medium text-[var(--ink)]">{tenantSpace.maxRunningTaskRuns}</span></div>
          </PanelBody>
        </Panel>
      ))}
    </div>
  );
}
