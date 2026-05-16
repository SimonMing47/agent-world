import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Panel, PanelBody, PanelHeader } from "@/components/ui/panel";
import { translateStatus, translateVisibility } from "@/lib/presentation";
import { getTaskBlueprintsSnapshot } from "@/server/queries";

function triggerLabel(trigger: Record<string, unknown>) {
  if (trigger.type === "webhook") return `Webhook · ${String(trigger.event ?? trigger.webhookPathKey ?? "")}`;
  if (trigger.type === "cron") return `Cron · ${String(trigger.expression ?? "")}`;
  return String(trigger.type ?? "manual");
}

export default function TaskBlueprintsPage() {
  const snapshot = getTaskBlueprintsSnapshot();

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Blueprints"
        title="任务蓝图目录"
        description="统一管理任务蓝图的触发器、环境、Agent 团队和输出策略。"
        badges={[
          { label: `${snapshot.blueprints.length} 个蓝图`, variant: "accent" },
          { label: `${snapshot.providerAdapters.length} 个 Provider Adapter`, variant: "neutral" },
        ]}
      />

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Panel>
          <PanelBody className="p-5">
            <div className="text-sm text-[var(--ink-muted)]">任务蓝图</div>
            <div className="mt-2 text-3xl font-semibold text-[var(--ink)]">{snapshot.blueprints.length}</div>
          </PanelBody>
        </Panel>
        <Panel>
          <PanelBody className="p-5">
            <div className="text-sm text-[var(--ink-muted)]">Finding 总数</div>
            <div className="mt-2 text-3xl font-semibold text-[var(--ink)]">{snapshot.findingDashboard.total}</div>
          </PanelBody>
        </Panel>
        <Panel>
          <PanelBody className="p-5">
            <div className="text-sm text-[var(--ink-muted)]">高危及以上</div>
            <div className="mt-2 text-3xl font-semibold text-[var(--ink)]">
              {snapshot.findingDashboard.bySeverity
                .filter((item) => ["critical", "high"].includes(item.severity))
                .reduce((sum, item) => sum + item.count, 0)}
            </div>
          </PanelBody>
        </Panel>
        <Panel>
          <PanelBody className="p-5">
            <div className="text-sm text-[var(--ink-muted)]">Provider Adapter</div>
            <div className="mt-2 text-3xl font-semibold text-[var(--ink)]">{snapshot.providerAdapters.length}</div>
          </PanelBody>
        </Panel>
      </section>

      <Panel>
        <PanelHeader
          eyebrow="Catalog"
          title="蓝图清单"
          description="以运营控制台视图浏览每个蓝图的归属、触发方式、Provider 和风险产出。"
        />
        <PanelBody className="space-y-3">
          {snapshot.blueprints.map((blueprint) => (
            <Link
              key={blueprint.id}
              href={`/task-blueprints/${blueprint.id}`}
              className="block rounded-xl border border-[var(--line)] bg-[var(--surface-muted)] px-4 py-4 transition hover:border-[var(--line-strong)] hover:bg-white"
            >
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="neutral">{blueprint.category}</Badge>
                    <Badge variant="neutral">v{blueprint.version}</Badge>
                    <Badge variant={blueprint.status === "active" ? "success" : "neutral"}>
                      {translateStatus(blueprint.status)}
                    </Badge>
                    <Badge variant="neutral">{translateVisibility(blueprint.visibility)}</Badge>
                  </div>
                  <h3 className="mt-3 text-lg font-semibold text-[var(--ink)]">{blueprint.name}</h3>
                  <div className="mt-2 grid gap-2 text-sm text-[var(--ink-muted)] sm:grid-cols-2 xl:grid-cols-3">
                    <div>业务团队: {blueprint.businessTeamName}</div>
                    <div>Agent 团队: {blueprint.agentTeamName}</div>
                    <div>触发器: {triggerLabel(blueprint.trigger)}</div>
                    <div>Provider: {blueprint.providerName}</div>
                    <div>运行次数: {blueprint.runCount}</div>
                    <div>Finding: {blueprint.findingCount} / 高危 {blueprint.criticalOrHighFindingCount}</div>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 lg:max-w-[220px] lg:justify-end">
                  {blueprint.publishers.map((publisher, index) => {
                    const record = publisher as Record<string, unknown>;
                    return (
                      <Badge key={`${blueprint.id}-${index}`} variant="accent">
                        {String(record.type ?? "publisher")}
                      </Badge>
                    );
                  })}
                </div>
              </div>
            </Link>
          ))}
        </PanelBody>
      </Panel>
    </div>
  );
}
