import { getDashboardSnapshot } from "@/server/queries";

export default function WorldsPage() {
  const snapshot = getDashboardSnapshot();

  return (
    <div className="space-y-4">
      {snapshot.worldSummaries.map((world) => (
        <section
          key={world.id}
          className="rounded-[28px] border border-[var(--line)] bg-[var(--surface-strong)] p-6"
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-[11px] font-medium uppercase tracking-[0.22em] text-[var(--ink-muted)]">
                World
              </div>
              <h3 className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-[var(--ink)]">
                {world.name}
              </h3>
            </div>
            <div className="text-[11px] uppercase tracking-[0.18em] text-[var(--ink-muted)]">
              {world.status}
            </div>
          </div>
          <div className="mt-5 grid gap-4 md:grid-cols-3">
            <div className="rounded-[24px] border border-[var(--line)] bg-[var(--surface)] p-4">
              <div className="text-sm text-[var(--ink-muted)]">Kingdom count</div>
              <div className="mt-2 text-2xl font-semibold text-[var(--ink)]">{world.kingdomCount}</div>
            </div>
            <div className="rounded-[24px] border border-[var(--line)] bg-[var(--surface)] p-4">
              <div className="text-sm text-[var(--ink-muted)]">Monthly quota</div>
              <div className="mt-2 text-2xl font-semibold text-[var(--ink)]">${world.monthlyUsd}</div>
            </div>
            <div className="rounded-[24px] border border-[var(--line)] bg-[var(--surface)] p-4">
              <div className="text-sm text-[var(--ink-muted)]">Max running quests</div>
              <div className="mt-2 text-2xl font-semibold text-[var(--ink)]">{world.maxRunningQuests}</div>
            </div>
          </div>
        </section>
      ))}
    </div>
  );
}
