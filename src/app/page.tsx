import Link from "next/link";
import { MetricCard } from "@/components/metric-card";
import { translateSourceType, translateStatus } from "@/lib/presentation";
import { formatDateTime } from "@/lib/utils";
import { getDashboardSnapshot, getSettingsSnapshot } from "@/server/queries";

export default function OverviewPage() {
  const snapshot = getDashboardSnapshot();
  const settings = getSettingsSnapshot();

  return (
    <div className="space-y-8">
      <section className="grid gap-4 xl:grid-cols-4">
        {snapshot.metrics.map((metric) => (
          <MetricCard key={metric.label} {...metric} />
        ))}
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-[28px] border border-[var(--line)] bg-[var(--surface-strong)] p-6">
          <div className="text-[11px] font-medium uppercase tracking-[0.22em] text-[var(--ink-muted)]">
            任务运行
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-4">
            {snapshot.taskExecutionDashboard.bySourceType.map((item) => (
              <div key={item.sourceType} className="rounded-[24px] border border-[var(--line)] bg-[var(--surface)] p-4">
                <div className="text-sm text-[var(--ink-muted)]">{translateSourceType(item.sourceType)}</div>
                <div className="mt-2 text-2xl font-semibold text-[var(--ink)]">{item.taskRunCount}</div>
                <div className="mt-1 text-sm text-[var(--ink-muted)]">活跃 {item.activeCount}</div>
              </div>
            ))}
          </div>
          <div className="mt-5 space-y-3">
            {snapshot.task_runs.slice(0, 5).map((taskRun) => (
              <Link
                key={taskRun.id}
                href={`/task-runs/${taskRun.id}`}
                className="block rounded-[24px] border border-[var(--line)] bg-[var(--surface)] px-4 py-4 transition hover:bg-[var(--canvas)]"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="text-base font-semibold text-[var(--ink)]">{taskRun.sourceRef ?? taskRun.sourceType}</div>
                  <div className="text-[11px] uppercase tracking-[0.18em] text-[var(--ink-muted)]">{translateStatus(taskRun.status)}</div>
                </div>
                <div className="mt-2 text-sm text-[var(--ink-muted)]">
                  {formatDateTime(taskRun.createdAt)} · 运行状态 {translateStatus(taskRun.runState)}
                </div>
              </Link>
            ))}
          </div>
        </div>

        <div className="rounded-[28px] border border-[var(--line)] bg-[var(--surface-strong)] p-6">
          <div className="text-[11px] font-medium uppercase tracking-[0.22em] text-[var(--ink-muted)]">
            Finding 聚合
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {snapshot.findingDashboard.bySeverity.map((item) => (
              <div key={item.severity} className="rounded-[24px] border border-[var(--line)] bg-[var(--surface)] p-4">
                <div className="text-sm uppercase text-[var(--ink-muted)]">{item.severity}</div>
                <div className="mt-2 text-2xl font-semibold text-[var(--ink)]">{item.count}</div>
              </div>
            ))}
          </div>
          <div className="mt-5 space-y-3">
            {snapshot.findings.length === 0 ? (
              <div className="rounded-[24px] border border-[var(--line)] bg-[var(--surface)] px-4 py-4 text-sm text-[var(--ink-muted)]">
                当前还没有 Finding 产出。
              </div>
            ) : (
              snapshot.findings.map((finding) => (
                <div key={finding.id} className="rounded-[24px] border border-[var(--line)] bg-[var(--surface)] px-4 py-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-base font-semibold text-[var(--ink)]">{finding.title}</div>
                    <div className="text-[11px] uppercase tracking-[0.18em] text-[var(--ink-muted)]">
                      {finding.severity} · {finding.category}
                    </div>
                  </div>
                  <div className="mt-2 text-sm text-[var(--ink-muted)]">{finding.description}</div>
                </div>
              ))
            )}
          </div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <div className="rounded-[28px] border border-[var(--line)] bg-[var(--surface-strong)] p-6">
          <div className="text-[11px] font-medium uppercase tracking-[0.22em] text-[var(--ink-muted)]">
            配置完整度
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <div className="rounded-[24px] border border-[var(--line)] bg-[var(--surface)] p-4">
              <div className="text-sm text-[var(--ink-muted)]">模型接口</div>
              <div className="mt-2 text-2xl font-semibold text-[var(--ink)]">
                {settings.metrics.enabledProviderProfileCount}/{settings.metrics.providerProfileCount}
              </div>
            </div>
            <div className="rounded-[24px] border border-[var(--line)] bg-[var(--surface)] p-4">
              <div className="text-sm text-[var(--ink-muted)]">执行引擎</div>
              <div className="mt-2 text-2xl font-semibold text-[var(--ink)]">
                {settings.metrics.enabledRuntimeBindingCount}/{settings.metrics.runtimeBindingCount}
              </div>
            </div>
            <div className="rounded-[24px] border border-[var(--line)] bg-[var(--surface)] p-4">
              <div className="text-sm text-[var(--ink-muted)]">任务蓝图</div>
              <div className="mt-2 text-2xl font-semibold text-[var(--ink)]">
                {settings.metrics.enabledBlueprintCount}/{settings.metrics.blueprintCount}
              </div>
            </div>
            <div className="rounded-[24px] border border-[var(--line)] bg-[var(--surface)] p-4">
              <div className="text-sm text-[var(--ink-muted)]">Webhook / 环境</div>
              <div className="mt-2 text-2xl font-semibold text-[var(--ink)]">
                {settings.webhooks.length}/{settings.environments.length}
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-[28px] border border-[var(--line)] bg-[var(--surface-strong)] p-6">
          <div className="text-[11px] font-medium uppercase tracking-[0.22em] text-[var(--ink-muted)]">
            蓝图与调度
          </div>
          <div className="mt-4 space-y-3">
            {snapshot.taskBlueprints.map((blueprint) => (
              <Link
                key={blueprint.id}
                href={`/task-blueprints/${blueprint.id}`}
                className="block rounded-[24px] border border-[var(--line)] bg-[var(--surface)] px-4 py-4 transition hover:bg-[var(--canvas)]"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="text-base font-semibold text-[var(--ink)]">{blueprint.name}</div>
                  <div className="text-[11px] uppercase tracking-[0.18em] text-[var(--ink-muted)]">
                    {translateStatus(blueprint.status)}
                  </div>
                </div>
                <div className="mt-2 text-sm text-[var(--ink-muted)]">
                  {blueprint.category} · 运行 {blueprint.runCount} 次 · Finding {blueprint.findingCount}
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
