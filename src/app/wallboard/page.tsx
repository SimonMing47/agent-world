import { formatDateTime } from "@/lib/utils";
import { getWallboardSnapshot } from "@/server/queries";

export default function WallboardPage() {
  const snapshot = getWallboardSnapshot();

  return (
    <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
      <section className="space-y-4">
        <div className="rounded-[28px] border border-[var(--line)] bg-[var(--surface-strong)] p-6">
          <div className="text-[11px] font-medium uppercase tracking-[0.22em] text-[var(--ink-muted)]">
            Active quests
          </div>
          <div className="mt-4 space-y-3">
            {snapshot.activeQuests.map((quest) => (
              <div
                key={quest.id}
                className="rounded-[24px] border border-[var(--line)] bg-[var(--surface)] px-4 py-4"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="text-base font-semibold text-[var(--ink)]">
                    {quest.sourceRef ?? quest.sourceType}
                  </div>
                  <div className="text-[11px] uppercase tracking-[0.18em] text-[var(--ink-muted)]">
                    {quest.status}
                  </div>
                </div>
                <div className="mt-2 text-sm text-[var(--ink-muted)]">
                  Requested by {quest.requestedBy} · {formatDateTime(quest.createdAt)}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-[28px] border border-[var(--line)] bg-[var(--surface-strong)] p-6">
          <div className="text-[11px] font-medium uppercase tracking-[0.22em] text-[var(--ink-muted)]">
            Runtime health
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {snapshot.runtimes.map((runtime) => (
              <div
                key={runtime.id}
                className="rounded-[24px] border border-[var(--line)] bg-[var(--surface)] p-4"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="text-base font-semibold text-[var(--ink)]">{runtime.name}</div>
                  <div className="text-[11px] uppercase tracking-[0.18em] text-[var(--ink-muted)]">
                    {runtime.healthStatus}
                  </div>
                </div>
                <div className="mt-2 text-sm text-[var(--ink-muted)]">
                  {runtime.activeRunCount} active / {runtime.concurrencyLimit} slots
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <div className="rounded-[28px] border border-[var(--line)] bg-[var(--surface-strong)] p-6">
          <div className="text-[11px] font-medium uppercase tracking-[0.22em] text-[var(--ink-muted)]">
            Top teams
          </div>
          <div className="mt-4 space-y-3">
            {snapshot.topTeams.map((team) => (
              <div
                key={team.id}
                className="rounded-[24px] border border-[var(--line)] bg-[var(--surface)] px-4 py-4"
              >
                <div className="text-base font-semibold text-[var(--ink)]">{team.name}</div>
                <div className="mt-2 text-sm text-[var(--ink-muted)]">
                  {team.workflowType} · {team.agentCount} agents · {Math.round(team.successRateTarget * 100)}% target
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-[28px] border border-[var(--line)] bg-[var(--surface-strong)] p-6">
          <div className="text-[11px] font-medium uppercase tracking-[0.22em] text-[var(--ink-muted)]">
            Active repositories
          </div>
          <div className="mt-4 space-y-3">
            {snapshot.topRepositories.map((repository) => (
              <div
                key={repository.id}
                className="rounded-[24px] border border-[var(--line)] bg-[var(--surface)] px-4 py-4"
              >
                <div className="text-base font-semibold text-[var(--ink)]">{repository.name}</div>
                <div className="mt-2 text-sm text-[var(--ink-muted)]">
                  {repository.provider} · {repository.branch} · {repository.lastQuestCount} recent quests
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-[28px] border border-[var(--line)] bg-[var(--surface-strong)] p-6">
          <div className="text-[11px] font-medium uppercase tracking-[0.22em] text-[var(--ink-muted)]">
            Active developers
          </div>
          <div className="mt-4 space-y-3">
            {snapshot.topDevelopers.map((developer) => (
              <div
                key={developer.id}
                className="rounded-[24px] border border-[var(--line)] bg-[var(--surface)] px-4 py-4"
              >
                <div className="text-base font-semibold text-[var(--ink)]">{developer.name}</div>
                <div className="mt-2 text-sm text-[var(--ink-muted)]">
                  {developer.focus} · last active {formatDateTime(developer.lastActiveAt)}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
