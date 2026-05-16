import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Panel, PanelBody, PanelHeader } from "@/components/ui/panel";
import { getDashboardSnapshot } from "@/server/queries";
import { translateStatus } from "@/lib/presentation";

export default function AccessGrantsPage() {
  const snapshot = getDashboardSnapshot();

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Access Grants"
        title="跨团队授权"
        description="查看服务账号、价格、SLA 和当前授权状态。"
        badges={[
          { label: `${snapshot.access_grants.length} 条授权`, variant: "accent" },
        ]}
      />

      {snapshot.access_grants.map((accessGrant) => (
        <Panel key={accessGrant.id}>
          <PanelHeader
            eyebrow="跨团队授权"
            title={`${accessGrant.providerTeamName} -> ${accessGrant.consumerBusinessTeamName}`}
            action={<Badge variant="neutral">{translateStatus(accessGrant.status)}</Badge>}
          />
          <PanelBody className="grid gap-3 md:grid-cols-2 xl:grid-cols-4 text-sm text-[var(--ink-muted)]">
            <div>服务账号: <span className="font-medium text-[var(--ink)]">{accessGrant.serviceAccountRef}</span></div>
            <div>基础价格: <span className="font-medium text-[var(--ink)]">${accessGrant.pricing.baseUsd ?? 0}</span></div>
            <div>Token 倍率: <span className="font-medium text-[var(--ink)]">{accessGrant.pricing.tokenMultiplier ?? 0}</span></div>
            <div>SLA: <span className="font-medium text-[var(--ink)]">{accessGrant.sla.responseSeconds ?? 0}s / {Math.round((accessGrant.sla.successRateFloor ?? 0) * 100)}%</span></div>
          </PanelBody>
        </Panel>
      ))}
    </div>
  );
}
