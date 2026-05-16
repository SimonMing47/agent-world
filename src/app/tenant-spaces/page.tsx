import { getDashboardSnapshot } from "@/server/queries";
import { translateStatus } from "@/lib/presentation";

export default function TenantSpacesPage() {
  const snapshot = getDashboardSnapshot();

  return (
    <div className="space-y-4">
      {snapshot.tenantSpaceSummaries.map((tenantSpace) => (
        <section
          key={tenantSpace.id}
          className="rounded-[28px] border border-[var(--line)] bg-[var(--surface-strong)] p-6"
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-[11px] font-medium uppercase tracking-[0.22em] text-[var(--ink-muted)]">
                租户空间
              </div>
              <h3 className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-[var(--ink)]">
                {tenantSpace.name}
              </h3>
            </div>
            <div className="text-[11px] uppercase tracking-[0.18em] text-[var(--ink-muted)]">
              {translateStatus(tenantSpace.status)}
            </div>
          </div>
          <div className="mt-5 grid gap-4 md:grid-cols-3">
            <div className="rounded-[24px] border border-[var(--line)] bg-[var(--surface)] p-4">
              <div className="text-sm text-[var(--ink-muted)]">业务团队数量</div>
              <div className="mt-2 text-2xl font-semibold text-[var(--ink)]">{tenantSpace.businessTeamCount}</div>
            </div>
            <div className="rounded-[24px] border border-[var(--line)] bg-[var(--surface)] p-4">
              <div className="text-sm text-[var(--ink-muted)]">月度预算上限</div>
              <div className="mt-2 text-2xl font-semibold text-[var(--ink)]">${tenantSpace.monthlyUsd}</div>
            </div>
            <div className="rounded-[24px] border border-[var(--line)] bg-[var(--surface)] p-4">
              <div className="text-sm text-[var(--ink-muted)]">最大并发任务</div>
              <div className="mt-2 text-2xl font-semibold text-[var(--ink)]">{tenantSpace.maxRunningTaskRuns}</div>
            </div>
          </div>
        </section>
      ))}
    </div>
  );
}
