import { formatDateTime } from "@/lib/utils";
import { translateWithPack } from "@/lib/language-pack";
import { localizeDemoCopy, translateSourceType, translateStatus, translateWorkflowType } from "@/lib/presentation";
import { getActiveLanguagePack } from "@/server/language-pack-store";
import { getWallboardSnapshot } from "@/server/queries";

export default function WallboardPage() {
  const languagePack = getActiveLanguagePack();
  const t = (key: string, fallback?: string, params?: Record<string, string | number>) =>
    translateWithPack(languagePack, key, fallback, params);
  const snapshot = getWallboardSnapshot();

  return (
    <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
      <section className="space-y-4">
        <div className="rounded-lg border border-[var(--line)] bg-[var(--surface-strong)] p-6">
          <div className="text-xs font-medium text-[var(--ink-muted)]">
            {t("ui.generated.c56a2fa282b", "活跃任务")}
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
                  {t("ui.generated.c3c75f3646a", "提交人：")} {taskRun.requestedBy} · {formatDateTime(taskRun.createdAt)}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-lg border border-[var(--line)] bg-[var(--surface-strong)] p-6">
          <div className="text-xs font-medium text-[var(--ink-muted)]">
            {t("ui.generated.cd4c11371e2", "运行时状态")}
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
                  {runtime.activeRunCount} {t("ui.generated.c0e8d5d0351", "个活跃运行 · 并发上限 ")}{runtime.concurrencyLimit} {t("ui.generated.c0188a1d615", "个")}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-lg border border-[var(--line)] bg-[var(--surface-strong)] p-6">
          <div className="text-xs font-medium text-[var(--ink-muted)]">
            {t("ui.generated.c3c943b28b2", "任务来源分布")}
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-4">
            {snapshot.taskExecutionDashboard.bySourceType.map((item) => (
              <div key={item.sourceType} className="rounded-md border border-[var(--line)] bg-[var(--surface)] p-4">
                <div className="text-sm text-[var(--ink-muted)]">{translateSourceType(item.sourceType)}</div>
                <div className="mt-2 text-xl font-semibold text-[var(--ink)]">{item.taskRunCount}</div>
                <div className="mt-1 text-xs text-[var(--ink-muted)]">{t("ui.generated.c8c0daf7f81", "活跃：")} {item.activeCount}</div>
              </div>
            ))}
          </div>
        </div>

      </section>

      <section className="space-y-4">
        <div className="rounded-lg border border-[var(--line)] bg-[var(--surface-strong)] p-6">
          <div className="text-xs font-medium text-[var(--ink-muted)]">
            {t("ui.generated.cc8fd36b938", "Agent 团队排行")}
          </div>
          <div className="mt-4 space-y-3">
            {snapshot.topTeams.map((team) => (
              <div
                key={team.id}
                className="rounded-md border border-[var(--line)] bg-[var(--surface)] px-4 py-4"
              >
                <div className="text-base font-semibold text-[var(--ink)]">{team.name}</div>
                <div className="mt-2 text-sm text-[var(--ink-muted)]">
                  {translateWorkflowType(team.workflowType)} · {team.agentCount} {t("ui.generated.ce2481c87f2", "个 Agent · 目标成功率 ")}{Math.round(team.successRateTarget * 100)}%
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-lg border border-[var(--line)] bg-[var(--surface-strong)] p-6">
          <div className="text-xs font-medium text-[var(--ink-muted)]">
            {t("ui.generated.cacce24c07a", "代码仓活动")}
          </div>
          <div className="mt-4 space-y-3">
            {snapshot.topRepositories.map((repository) => (
              <div
                key={repository.id}
                className="rounded-md border border-[var(--line)] bg-[var(--surface)] px-4 py-4"
              >
                <div className="text-base font-semibold text-[var(--ink)]">{repository.name}</div>
                <div className="mt-2 text-sm text-[var(--ink-muted)]">
                  {repository.provider} · {repository.branch} {t("ui.generated.c89fa5ee6d9", "最近运行 ")}{repository.lastTaskRunCount} {t("ui.generated.cc5680a85b1", "次")}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-lg border border-[var(--line)] bg-[var(--surface-strong)] p-6">
          <div className="text-xs font-medium text-[var(--ink-muted)]">
            {t("ui.generated.c52ad88f273", "近期活跃成员")}
          </div>
          <div className="mt-4 space-y-3">
            {snapshot.topDevelopers.map((developer) => (
              <div
                key={developer.id}
                className="rounded-md border border-[var(--line)] bg-[var(--surface)] px-4 py-4"
              >
                <div className="text-base font-semibold text-[var(--ink)]">{developer.name}</div>
                <div className="mt-2 text-sm text-[var(--ink-muted)]">
                  {localizeDemoCopy(developer.focus)} {t("ui.generated.c2f29355d6e", " · 最近活跃 ")}{formatDateTime(developer.lastActiveAt)}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
