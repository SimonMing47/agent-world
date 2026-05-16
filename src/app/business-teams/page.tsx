import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Panel, PanelBody, PanelHeader } from "@/components/ui/panel";
import { getDashboardSnapshot } from "@/server/queries";
import { translateStatus } from "@/lib/presentation";

export default function BusinessTeamsPage() {
  const snapshot = getDashboardSnapshot();

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Business Teams"
        title="业务团队治理"
        description="从预算、信用额度、工具引用和私有记忆空间观察团队使用边界。"
        badges={[
          { label: `${snapshot.businessTeamSummaries.length} 个业务团队`, variant: "accent" },
        ]}
      />

      {snapshot.businessTeamSummaries.map((businessTeam) => (
        <Panel key={businessTeam.id}>
          <PanelHeader
            eyebrow="业务团队"
            title={businessTeam.name}
            action={<Badge variant="neutral">{translateStatus(businessTeam.status)}</Badge>}
          />
          <PanelBody className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4 text-sm text-[var(--ink-muted)]">
            <div>余额: <span className="font-medium text-[var(--ink)]">${businessTeam.balance}</span></div>
            <div>信用额度: <span className="font-medium text-[var(--ink)]">${businessTeam.creditLimit}</span></div>
            <div>工具引用数: <span className="font-medium text-[var(--ink)]">{businessTeam.toolRefCount}</span></div>
            <div>私有记忆命名空间: <span className="font-medium text-[var(--ink)]">{businessTeam.privateMemoryNamespace}</span></div>
          </PanelBody>
        </Panel>
      ))}
    </div>
  );
}
