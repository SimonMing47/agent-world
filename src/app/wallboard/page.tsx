import { formatDateTime } from "@/lib/utils";
import { localizeDemoCopy, translateSourceType, translateStatus, translateWorkflowType } from "@/lib/presentation";
import { getWallboardSnapshot } from "@/server/queries";

export default function WallboardPage() {
  const snapshot = getWallboardSnapshot();

  return (
    <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
      <section className="space-y-4">
        <div className="rounded-[28px] border border-[var(--line)] bg-[var(--surface-strong)] p-6">
          <div className="text-[11px] font-medium uppercase tracking-[0.22em] text-[var(--ink-muted)]">
            活跃 Quest
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
                    {translateStatus(quest.status)}
                  </div>
                </div>
                <div className="mt-2 text-sm text-[var(--ink-muted)]">
                  提交人 {quest.requestedBy} · {formatDateTime(quest.createdAt)}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-[28px] border border-[var(--line)] bg-[var(--surface-strong)] p-6">
          <div className="text-[11px] font-medium uppercase tracking-[0.22em] text-[var(--ink-muted)]">
            Runtime 健康度
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
                    {translateStatus(runtime.healthStatus)}
                  </div>
                </div>
                <div className="mt-2 text-sm text-[var(--ink-muted)]">
                  {runtime.activeRunCount} 个活跃运行 / {runtime.concurrencyLimit} 个槽位
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-[28px] border border-[var(--line)] bg-[var(--surface-strong)] p-6">
          <div className="text-[11px] font-medium uppercase tracking-[0.22em] text-[var(--ink-muted)]">
            任务类别
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-4">
            {snapshot.taskExecutionDashboard.bySourceType.map((item) => (
              <div key={item.sourceType} className="rounded-[24px] border border-[var(--line)] bg-[var(--surface)] p-4">
                <div className="text-sm text-[var(--ink-muted)]">{translateSourceType(item.sourceType)}</div>
                <div className="mt-2 text-xl font-semibold text-[var(--ink)]">{item.questCount}</div>
                <div className="mt-1 text-xs text-[var(--ink-muted)]">活跃 {item.activeCount}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <div className="rounded-[28px] border border-[var(--line)] bg-[var(--surface-strong)] p-6">
          <div className="text-[11px] font-medium uppercase tracking-[0.22em] text-[var(--ink-muted)]">
            核心 AgentTeam
          </div>
          <div className="mt-4 space-y-3">
            {snapshot.topTeams.map((team) => (
              <div
                key={team.id}
                className="rounded-[24px] border border-[var(--line)] bg-[var(--surface)] px-4 py-4"
              >
                <div className="text-base font-semibold text-[var(--ink)]">{team.name}</div>
                <div className="mt-2 text-sm text-[var(--ink-muted)]">
                  {translateWorkflowType(team.workflowType)} · {team.agentCount} 个 Agent · 成功率目标 {Math.round(team.successRateTarget * 100)}%
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-[28px] border border-[var(--line)] bg-[var(--surface-strong)] p-6">
          <div className="text-[11px] font-medium uppercase tracking-[0.22em] text-[var(--ink-muted)]">
            活跃代码仓
          </div>
          <div className="mt-4 space-y-3">
            {snapshot.topRepositories.map((repository) => (
              <div
                key={repository.id}
                className="rounded-[24px] border border-[var(--line)] bg-[var(--surface)] px-4 py-4"
              >
                <div className="text-base font-semibold text-[var(--ink)]">{repository.name}</div>
                <div className="mt-2 text-sm text-[var(--ink-muted)]">
                  {repository.provider} · {repository.branch} · 最近 {repository.lastQuestCount} 个 Quest
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-[28px] border border-[var(--line)] bg-[var(--surface-strong)] p-6">
          <div className="text-[11px] font-medium uppercase tracking-[0.22em] text-[var(--ink-muted)]">
            活跃开发者
          </div>
          <div className="mt-4 space-y-3">
            {snapshot.topDevelopers.map((developer) => (
              <div
                key={developer.id}
                className="rounded-[24px] border border-[var(--line)] bg-[var(--surface)] px-4 py-4"
              >
                <div className="text-base font-semibold text-[var(--ink)]">{developer.name}</div>
                <div className="mt-2 text-sm text-[var(--ink-muted)]">
                  {localizeDemoCopy(developer.focus)} · 最近活跃于 {formatDateTime(developer.lastActiveAt)}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
