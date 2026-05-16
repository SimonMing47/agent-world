import Link from "next/link";
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
      <section className="grid gap-4 md:grid-cols-4">
        <div className="rounded-[28px] border border-[var(--line)] bg-[var(--surface-strong)] p-5">
          <div className="text-sm text-[var(--ink-muted)]">任务蓝图</div>
          <div className="mt-2 text-3xl font-semibold text-[var(--ink)]">{snapshot.blueprints.length}</div>
        </div>
        <div className="rounded-[28px] border border-[var(--line)] bg-[var(--surface-strong)] p-5">
          <div className="text-sm text-[var(--ink-muted)]">Finding 总数</div>
          <div className="mt-2 text-3xl font-semibold text-[var(--ink)]">{snapshot.findingDashboard.total}</div>
        </div>
        <div className="rounded-[28px] border border-[var(--line)] bg-[var(--surface-strong)] p-5">
          <div className="text-sm text-[var(--ink-muted)]">高危及以上</div>
          <div className="mt-2 text-3xl font-semibold text-[var(--ink)]">
            {snapshot.findingDashboard.bySeverity
              .filter((item) => ["critical", "high"].includes(item.severity))
              .reduce((sum, item) => sum + item.count, 0)}
          </div>
        </div>
        <div className="rounded-[28px] border border-[var(--line)] bg-[var(--surface-strong)] p-5">
          <div className="text-sm text-[var(--ink-muted)]">Provider Adapter</div>
          <div className="mt-2 text-3xl font-semibold text-[var(--ink)]">{snapshot.providerAdapters.length}</div>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        {snapshot.blueprints.map((blueprint) => (
          <Link
            key={blueprint.id}
            href={`/task-blueprints/${blueprint.id}`}
            className="block rounded-[28px] border border-[var(--line)] bg-[var(--surface-strong)] p-6 transition hover:bg-[var(--surface)]"
          >
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="text-[11px] font-medium uppercase tracking-[0.22em] text-[var(--ink-muted)]">
                  {blueprint.category} · v{blueprint.version}
                </div>
                <h3 className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-[var(--ink)]">
                  {blueprint.name}
                </h3>
              </div>
              <div className="text-right text-[11px] uppercase tracking-[0.18em] text-[var(--ink-muted)]">
                <div>{translateStatus(blueprint.status)}</div>
                <div className="mt-1">{translateVisibility(blueprint.visibility)}</div>
              </div>
            </div>
            <div className="mt-5 grid gap-3 text-sm text-[var(--ink-muted)] md:grid-cols-2">
              <div>业务团队: {blueprint.businessTeamName}</div>
              <div>Agent 团队: {blueprint.agentTeamName}</div>
              <div>触发器: {triggerLabel(blueprint.trigger)}</div>
              <div>Provider: {blueprint.providerName}</div>
              <div>运行次数: {blueprint.runCount}</div>
              <div>Finding: {blueprint.findingCount} / 高危 {blueprint.criticalOrHighFindingCount}</div>
            </div>
            <div className="mt-4 flex flex-wrap gap-2 text-xs text-[var(--ink-muted)]">
              {blueprint.publishers.map((publisher, index) => {
                const record = publisher as Record<string, unknown>;
                return (
                  <span key={`${blueprint.id}-${index}`} className="rounded-full border border-[var(--line)] px-3 py-1">
                    {String(record.type ?? "publisher")}
                  </span>
                );
              })}
            </div>
          </Link>
        ))}
      </section>
    </div>
  );
}
