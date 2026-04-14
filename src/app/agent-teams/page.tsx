import { getDashboardSnapshot } from "@/server/queries";
import { translateVisibility, translateWorkflowType } from "@/lib/presentation";

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
                AgentTeam 服务
              </div>
              <h3 className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-[var(--ink)]">
                {team.name}
              </h3>
            </div>
            <div className="text-[11px] uppercase tracking-[0.18em] text-[var(--ink-muted)]">
              {translateVisibility(team.visibility)}
            </div>
          </div>
          <div className="mt-5 grid gap-4 md:grid-cols-4">
            <div className="rounded-[24px] border border-[var(--line)] bg-[var(--surface)] p-4">
              <div className="text-sm text-[var(--ink-muted)]">工作流类型</div>
              <div className="mt-2 text-xl font-semibold text-[var(--ink)]">
                {translateWorkflowType(team.workflowType)}
              </div>
            </div>
            <div className="rounded-[24px] border border-[var(--line)] bg-[var(--surface)] p-4">
              <div className="text-sm text-[var(--ink-muted)]">Agent 数量</div>
              <div className="mt-2 text-xl font-semibold text-[var(--ink)]">{team.agentCount}</div>
            </div>
            <div className="rounded-[24px] border border-[var(--line)] bg-[var(--surface)] p-4">
              <div className="text-sm text-[var(--ink-muted)]">超时时间</div>
              <div className="mt-2 text-xl font-semibold text-[var(--ink)]">{team.timeoutMinutes} 分钟</div>
            </div>
            <div className="rounded-[24px] border border-[var(--line)] bg-[var(--surface)] p-4">
              <div className="text-sm text-[var(--ink-muted)]">成功率目标</div>
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
