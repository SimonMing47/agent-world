import { notFound } from "next/navigation";
import { TraceGroup } from "@/components/trace-group";
import {
  localizeDemoCopy,
  translateSourceType,
  translateStatus,
} from "@/lib/presentation";
import { QuestOpsConsole } from "@/components/quest-ops-console";
import { getQuestDetail } from "@/server/queries";

export default async function QuestDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const resolved = await params;
  const detail = getQuestDetail(resolved.id);

  if (!detail) {
    notFound();
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[0.86fr_1.14fr]">
      <section className="space-y-4">
        <QuestOpsConsole
          questId={detail.quest.id}
          retryNodeId={detail.nodes.find((node) => node.status === "failed")?.id}
          pendingInterventionId={detail.interventions.find((intervention) => intervention.status === "pending")?.id}
        />

        <div className="rounded-[28px] border border-[var(--line)] bg-[var(--surface-strong)] p-6">
          <div className="text-[11px] font-medium uppercase tracking-[0.22em] text-[var(--ink-muted)]">
            Quest 概览
          </div>
          <h3 className="mt-3 text-2xl font-semibold tracking-[-0.04em] text-[var(--ink)]">
            {detail.quest.sourceRef ?? detail.quest.sourceType}
          </h3>
          <div className="mt-5 space-y-2 text-sm text-[var(--ink-muted)]">
            <div>状态: {translateStatus(detail.quest.status)}</div>
            <div>来源类型: {translateSourceType(detail.quest.sourceType)}</div>
            <div>World: {detail.world?.name ?? "未知 World"}</div>
            <div>Kingdom: {detail.kingdom?.name ?? "未知 Kingdom"}</div>
            <div>团队: {detail.team?.name ?? "未知 AgentTeam"}</div>
            <div>提交人: {detail.quest.requestedBy}</div>
            <div>预估成本: ${detail.quest.costEstimate}</div>
            <div>实际成本: ${detail.quest.costActual}</div>
          </div>
        </div>

        {detail.contract ? (
          <div className="rounded-[28px] border border-[var(--line)] bg-[var(--surface-strong)] p-6">
            <div className="text-[11px] font-medium uppercase tracking-[0.22em] text-[var(--ink-muted)]">
              Contract 合约
            </div>
            <div className="mt-3 text-lg font-semibold text-[var(--ink)]">
              {detail.contract.serviceAccountRef}
            </div>
            <div className="mt-3 space-y-2 text-sm text-[var(--ink-muted)]">
              <div>状态: {translateStatus(detail.contract.status)}</div>
              <div>
                动作范围: {(detail.contract.scope.actions ?? []).join(", ") || "无"}
              </div>
              <div>
                工具范围: {(detail.contract.scope.tools ?? []).join(", ") || "无"}
              </div>
              <div>
                SLA: {detail.contract.sla.responseSeconds ?? 0}s / {Math.round((detail.contract.sla.successRateFloor ?? 0) * 100)}%
              </div>
            </div>
          </div>
        ) : null}

        {detail.harness ? (
          <div className="rounded-[28px] border border-[var(--line)] bg-[var(--surface-strong)] p-6">
            <div className="text-[11px] font-medium uppercase tracking-[0.22em] text-[var(--ink-muted)]">
              Harness 约束
            </div>
            <div className="mt-3 text-lg font-semibold text-[var(--ink)]">{detail.harness.name}</div>
            <p className="mt-2 text-sm leading-6 text-[var(--ink-muted)]">
              {detail.harness.instruction}
            </p>
            <div className="mt-4 space-y-2 text-sm text-[var(--ink-muted)]">
              <div>允许工具: {detail.harness.allowedTools.join(", ")}</div>
              <div>需人工批准: {detail.harness.approvalRequiredTools.join(", ") || "无"}</div>
              <div>阻断工具: {detail.harness.blockedTools.join(", ") || "无"}</div>
              <div>
                预算: {detail.harness.budget.maxRuntimeMinutes} 分钟 / {detail.harness.budget.maxSteps} 步 / {detail.harness.budget.maxToolCalls} 次工具调用
              </div>
              <div>默认语言: {detail.harness.safety.defaultLocale}</div>
              <div>默认折叠思考: {detail.harness.safety.collapseThinkingByDefault ? "是" : "否"}</div>
            </div>
          </div>
        ) : null}

        <div className="rounded-[28px] border border-[var(--line)] bg-[var(--surface-strong)] p-6">
          <div className="text-[11px] font-medium uppercase tracking-[0.22em] text-[var(--ink-muted)]">
            计划与节点
          </div>
          <div className="mt-3 text-sm text-[var(--ink-muted)]">
            {detail.plan?.summary ? localizeDemoCopy(detail.plan.summary) : "当前没有计划摘要"}
          </div>
          <div className="mt-4 space-y-3">
            {detail.nodes.map((node) => (
              <div
                key={node.id}
                className="rounded-[24px] border border-[var(--line)] bg-[var(--surface)] px-4 py-4"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="text-base font-semibold text-[var(--ink)]">
                    {node.nodeKey} · {node.agentName}
                  </div>
                  <div className="text-[11px] uppercase tracking-[0.18em] text-[var(--ink-muted)]">
                    {translateStatus(node.status)}
                  </div>
                </div>
                <div className="mt-2 grid gap-2 text-sm text-[var(--ink-muted)] md:grid-cols-2">
                  <div>尝试次数: {node.attemptLabel}</div>
                  <div>依赖节点数: {node.dependencyCount}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {detail.interventions.length > 0 ? (
          <div className="rounded-[28px] border border-[var(--line)] bg-[var(--surface-strong)] p-6">
            <div className="text-[11px] font-medium uppercase tracking-[0.22em] text-[var(--ink-muted)]">
              人工干预
            </div>
            <div className="mt-4 space-y-3">
              {detail.interventions.map((intervention) => (
                <div
                  key={intervention.id}
                  className="rounded-[24px] border border-[var(--line)] bg-[var(--surface)] px-4 py-4"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-base font-semibold text-[var(--ink)]">
                      {localizeDemoCopy(intervention.requestedAction)}
                    </div>
                    <div className="text-[11px] uppercase tracking-[0.18em] text-[var(--ink-muted)]">
                      {translateStatus(intervention.status)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {detail.executionInsights ? (
          <div className="rounded-[28px] border border-[var(--line)] bg-[var(--surface-strong)] p-6">
            <div className="text-[11px] font-medium uppercase tracking-[0.22em] text-[var(--ink-muted)]">
              执行指标
            </div>
            <div className="mt-3 grid gap-2 text-sm text-[var(--ink-muted)] md:grid-cols-2">
              <div>吞吐率: {Math.round(detail.executionInsights.metrics.throughput * 100)}%</div>
              <div>失败率: {Math.round(detail.executionInsights.metrics.failureRate * 100)}%</div>
              <div>人工介入率: {Math.round(detail.executionInsights.metrics.humanInterventionRate * 100)}%</div>
              <div>失败可恢复率: {Math.round(detail.executionInsights.metrics.retryRecoveryPotential * 100)}%</div>
            </div>
          </div>
        ) : null}
      </section>

      <section className="space-y-4">
        <div className="rounded-[28px] border border-[var(--line)] bg-[var(--surface-strong)] p-6">
          <div className="text-[11px] font-medium uppercase tracking-[0.22em] text-[var(--ink-muted)]">
            调用阶段
          </div>
          <div className="mt-4 space-y-3">
            {detail.invocationStages.map((stage, index) => (
              <div
                key={stage.key}
                className="grid gap-3 rounded-[24px] border border-[var(--line)] bg-[var(--surface)] px-4 py-4 md:grid-cols-[auto_1fr]"
              >
                <div className="flex h-9 w-9 items-center justify-center rounded-full border border-[var(--line)] bg-[var(--canvas)] text-sm font-semibold text-[var(--ink)]">
                  {index + 1}
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="text-base font-semibold text-[var(--ink)]">{stage.label}</div>
                    <div className="text-[11px] uppercase tracking-[0.18em] text-[var(--ink-muted)]">
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
              {detail.providerRationale.map((line) => (
                <div key={line}>{line}</div>
              ))}
            </div>
          </div>
        </div>

        {Object.entries(detail.groupedEvents).map(([group, events]) => (
          <TraceGroup key={group} title={group} events={events} />
        ))}

        {detail.costBreakdown ? (
          <div className="rounded-[28px] border border-[var(--line)] bg-[var(--surface-strong)] p-6">
            <div className="text-[11px] font-medium uppercase tracking-[0.22em] text-[var(--ink-muted)]">
              成本明细
            </div>
            <div className="mt-2 text-sm text-[var(--ink-muted)]">
              估算 ${detail.costBreakdown.estimatedUsd} / 实际 ${detail.costBreakdown.actualUsd}
            </div>
          </div>
        ) : null}
      </section>
    </div>
  );
}
