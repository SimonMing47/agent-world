import { MetricCard } from "@/components/metric-card";
import { formatDateTime, formatPercent } from "@/lib/utils";
import { getDashboardSnapshot } from "@/server/queries";

export default function OverviewPage() {
  const snapshot = getDashboardSnapshot();

  return (
    <div className="space-y-8">
      <section className="grid gap-4 xl:grid-cols-4">
        {snapshot.metrics.map((metric) => (
          <MetricCard key={metric.label} {...metric} />
        ))}
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <div className="rounded-[28px] border border-[var(--line)] bg-[var(--surface-strong)] p-6">
          <div className="flex items-end justify-between gap-4">
            <div>
              <div className="text-[11px] font-medium uppercase tracking-[0.22em] text-[var(--ink-muted)]">
                World governance
              </div>
              <h3 className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-[var(--ink)]">
                World policy sets the outer boundary. Kingdoms and teams tighten it from there.
              </h3>
            </div>
            <div className="text-sm text-[var(--ink-muted)]">
              Next scheduling window ends {formatDateTime(snapshot.upcomingWindow)}
            </div>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-2">
            {snapshot.worldSummaries.map((world) => (
              <div
                key={world.id}
                className="rounded-[24px] border border-[var(--line)] bg-[var(--surface)] p-4"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="text-lg font-semibold text-[var(--ink)]">{world.name}</div>
                  <div className="text-[11px] uppercase tracking-[0.18em] text-[var(--ink-muted)]">
                    {world.status}
                  </div>
                </div>
                <div className="mt-3 space-y-1 text-sm text-[var(--ink-muted)]">
                  <div>Kingdoms: {world.kingdomCount}</div>
                  <div>Monthly quota: ${world.monthlyUsd}</div>
                  <div>Max running quests: {world.maxRunningQuests}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-[28px] border border-[var(--line)] bg-[var(--surface-strong)] p-6">
          <div className="text-[11px] font-medium uppercase tracking-[0.22em] text-[var(--ink-muted)]">
            Kingdom finances
          </div>
          <div className="mt-4 space-y-3">
            {snapshot.kingdomSummaries.map((kingdom) => (
              <div
                key={kingdom.id}
                className="rounded-[24px] border border-[var(--line)] bg-[var(--surface)] px-4 py-4"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="text-lg font-semibold text-[var(--ink)]">{kingdom.name}</div>
                  <div className="text-[11px] uppercase tracking-[0.18em] text-[var(--ink-muted)]">
                    {kingdom.status}
                  </div>
                </div>
                <div className="mt-2 space-y-1 text-sm text-[var(--ink-muted)]">
                  <div>Balance: ${kingdom.balance}</div>
                  <div>Credit limit: ${kingdom.creditLimit}</div>
                  <div>Tool refs: {kingdom.toolRefCount}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <div className="rounded-[28px] border border-[var(--line)] bg-[var(--surface-strong)] p-6">
          <div className="flex items-end justify-between gap-4">
            <div>
              <div className="text-[11px] font-medium uppercase tracking-[0.22em] text-[var(--ink-muted)]">
                Scheduler
              </div>
              <h3 className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-[var(--ink)]">
                Due schedules and Quest priority stay visible before they turn into queue debt.
              </h3>
            </div>
            <div className="text-sm text-[var(--ink-muted)]">
              Due now: {snapshot.dueScheduleCount}
            </div>
          </div>
          <div className="mt-5 space-y-3">
            {snapshot.scheduleAssessments.map((assessment) => (
              <div
                key={assessment.templateId}
                className="rounded-[24px] border border-[var(--line)] bg-[var(--surface)] px-4 py-4"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="text-base font-semibold text-[var(--ink)]">
                      {assessment.name}
                    </div>
                    <p className="mt-1 text-sm leading-6 text-[var(--ink-muted)]">
                      {assessment.rationale}
                    </p>
                  </div>
                  <div className="text-[11px] font-medium uppercase tracking-[0.18em] text-[var(--ink-muted)]">
                    {assessment.state}
                  </div>
                </div>
                <div className="mt-2 text-sm text-[var(--ink-muted)]">
                  {assessment.cadence}
                  {assessment.nextRunAt ? ` · Next run ${formatDateTime(assessment.nextRunAt)}` : ""}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-[28px] border border-[var(--line)] bg-[var(--surface-strong)] p-6">
          <div className="text-[11px] font-medium uppercase tracking-[0.22em] text-[var(--ink-muted)]">
            Invocation chain
          </div>
          <h3 className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-[var(--ink)]">
            Agent invocation is a governed pipeline, not a blind prompt handoff.
          </h3>
          <p className="mt-3 text-sm leading-6 text-[var(--ink-muted)]">
            {snapshot.featuredPlanningMode}
          </p>
          <div className="mt-5 space-y-3">
            {snapshot.featuredInvocation.map((stage, index) => (
              <div
                key={stage.key}
                className="grid gap-3 rounded-[24px] border border-[var(--line)] bg-[var(--surface)] px-4 py-4 md:grid-cols-[auto_1fr]"
              >
                <div className="flex h-9 w-9 items-center justify-center rounded-full border border-[var(--line)] bg-[var(--canvas)] text-sm font-semibold text-[var(--ink)]">
                  {index + 1}
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="text-base font-semibold text-[var(--ink)]">
                      {stage.label}
                    </div>
                    <div className="text-[11px] font-medium uppercase tracking-[0.18em] text-[var(--ink-muted)]">
                      {stage.owner}
                    </div>
                  </div>
                  <p className="mt-1 text-sm leading-6 text-[var(--ink-muted)]">
                    {stage.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-4 rounded-[24px] border border-[var(--line)] bg-[var(--surface)] p-4">
            <div className="text-[11px] font-medium uppercase tracking-[0.22em] text-[var(--ink-muted)]">
              Provider rationale
            </div>
            <div className="mt-2 space-y-1 text-sm text-[var(--ink-muted)]">
              {snapshot.featuredProviderRationale.map((line) => (
                <div key={line}>{line}</div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <div className="rounded-[28px] border border-[var(--line)] bg-[var(--surface-strong)] p-6">
          <div className="text-[11px] font-medium uppercase tracking-[0.22em] text-[var(--ink-muted)]">
            Tavern
          </div>
          <div className="mt-4 space-y-3">
            {snapshot.tavernResumes.map((listing) => (
              <div
                key={listing.id}
                className="rounded-[24px] border border-[var(--line)] bg-[var(--surface)] p-4"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="text-lg font-semibold text-[var(--ink)]">{listing.teamName}</div>
                  <div className="text-[11px] uppercase tracking-[0.18em] text-[var(--ink-muted)]">
                    {listing.recruitmentMode}
                  </div>
                </div>
                <div className="mt-2 space-y-1 text-sm text-[var(--ink-muted)]">
                  <div>Success rate: {formatPercent(listing.resume.successRate ?? 0)}</div>
                  <div>Avg latency: {Math.round((listing.resume.avgLatencyMs ?? 0) / 1000)}s</div>
                  <div>Avg cost: ${listing.resume.avgCostUsd ?? 0}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-[28px] border border-[var(--line)] bg-[var(--surface-strong)] p-6">
          <div className="text-[11px] font-medium uppercase tracking-[0.22em] text-[var(--ink-muted)]">
            Quest priority board
          </div>
          <div className="mt-4 space-y-3">
            {snapshot.questPriorityBoard.map((item) => {
              const quest = snapshot.quests.find((candidate) => candidate.id === item.questId);

              return (
                <div
                  key={item.questId}
                  className="rounded-[24px] border border-[var(--line)] bg-[var(--surface)] px-4 py-4"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-base font-semibold text-[var(--ink)]">
                      {quest?.sourceRef ?? quest?.sourceType ?? "Quest"}
                    </div>
                    <div className="text-sm font-medium text-[var(--ink)]">
                      {item.effectivePriority}
                    </div>
                  </div>
                  <div className="mt-2 space-y-1 text-sm text-[var(--ink-muted)]">
                    {item.rationale.map((line) => (
                      <div key={line}>{line}</div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>
    </div>
  );
}
