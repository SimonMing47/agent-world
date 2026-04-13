import { MetricCard } from "@/components/metric-card";
import { formatDateTime } from "@/lib/utils";
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

      <section className="grid gap-6 xl:grid-cols-[1.35fr_0.95fr]">
        <div className="rounded-[28px] border border-[var(--line)] bg-[var(--surface-strong)] p-6">
          <div className="flex items-end justify-between gap-4">
            <div>
              <div className="text-[11px] font-medium uppercase tracking-[0.22em] text-[var(--ink-muted)]">
                Dispatch doctrine
              </div>
              <h3 className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-[var(--ink)]">
                Every run is routed through dispatch, harness, and invocation on purpose.
              </h3>
            </div>
            <div className="text-sm text-[var(--ink-muted)]">
              Next scheduled window ends {formatDateTime(snapshot.upcomingWindow)}
            </div>
          </div>
          <div className="mt-6 grid gap-4 md:grid-cols-3">
            {snapshot.dispatchPreviews.map((preview) => (
              <div
                key={preview.taskName}
                className="rounded-[24px] border border-[var(--line)] bg-[var(--surface)] p-4"
              >
                <div className="text-[11px] font-medium uppercase tracking-[0.22em] text-[var(--ink-muted)]">
                  {preview.teamSpace}
                </div>
                <div className="mt-2 text-lg font-semibold text-[var(--ink)]">
                  {preview.taskName}
                </div>
                <div className="mt-3 space-y-1 text-sm text-[var(--ink-muted)]">
                  <div>Priority score: {preview.priorityScore}</div>
                  <div>Selected runtime: {preview.selectedRuntimeName}</div>
                  <div>Runtime status: {preview.selectedRuntimeStatus}</div>
                  <div>Harness: {preview.harnessName}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-[28px] border border-[var(--line)] bg-[var(--surface-strong)] p-6">
          <div className="text-[11px] font-medium uppercase tracking-[0.22em] text-[var(--ink-muted)]">
            Team spaces
          </div>
          <div className="mt-4 space-y-3">
            {snapshot.teams.map((team) => (
              <div
                key={team.id}
                className="rounded-[24px] border border-[var(--line)] bg-[var(--surface)] px-4 py-4"
              >
                <div className="text-lg font-semibold text-[var(--ink)]">{team.name}</div>
                <p className="mt-1 text-sm leading-6 text-[var(--ink-muted)]">
                  {team.description}
                </p>
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
                Due work is visible before it becomes hidden queue debt.
              </h3>
            </div>
            <div className="text-sm text-[var(--ink-muted)]">
              Due now: {snapshot.dueTaskCount}
            </div>
          </div>
          <div className="mt-5 space-y-3">
            {snapshot.scheduleAssessments.map((assessment) => (
              <div
                key={assessment.taskId}
                className="rounded-[24px] border border-[var(--line)] bg-[var(--surface)] px-4 py-4"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="text-base font-semibold text-[var(--ink)]">
                      {assessment.taskName}
                    </div>
                    <p className="mt-1 text-sm leading-6 text-[var(--ink-muted)]">
                      {assessment.rationale}
                    </p>
                  </div>
                  <div className="text-[11px] font-medium uppercase tracking-[0.2em] text-[var(--ink-muted)]">
                    {assessment.state}
                  </div>
                </div>
                <div className="mt-3 text-sm text-[var(--ink-muted)]">
                  Next run: {assessment.nextRunAt ? formatDateTime(assessment.nextRunAt) : "Manual or webhook only"}
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
            Agent invocation is a controlled pipeline, not a blind prompt handoff.
          </h3>
          <div className="mt-5 space-y-3">
            {snapshot.invocationStages.map((stage, index) => (
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
        </div>
      </section>
    </div>
  );
}
