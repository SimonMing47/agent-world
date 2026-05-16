import { notFound } from "next/navigation";
import { TraceGroup } from "@/components/trace-group";
import {
  localizeDemoCopy,
  translateSourceType,
  translateStatus,
} from "@/lib/presentation";
import { TaskRunOpsConsole } from "@/components/task-run-ops-console";
import { getTaskRunDetail } from "@/server/queries";

function JsonBlock({ value }: { value: unknown }) {
  return (
    <pre className="mt-3 max-h-[340px] overflow-auto rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-4 text-xs leading-5 text-[var(--ink-muted)]">
      {JSON.stringify(value, null, 2)}
    </pre>
  );
}

export default async function TaskRunDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const resolved = await params;
  const detail = getTaskRunDetail(resolved.id);

  if (!detail) {
    notFound();
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[0.86fr_1.14fr]">
      <section className="space-y-4">
        <TaskRunOpsConsole
          taskRunId={detail.taskRun.id}
          retryNodeId={detail.nodes.find((node) => node.status === "failed")?.id}
          pendingInterventionId={detail.interventions.find((intervention) => intervention.status === "pending")?.id}
        />

        <div className="rounded-[28px] border border-[var(--line)] bg-[var(--surface-strong)] p-6">
          <div className="text-[11px] font-medium uppercase tracking-[0.22em] text-[var(--ink-muted)]">
            任务执行概览
          </div>
          <h3 className="mt-3 text-2xl font-semibold tracking-[-0.04em] text-[var(--ink)]">
            {detail.taskRun.sourceRef ?? detail.taskRun.sourceType}
          </h3>
          <div className="mt-5 space-y-2 text-sm text-[var(--ink-muted)]">
            <div>状态: {translateStatus(detail.taskRun.status)}</div>
            <div>来源类型: {translateSourceType(detail.taskRun.sourceType)}</div>
            <div>运行状态: {translateStatus(detail.taskRun.runState)}</div>
            <div>任务蓝图: {detail.kernel.blueprint?.name ?? "未绑定"}</div>
            <div>幂等键: {detail.taskRun.idempotencyKey ?? "无"}</div>
            <div>租户空间: {detail.tenantSpace?.name ?? "未知租户空间"}</div>
            <div>业务团队: {detail.businessTeam?.name ?? "未知业务团队"}</div>
            <div>Agent 团队: {detail.team?.name ?? "未知 Agent 团队"}</div>
            <div>提交人: {detail.taskRun.requestedBy}</div>
            <div>预估成本: ${detail.taskRun.costEstimate}</div>
            <div>实际成本: ${detail.taskRun.costActual}</div>
          </div>
        </div>

        {detail.kernel.blueprint ? (
          <div className="rounded-[28px] border border-[var(--line)] bg-[var(--surface-strong)] p-6">
            <div className="text-[11px] font-medium uppercase tracking-[0.22em] text-[var(--ink-muted)]">
              蓝图快照
            </div>
            <div className="mt-3 text-lg font-semibold text-[var(--ink)]">
              {detail.kernel.blueprint.name}
            </div>
            <div className="mt-3 grid gap-2 text-sm text-[var(--ink-muted)] md:grid-cols-2">
              <div>类别: {detail.kernel.blueprint.category}</div>
              <div>版本: v{detail.kernel.blueprint.version}</div>
              <div>触发器: {String(detail.kernel.blueprint.trigger.type ?? "manual")}</div>
              <div>当前状态: {translateStatus(detail.kernel.runState)}</div>
            </div>
          </div>
        ) : null}

        {detail.kernel.agentTeamRunPlan ? (
          <div className="rounded-[28px] border border-[var(--line)] bg-[var(--surface-strong)] p-6">
            <div className="text-[11px] font-medium uppercase tracking-[0.22em] text-[var(--ink-muted)]">
              编排协议
            </div>
            <div className="mt-3 text-lg font-semibold text-[var(--ink)]">
              {detail.kernel.agentTeamRunPlan.strategy} · Leader {detail.kernel.agentTeamRunPlan.leader.agentName}
            </div>
            <div className="mt-4 space-y-3">
              {detail.kernel.agentTeamRunPlan.workers.map((worker) => (
                <div key={`${worker.agent}-${worker.task}`} className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] px-4 py-3">
                  <div className="text-sm font-semibold text-[var(--ink)]">{worker.agentName}</div>
                  <div className="mt-1 text-sm leading-6 text-[var(--ink-muted)]">{worker.task}</div>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {detail.accessGrant ? (
          <div className="rounded-[28px] border border-[var(--line)] bg-[var(--surface-strong)] p-6">
            <div className="text-[11px] font-medium uppercase tracking-[0.22em] text-[var(--ink-muted)]">
              跨团队授权
            </div>
            <div className="mt-3 text-lg font-semibold text-[var(--ink)]">
              {detail.accessGrant.serviceAccountRef}
            </div>
            <div className="mt-3 space-y-2 text-sm text-[var(--ink-muted)]">
              <div>状态: {translateStatus(detail.accessGrant.status)}</div>
              <div>
                动作范围: {(detail.accessGrant.scope.actions ?? []).join(", ") || "无"}
              </div>
              <div>
                工具范围: {(detail.accessGrant.scope.tools ?? []).join(", ") || "无"}
              </div>
              <div>
                SLA: {detail.accessGrant.sla.responseSeconds ?? 0}s / {Math.round((detail.accessGrant.sla.successRateFloor ?? 0) * 100)}%
              </div>
            </div>
          </div>
        ) : null}

        {detail.executionPolicy ? (
          <div className="rounded-[28px] border border-[var(--line)] bg-[var(--surface-strong)] p-6">
            <div className="text-[11px] font-medium uppercase tracking-[0.22em] text-[var(--ink-muted)]">
              运行约束
            </div>
            <div className="mt-3 text-lg font-semibold text-[var(--ink)]">{detail.executionPolicy.name}</div>
            <p className="mt-2 text-sm leading-6 text-[var(--ink-muted)]">
              {detail.executionPolicy.instruction}
            </p>
            <div className="mt-4 space-y-2 text-sm text-[var(--ink-muted)]">
              <div>允许工具: {detail.executionPolicy.allowedTools.join(", ")}</div>
              <div>需人工批准: {detail.executionPolicy.approvalRequiredTools.join(", ") || "无"}</div>
              <div>阻断工具: {detail.executionPolicy.blockedTools.join(", ") || "无"}</div>
              <div>
                预算: {detail.executionPolicy.budget.maxRuntimeMinutes} 分钟 / {detail.executionPolicy.budget.maxSteps} 步 / {detail.executionPolicy.budget.maxToolCalls} 次工具调用
              </div>
              <div>默认语言: {detail.executionPolicy.safety.defaultLocale}</div>
              <div>默认折叠思考: {detail.executionPolicy.safety.collapseThinkingByDefault ? "是" : "否"}</div>
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
            任务空间
          </div>
          <h2 className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-[var(--ink)]">
            对话、thinking、tool use 与人工操作全量记录
          </h2>
          <p className="mt-2 text-sm leading-6 text-[var(--ink-muted)]">
            下方事件按执行阶段分组展开，保留每个 Agent 节点的推理摘要、工具结果、策略命中和人工干预信息。
          </p>
        </div>

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

        <div className="rounded-[28px] border border-[var(--line)] bg-[var(--surface-strong)] p-6">
          <div className="text-[11px] font-medium uppercase tracking-[0.22em] text-[var(--ink-muted)]">
            标准事件流
          </div>
          <div className="mt-4 space-y-3">
            {detail.kernel.events.map((event) => (
              <div key={event.id} className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] px-4 py-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="text-sm font-semibold text-[var(--ink)]">{event.eventType}</div>
                  <div className="text-xs uppercase tracking-[0.18em] text-[var(--ink-muted)]">
                    {event.visibility}
                  </div>
                </div>
                <div className="mt-2 text-sm leading-6 text-[var(--ink-muted)]">
                  {String(event.payload.title ?? "")}
                </div>
              </div>
            ))}
          </div>
        </div>

        {detail.kernel.findings.length > 0 ? (
          <div className="rounded-[28px] border border-[var(--line)] bg-[var(--surface-strong)] p-6">
            <div className="text-[11px] font-medium uppercase tracking-[0.22em] text-[var(--ink-muted)]">
              Finding 输出
            </div>
            <div className="mt-4 space-y-3">
              {detail.kernel.findings.map((finding) => (
                <div key={finding.id} className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] px-4 py-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="text-sm font-semibold text-[var(--ink)]">{finding.title}</div>
                    <div className="text-xs uppercase tracking-[0.18em] text-[var(--ink-muted)]">
                      {finding.severity} · {finding.category}
                    </div>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-[var(--ink-muted)]">{finding.description}</p>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {detail.kernel.environmentSnapshot ? (
          <div className="rounded-[28px] border border-[var(--line)] bg-[var(--surface-strong)] p-6">
            <div className="text-[11px] font-medium uppercase tracking-[0.22em] text-[var(--ink-muted)]">
              环境快照
            </div>
            <JsonBlock value={detail.kernel.environmentSnapshot} />
          </div>
        ) : null}

        <div className="rounded-[28px] border border-[var(--line)] bg-[var(--surface-strong)] p-6">
          <div className="text-[11px] font-medium uppercase tracking-[0.22em] text-[var(--ink-muted)]">
            权限快照
          </div>
          <JsonBlock value={detail.kernel.permissionSnapshot} />
        </div>

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
