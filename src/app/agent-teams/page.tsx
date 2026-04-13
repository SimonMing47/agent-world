import { getDashboardSnapshot } from "@/server/queries";

export default function AgentTeamsPage() {
  const snapshot = getDashboardSnapshot();

  return (
    <div className="space-y-4">
      {snapshot.teamSummaries.map((team) => (
        <section
          key={team.id}
          className="rounded-[28px] border border-[var(--line)] bg-[var(--surface-strong)] p-6"
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-[11px] font-medium uppercase tracking-[0.22em] text-[var(--ink-muted)]">
                AgentTeam
              </div>
              <h3 className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-[var(--ink)]">
                {team.name}
              </h3>
            </div>
            <div className="text-[11px] uppercase tracking-[0.18em] text-[var(--ink-muted)]">
              {team.visibility}
            </div>
          </div>
          <div className="mt-5 grid gap-4 md:grid-cols-4">
            <div className="rounded-[24px] border border-[var(--line)] bg-[var(--surface)] p-4">
              <div className="text-sm text-[var(--ink-muted)]">Workflow</div>
              <div className="mt-2 text-xl font-semibold text-[var(--ink)]">{team.workflowType}</div>
            </div>
            <div className="rounded-[24px] border border-[var(--line)] bg-[var(--surface)] p-4">
              <div className="text-sm text-[var(--ink-muted)]">Agent count</div>
              <div className="mt-2 text-xl font-semibold text-[var(--ink)]">{team.agentCount}</div>
            </div>
            <div className="rounded-[24px] border border-[var(--line)] bg-[var(--surface)] p-4">
              <div className="text-sm text-[var(--ink-muted)]">Timeout</div>
              <div className="mt-2 text-xl font-semibold text-[var(--ink)]">{team.timeoutMinutes}m</div>
            </div>
            <div className="rounded-[24px] border border-[var(--line)] bg-[var(--surface)] p-4">
              <div className="text-sm text-[var(--ink-muted)]">Success target</div>
              <div className="mt-2 text-xl font-semibold text-[var(--ink)]">
                {Math.round(team.successRateTarget * 100)}%
              </div>
            </div>
          </div>
        </section>
      ))}
    </div>
  );
}
