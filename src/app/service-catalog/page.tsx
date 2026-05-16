import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Panel, PanelBody, PanelHeader } from "@/components/ui/panel";
import { translateRecruitmentMode } from "@/lib/presentation";
import { formatPercent } from "@/lib/utils";
import { getDashboardSnapshot } from "@/server/queries";

export default function ServiceCatalogPage() {
  const snapshot = getDashboardSnapshot();

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Service Catalog"
        title="服务目录"
        description="观察跨团队可招募能力的成功率、延迟、成本与标签。"
        badges={[
          { label: `${snapshot.serviceCatalogResumes.length} 条目录记录`, variant: "accent" },
        ]}
      />

      {snapshot.serviceCatalogResumes.map((listing) => (
        <Panel key={listing.id}>
          <PanelHeader
            eyebrow="服务目录条目"
            title={listing.teamName}
            action={<Badge variant="neutral">{translateRecruitmentMode(listing.recruitmentMode)}</Badge>}
          />
          <PanelBody className="grid gap-3 md:grid-cols-2 xl:grid-cols-4 text-sm text-[var(--ink-muted)]">
            <div>成功率: <span className="font-medium text-[var(--ink)]">{formatPercent(listing.resume.successRate ?? 0)}</span></div>
            <div>平均耗时: <span className="font-medium text-[var(--ink)]">{Math.round((listing.resume.avgLatencyMs ?? 0) / 1000)}s</span></div>
            <div>平均成本: <span className="font-medium text-[var(--ink)]">${listing.resume.avgCostUsd ?? 0}</span></div>
            <div>标签: <span className="font-medium text-[var(--ink)]">{listing.tags.join(", ")}</span></div>
          </PanelBody>
        </Panel>
      ))}
    </div>
  );
}
