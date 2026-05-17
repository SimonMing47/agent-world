import { formatDateTime } from "@/lib/utils";
import { localizeDemoCopy, translateSeverity, translateSourceType, translateStatus, translateWorkflowType } from "@/lib/presentation";
import { getWallboardSnapshot } from "@/server/queries";

export default function WallboardPage() {
  const snapshot = getWallboardSnapshot();

  return (
    <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
      <section className="space-y-4">
        <div className="rounded-lg border border-[var(--line)] bg-[var(--surface-strong)] p-6">
          <div className="text-xs font-medium text-[var(--ink-muted)]">
            ui.generated.c56a2fa282b
          </div>
          <div className="mt-4 space-y-3">
            {snapshot.activeTaskRuns.map((taskRun) => (
              <div
                key={taskRun.id}
                className="rounded-md border border-[var(--line)] bg-[var(--surface)] px-4 py-4"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="text-base font-semibold text-[var(--ink)]">
                    {taskRun.sourceRef ?? taskRun.sourceType}
                  </div>
                  <div className="text-xs font-medium text-[var(--ink-muted)]">
                    {translateStatus(taskRun.status)}
                  </div>
                </div>
                <div className="mt-2 text-sm text-[var(--ink-muted)]">
                  ui.generated.c3c75f3646a {taskRun.requestedBy} · {formatDateTime(taskRun.createdAt)}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-lg border border-[var(--line)] bg-[var(--surface-strong)] p-6">
          <div className="text-xs font-medium text-[var(--ink-muted)]">
            ui.generated.cd4c11371e2
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {snapshot.runtimes.map((runtime) => (
              <div
                key={runtime.id}
                className="rounded-md border border-[var(--line)] bg-[var(--surface)] p-4"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="text-base font-semibold text-[var(--ink)]">{runtime.name}</div>
                  <div className="text-xs font-medium text-[var(--ink-muted)]">
                    {translateStatus(runtime.healthStatus)}
                  </div>
                </div>
                <div className="mt-2 text-sm text-[var(--ink-muted)]">
                  {runtime.activeRunCount} ui.generated.c0e8d5d0351 {runtime.concurrencyLimit} ui.generated.c0188a1d615
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-lg border border-[var(--line)] bg-[var(--surface-strong)] p-6">
          <div className="text-xs font-medium text-[var(--ink-muted)]">
            ui.generated.c3c943b28b2
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-4">
            {snapshot.taskExecutionDashboard.bySourceType.map((item) => (
              <div key={item.sourceType} className="rounded-md border border-[var(--line)] bg-[var(--surface)] p-4">
                <div className="text-sm text-[var(--ink-muted)]">{translateSourceType(item.sourceType)}</div>
                <div className="mt-2 text-xl font-semibold text-[var(--ink)]">{item.taskRunCount}</div>
                <div className="mt-1 text-xs text-[var(--ink-muted)]">ui.generated.c8c0daf7f81 {item.activeCount}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-lg border border-[var(--line)] bg-[var(--surface-strong)] p-6">
          <div className="text-xs font-medium text-[var(--ink-muted)]">
            ui.generated.ce1eb870c31
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-5">
            {snapshot.findingDashboard.bySeverity.map((item) => (
              <div key={item.severity} className="rounded-md border border-[var(--line)] bg-[var(--surface)] p-4">
                <div className="text-sm text-[var(--ink-muted)]">{translateSeverity(item.severity)}</div>
                <div className="mt-2 text-xl font-semibold text-[var(--ink)]">{item.count}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <div className="rounded-lg border border-[var(--line)] bg-[var(--surface-strong)] p-6">
          <div className="text-xs font-medium text-[var(--ink-muted)]">
            ui.generated.cc8fd36b938
          </div>
          <div className="mt-4 space-y-3">
            {snapshot.topTeams.map((team) => (
              <div
                key={team.id}
                className="rounded-md border border-[var(--line)] bg-[var(--surface)] px-4 py-4"
              >
                <div className="text-base font-semibold text-[var(--ink)]">{team.name}</div>
                <div className="mt-2 text-sm text-[var(--ink-muted)]">
                  {translateWorkflowType(team.workflowType)} · {team.agentCount} ui.generated.ce2481c87f2 {Math.round(team.successRateTarget * 100)}%
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-lg border border-[var(--line)] bg-[var(--surface-strong)] p-6">
          <div className="text-xs font-medium text-[var(--ink-muted)]">
            ui.generated.cacce24c07a
          </div>
          <div className="mt-4 space-y-3">
            {snapshot.topRepositories.map((repository) => (
              <div
                key={repository.id}
                className="rounded-md border border-[var(--line)] bg-[var(--surface)] px-4 py-4"
              >
                <div className="text-base font-semibold text-[var(--ink)]">{repository.name}</div>
                <div className="mt-2 text-sm text-[var(--ink-muted)]">
                  {repository.provider} · {repository.branch} ui.generated.c89fa5ee6d9 {repository.lastTaskRunCount} ui.generated.cc5680a85b1
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-lg border border-[var(--line)] bg-[var(--surface-strong)] p-6">
          <div className="text-xs font-medium text-[var(--ink-muted)]">
            ui.generated.c52ad88f273
          </div>
          <div className="mt-4 space-y-3">
            {snapshot.topDevelopers.map((developer) => (
              <div
                key={developer.id}
                className="rounded-md border border-[var(--line)] bg-[var(--surface)] px-4 py-4"
              >
                <div className="text-base font-semibold text-[var(--ink)]">{developer.name}</div>
                <div className="mt-2 text-sm text-[var(--ink-muted)]">
                  {localizeDemoCopy(developer.focus)} ui.generated.c2f29355d6e {formatDateTime(developer.lastActiveAt)}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
