import { formatDateTime } from "@/lib/utils";
import { getWallboardSnapshot } from "@/server/queries";

export default function WallboardPage() {
  const snapshot = getWallboardSnapshot();

  return (
    <div className="space-y-6">
      <section className="rounded-[28px] border border-[var(--line)] bg-[var(--surface-strong)] p-6">
        <div className="text-[11px] font-medium uppercase tracking-[0.22em] text-[var(--ink-muted)]">
          Wallboard
        </div>
        <h3 className="mt-2 text-3xl font-semibold tracking-[-0.04em] text-[var(--ink)]">
          See the whole operating picture without opening every run.
        </h3>
      </section>

      <section className="grid gap-4 xl:grid-cols-4">
        <div className="rounded-[24px] border border-[var(--line)] bg-[var(--surface-strong)] p-5">
          <div className="text-[11px] uppercase tracking-[0.22em] text-[var(--ink-muted)]">
            Active runs
          </div>
          <div className="mt-3 text-4xl font-semibold tracking-[-0.05em] text-[var(--ink)]">
            {snapshot.running.length}
          </div>
        </div>
        <div className="rounded-[24px] border border-[var(--line)] bg-[var(--surface-strong)] p-5">
          <div className="text-[11px] uppercase tracking-[0.22em] text-[var(--ink-muted)]">
            Upcoming schedules
          </div>
          <div className="mt-3 text-4xl font-semibold tracking-[-0.05em] text-[var(--ink)]">
            {snapshot.upcoming.length}
          </div>
        </div>
        <div className="rounded-[24px] border border-[var(--line)] bg-[var(--surface-strong)] p-5">
          <div className="text-[11px] uppercase tracking-[0.22em] text-[var(--ink-muted)]">
            Active agents
          </div>
          <div className="mt-3 text-4xl font-semibold tracking-[-0.05em] text-[var(--ink)]">
            {snapshot.topAgents.length}
          </div>
        </div>
        <div className="rounded-[24px] border border-[var(--line)] bg-[var(--surface-strong)] p-5">
          <div className="text-[11px] uppercase tracking-[0.22em] text-[var(--ink-muted)]">
            Active developers
          </div>
          <div className="mt-3 text-4xl font-semibold tracking-[-0.05em] text-[var(--ink)]">
            {snapshot.topDevelopers.length}
          </div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-3">
        <div className="rounded-[28px] border border-[var(--line)] bg-[var(--surface-strong)] p-6">
          <div className="text-[11px] uppercase tracking-[0.22em] text-[var(--ink-muted)]">
            Running now
          </div>
          <div className="mt-4 space-y-3">
            {snapshot.running.map((run) => (
              <div key={run.id} className="rounded-[20px] border border-[var(--line)] bg-[var(--surface)] p-4">
                <div className="text-sm font-medium text-[var(--ink)]">{run.summary}</div>
                <div className="mt-1 text-sm text-[var(--ink-muted)]">{run.dispatchState}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-[28px] border border-[var(--line)] bg-[var(--surface-strong)] p-6">
          <div className="text-[11px] uppercase tracking-[0.22em] text-[var(--ink-muted)]">
            Top repositories
          </div>
          <div className="mt-4 space-y-3">
            {snapshot.topRepositories.map((repository) => (
              <div key={repository.id} className="rounded-[20px] border border-[var(--line)] bg-[var(--surface)] p-4">
                <div className="text-sm font-medium text-[var(--ink)]">{repository.name}</div>
                <div className="mt-1 text-sm text-[var(--ink-muted)]">
                  Branch {repository.branch} · score {repository.activityScore}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-[28px] border border-[var(--line)] bg-[var(--surface-strong)] p-6">
          <div className="text-[11px] uppercase tracking-[0.22em] text-[var(--ink-muted)]">
            Runtime health
          </div>
          <div className="mt-4 space-y-3">
            {snapshot.runtimes.map((runtime) => (
              <div key={runtime.id} className="rounded-[20px] border border-[var(--line)] bg-[var(--surface)] p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-sm font-medium text-[var(--ink)]">{runtime.name}</div>
                  <div className="text-xs uppercase tracking-[0.18em] text-[var(--ink-muted)]">
                    {runtime.healthStatus}
                  </div>
                </div>
                <div className="mt-1 text-sm text-[var(--ink-muted)]">
                  Last refresh {formatDateTime(runtime.lastDiscoveredAt)}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
