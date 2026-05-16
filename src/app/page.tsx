import { MetricCard } from "@/components/metric-card";
import {
  translateRecruitmentMode,
  translateScheduleState,
  translateSourceType,
  translateStatus,
} from "@/lib/presentation";
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

      <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-[28px] border border-[var(--line)] bg-[var(--surface-strong)] p-6">
          <div className="text-[11px] font-medium uppercase tracking-[0.22em] text-[var(--ink-muted)]">
            任务执行展示层
          </div>
          <h3 className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-[var(--ink)]">
            所有 Quest 按触发类别统一进入全局看板。
          </h3>
          <div className="mt-5 grid gap-3 md:grid-cols-4">
            {snapshot.taskExecutionDashboard.bySourceType.map((item) => (
              <div key={item.sourceType} className="rounded-[24px] border border-[var(--line)] bg-[var(--surface)] p-4">
                <div className="text-sm text-[var(--ink-muted)]">{translateSourceType(item.sourceType)}</div>
                <div className="mt-2 text-2xl font-semibold text-[var(--ink)]">{item.questCount}</div>
                <div className="mt-1 text-sm text-[var(--ink-muted)]">活跃 {item.activeCount}</div>
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-[28px] border border-[var(--line)] bg-[var(--surface-strong)] p-6">
          <div className="text-[11px] font-medium uppercase tracking-[0.22em] text-[var(--ink-muted)]">
            团队维度
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {snapshot.taskExecutionDashboard.byKingdom.map((item) => (
              <div key={item.kingdomId} className="rounded-[24px] border border-[var(--line)] bg-[var(--surface)] px-4 py-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-base font-semibold text-[var(--ink)]">{item.kingdomName}</div>
                  <div className="text-sm text-[var(--ink-muted)]">活跃 {item.activeCount}</div>
                </div>
                <div className="mt-2 text-sm text-[var(--ink-muted)]">
                  {item.questCount} 个 Quest · {item.teamCount} 个 AgentTeam
                </div>
              </div>
            ))}
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {snapshot.taskExecutionDashboard.byTaskCategory.map((item) => (
              <div key={item.category} className="rounded-[24px] border border-[var(--line)] bg-[var(--surface)] px-4 py-4">
                <div className="text-base font-semibold text-[var(--ink)]">{item.category}</div>
                <div className="mt-2 text-sm text-[var(--ink-muted)]">
                  {item.questCount} 个 Quest · 活跃 {item.activeCount}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <div className="rounded-[28px] border border-[var(--line)] bg-[var(--surface-strong)] p-6">
          <div className="flex items-end justify-between gap-4">
            <div>
              <div className="text-[11px] font-medium uppercase tracking-[0.22em] text-[var(--ink-muted)]">
                World 治理边界
              </div>
              <h3 className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-[var(--ink)]">
                World 负责给出最外层规则，Kingdom 和 AgentTeam 在里面继续收紧。
              </h3>
            </div>
            <div className="text-sm text-[var(--ink-muted)]">
              下一轮调度窗口结束于 {formatDateTime(snapshot.upcomingWindow)}
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
                    {translateStatus(world.status)}
                  </div>
                </div>
                <div className="mt-3 space-y-1 text-sm text-[var(--ink-muted)]">
                  <div>Kingdom 数量: {world.kingdomCount}</div>
                  <div>月度预算上限: ${world.monthlyUsd}</div>
                  <div>最大并发 Quest: {world.maxRunningQuests}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-[28px] border border-[var(--line)] bg-[var(--surface-strong)] p-6">
          <div className="text-[11px] font-medium uppercase tracking-[0.22em] text-[var(--ink-muted)]">
            Kingdom 财务视图
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
                    {translateStatus(kingdom.status)}
                  </div>
                </div>
                <div className="mt-2 space-y-1 text-sm text-[var(--ink-muted)]">
                  <div>余额: ${kingdom.balance}</div>
                  <div>信用额度: ${kingdom.creditLimit}</div>
                  <div>工具引用数: {kingdom.toolRefCount}</div>
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
                调度器
              </div>
              <h3 className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-[var(--ink)]">
                定时任务和 Quest 优先级会在进入排队拥堵之前被提前看见。
              </h3>
            </div>
            <div className="text-sm text-[var(--ink-muted)]">
              当前到点: {snapshot.dueScheduleCount}
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
                    {translateScheduleState(assessment.state)}
                  </div>
                </div>
                <div className="mt-2 text-sm text-[var(--ink-muted)]">
                  {assessment.cadence}
                  {assessment.nextRunAt ? ` · 下次执行 ${formatDateTime(assessment.nextRunAt)}` : ""}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-[28px] border border-[var(--line)] bg-[var(--surface-strong)] p-6">
          <div className="text-[11px] font-medium uppercase tracking-[0.22em] text-[var(--ink-muted)]">
            调用链路
          </div>
          <h3 className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-[var(--ink)]">
            Agent 调用是一条受治理的流水线，不是一句提示词直接甩给模型。
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
              Provider 选择依据
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
                    {translateRecruitmentMode(listing.recruitmentMode)}
                  </div>
                </div>
                <div className="mt-2 space-y-1 text-sm text-[var(--ink-muted)]">
                  <div>成功率: {formatPercent(listing.resume.successRate ?? 0)}</div>
                  <div>平均耗时: {Math.round((listing.resume.avgLatencyMs ?? 0) / 1000)}s</div>
                  <div>平均成本: ${listing.resume.avgCostUsd ?? 0}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-[28px] border border-[var(--line)] bg-[var(--surface-strong)] p-6">
          <div className="text-[11px] font-medium uppercase tracking-[0.22em] text-[var(--ink-muted)]">
            Quest 优先级看板
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
                      优先级 {item.effectivePriority}
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
