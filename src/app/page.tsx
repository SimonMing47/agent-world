import Link from "next/link";
import { MetricCard } from "@/components/metric-card";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Panel, PanelBody, PanelHeader } from "@/components/ui/panel";
import { translateSourceType, translateStatus } from "@/lib/presentation";
import { formatDateTime } from "@/lib/utils";
import { getDashboardSnapshot, getSettingsSnapshot } from "@/server/queries";

export default function OverviewPage() {
  const snapshot = getDashboardSnapshot();
  const settings = getSettingsSnapshot();

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Operations"
        title="任务平台总览"
        description="围绕任务运行、Finding、配置完整度和蓝图活跃度组织日常操作视图。"
        badges={[
          { label: `${snapshot.task_runs.length} 个运行实例`, variant: "accent" },
          { label: `${settings.metrics.runtimeBindingCount} 个执行引擎`, variant: "neutral" },
        ]}
      />

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {snapshot.metrics.map((metric) => (
          <MetricCard key={metric.label} {...metric} />
        ))}
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <Panel>
          <PanelHeader
            eyebrow="Runs"
            title="最近任务运行"
            description="按任务来源和状态快速定位当前正在执行、等待处理或失败的任务。"
          />
          <PanelBody className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {snapshot.taskExecutionDashboard.bySourceType.map((item) => (
                <div key={item.sourceType} className="rounded-xl border border-[var(--line)] bg-[var(--surface-muted)] p-4">
                  <div className="text-sm text-[var(--ink-muted)]">{translateSourceType(item.sourceType)}</div>
                  <div className="mt-2 text-2xl font-semibold text-[var(--ink)]">{item.taskRunCount}</div>
                  <div className="mt-1 text-sm text-[var(--ink-muted)]">活跃 {item.activeCount}</div>
                </div>
              ))}
            </div>

            <div className="overflow-hidden rounded-xl border border-[var(--line)]">
              <div className="grid grid-cols-[1.4fr_120px_160px] bg-[var(--surface-muted)] px-4 py-3 text-xs font-medium uppercase tracking-[0.14em] text-[var(--ink-muted)]">
                <div>任务来源</div>
                <div>状态</div>
                <div>时间</div>
              </div>
              <div className="divide-y divide-[var(--line)]">
                {snapshot.task_runs.slice(0, 6).map((taskRun) => (
                  <Link
                    key={taskRun.id}
                    href={`/task-runs/${taskRun.id}`}
                    className="grid grid-cols-1 gap-2 px-4 py-3 transition hover:bg-[var(--surface-muted)] md:grid-cols-[1.4fr_120px_160px] md:items-center"
                  >
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium text-[var(--ink)]">
                        {taskRun.sourceRef ?? taskRun.sourceType}
                      </div>
                      <div className="text-xs text-[var(--ink-muted)]">运行状态 {translateStatus(taskRun.runState)}</div>
                    </div>
                    <div>
                      <Badge variant={taskRun.status === "failed" ? "danger" : taskRun.status === "running" ? "accent" : "neutral"}>
                        {translateStatus(taskRun.status)}
                      </Badge>
                    </div>
                    <div className="text-sm text-[var(--ink-muted)]">{formatDateTime(taskRun.createdAt)}</div>
                  </Link>
                ))}
              </div>
            </div>
          </PanelBody>
        </Panel>

        <Panel>
          <PanelHeader
            eyebrow="Findings"
            title="Finding 聚合"
            description="观察当前问题分布和最近产出的结论。"
          />
          <PanelBody className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              {snapshot.findingDashboard.bySeverity.map((item) => (
                <div key={item.severity} className="rounded-xl border border-[var(--line)] bg-[var(--surface-muted)] p-4">
                  <div className="text-sm uppercase text-[var(--ink-muted)]">{item.severity}</div>
                  <div className="mt-2 text-2xl font-semibold text-[var(--ink)]">{item.count}</div>
                </div>
              ))}
            </div>
            <div className="space-y-3">
              {snapshot.findings.length === 0 ? (
                <div className="rounded-xl border border-dashed border-[var(--line)] px-4 py-6 text-sm text-[var(--ink-muted)]">
                  当前还没有 Finding 产出。
                </div>
              ) : (
                snapshot.findings.map((finding) => (
                  <div key={finding.id} className="rounded-xl border border-[var(--line)] bg-[var(--surface-muted)] px-4 py-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="text-sm font-medium text-[var(--ink)]">{finding.title}</div>
                      <Badge variant={finding.severity === "high" || finding.severity === "critical" ? "danger" : "neutral"}>
                        {finding.severity}
                      </Badge>
                    </div>
                    <div className="mt-1 text-sm text-[var(--ink-muted)]">{finding.description}</div>
                  </div>
                ))
              )}
            </div>
          </PanelBody>
        </Panel>
      </section>

      <section className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
        <Panel>
          <PanelHeader
            eyebrow="Readiness"
            title="配置完整度"
            description="从模型接口、执行引擎、蓝图和 Webhook 观察平台可运行程度。"
          />
          <PanelBody className="grid gap-3 sm:grid-cols-2">
            {[
              ["模型接口", `${settings.metrics.enabledProviderProfileCount}/${settings.metrics.providerProfileCount}`],
              ["执行引擎", `${settings.metrics.enabledRuntimeBindingCount}/${settings.metrics.runtimeBindingCount}`],
              ["任务蓝图", `${settings.metrics.enabledBlueprintCount}/${settings.metrics.blueprintCount}`],
              ["Webhook / 环境", `${settings.webhooks.length}/${settings.environments.length}`],
            ].map(([label, value]) => (
              <div key={label} className="rounded-xl border border-[var(--line)] bg-[var(--surface-muted)] p-4">
                <div className="text-sm text-[var(--ink-muted)]">{label}</div>
                <div className="mt-2 text-2xl font-semibold text-[var(--ink)]">{value}</div>
              </div>
            ))}
          </PanelBody>
        </Panel>

        <Panel>
          <PanelHeader
            eyebrow="Blueprints"
            title="蓝图与调度"
            description="直接进入任务蓝图，查看其触发器、运行次数和 Finding 产出。"
          />
          <PanelBody className="space-y-3">
            {snapshot.taskBlueprints.map((blueprint) => (
              <Link
                key={blueprint.id}
                href={`/task-blueprints/${blueprint.id}`}
                className="block rounded-xl border border-[var(--line)] bg-[var(--surface-muted)] px-4 py-4 transition hover:border-[var(--line-strong)] hover:bg-white"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-medium text-[var(--ink)]">{blueprint.name}</div>
                    <div className="mt-1 text-sm text-[var(--ink-muted)]">
                      {blueprint.category} · 运行 {blueprint.runCount} 次 · Finding {blueprint.findingCount}
                    </div>
                  </div>
                  <Badge variant={blueprint.status === "active" ? "success" : "neutral"}>
                    {translateStatus(blueprint.status)}
                  </Badge>
                </div>
              </Link>
            ))}
          </PanelBody>
        </Panel>
      </section>
    </div>
  );
}
