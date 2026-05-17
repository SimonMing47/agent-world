import { RuntimeDiscoveryButton } from "@/components/runtime-discovery-button";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Panel, PanelBody, PanelHeader } from "@/components/ui/panel";
import { translateRuntimeKind, translateStatus } from "@/lib/presentation";
import { getDashboardSnapshot } from "@/server/queries";

export default function RuntimesPage() {
  const snapshot = getDashboardSnapshot();

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Runtimes"
        title="执行运行时"
        description="校验 Pi Runtime Adapter 与外部模型接口的真实可用性，并观察每个运行时的健康状态。"
        badges={[
          { label: `${snapshot.runtimes.length} 个运行时`, variant: "accent" },
        ]}
      />

      <div className="flex justify-end">
        <RuntimeDiscoveryButton />
      </div>

      <section className="space-y-4">
        {snapshot.runtimes.map((runtime) => (
          <Panel key={runtime.id}>
            <PanelHeader
              eyebrow="Runtime"
              title={runtime.name}
              description={runtime.baseUrl}
              action={<Badge variant="neutral">{translateStatus(runtime.healthStatus)}</Badge>}
            />
            <PanelBody className="grid gap-3 text-sm text-[var(--ink-muted)] md:grid-cols-2 xl:grid-cols-4">
              <div>类型: <span className="font-medium text-[var(--ink)]">{translateRuntimeKind(runtime.runtimeKind)}</span></div>
              <div>并发占用: <span className="font-medium text-[var(--ink)]">{runtime.activeRunCount} / {runtime.concurrencyLimit}</span></div>
              <div>Agent 目录: <span className="font-medium text-[var(--ink)]">{runtime.agents.join(", ") || "未发现 Agent"}</span></div>
              <div>Provider 目录: <span className="font-medium text-[var(--ink)]">{runtime.providers.join(", ") || "未发现 Provider"}</span></div>
            </PanelBody>
          </Panel>
        ))}
      </section>
    </div>
  );
}
