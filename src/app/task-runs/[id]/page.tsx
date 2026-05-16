import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { PageHeader } from "@/components/page-header";
import { TraceGroup } from "@/components/trace-group";
import { Badge } from "@/components/ui/badge";
import { Panel, PanelBody, PanelHeader } from "@/components/ui/panel";
import {
  localizeDemoCopy,
  translateSourceType,
  translateStatus,
} from "@/lib/presentation";
import { TaskRunOpsConsole } from "@/components/task-run-ops-console";
import { getTaskRunDetail } from "@/server/queries";

function JsonBlock({ value }: { value: unknown }) {
  return (
    <pre className="max-h-[340px] overflow-auto rounded-xl border border-[var(--line)] bg-[var(--surface-muted)] p-4 text-xs leading-5 text-[var(--ink-muted)]">
      {JSON.stringify(value, null, 2)}
    </pre>
  );
}

function FactGrid({
  items,
}: {
  items: Array<{ label: string; value: ReactNode; detail?: ReactNode }>;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {items.map((item) => (
        <div key={item.label} className="rounded-xl border border-[var(--line)] bg-[var(--surface-muted)] p-4">
          <div className="text-xs font-medium uppercase tracking-[0.14em] text-[var(--ink-muted)]">
            {item.label}
          </div>
          <div className="mt-2 text-sm font-medium text-[var(--ink)]">{item.value}</div>
          {item.detail ? <div className="mt-1 text-sm text-[var(--ink-muted)]">{item.detail}</div> : null}
        </div>
      ))}
    </div>
  );
}

function statusVariant(status: string): "neutral" | "accent" | "success" | "warning" | "danger" {
  if (["failed", "rejected", "blocked"].includes(status)) return "danger";
  if (["running", "queued", "waiting_approval", "preparing_environment", "publishing_output"].includes(status)) {
    return "accent";
  }
  if (["succeeded", "completed", "approved", "healthy"].includes(status)) return "success";
  return "neutral";
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
    <div className="space-y-6">
      <PageHeader
        eyebrow="Run Detail"
        title={detail.taskRun.sourceRef ?? detail.taskRun.sourceType}
        description="在同一工作台查看任务运行状态、Agent 编排、执行事件、Finding 和人工干预。"
        badges={[
          { label: translateStatus(detail.taskRun.status), variant: statusVariant(detail.taskRun.status) },
          { label: translateStatus(detail.taskRun.runState), variant: statusVariant(detail.taskRun.runState) },
          { label: translateSourceType(detail.taskRun.sourceType), variant: "neutral" },
        ]}
      />

      <div className="grid gap-6 xl:grid-cols-[0.86fr_1.14fr]">
        <section className="space-y-4">
        <TaskRunOpsConsole
          taskRunId={detail.taskRun.id}
          retryNodeId={detail.nodes.find((node) => node.status === "failed")?.id}
          pendingInterventionId={detail.interventions.find((intervention) => intervention.status === "pending")?.id}
        />

        <Panel>
          <PanelHeader eyebrow="Summary" title="任务执行概览" description="本次运行绑定的主体对象、成本与幂等信息。" />
          <PanelBody>
            <FactGrid
              items={[
                { label: "任务状态", value: translateStatus(detail.taskRun.status) },
                { label: "运行状态", value: translateStatus(detail.taskRun.runState) },
                { label: "任务蓝图", value: detail.kernel.blueprint?.name ?? "未绑定" },
                { label: "幂等键", value: detail.taskRun.idempotencyKey ?? "无" },
                { label: "租户空间", value: detail.tenantSpace?.name ?? "未知租户空间" },
                { label: "业务团队", value: detail.businessTeam?.name ?? "未知业务团队" },
                { label: "Agent 团队", value: detail.team?.name ?? "未知 Agent 团队" },
                { label: "提交人", value: detail.taskRun.requestedBy },
                { label: "预估成本", value: `$${detail.taskRun.costEstimate}` },
                { label: "实际成本", value: `$${detail.taskRun.costActual}` },
              ]}
            />
          </PanelBody>
        </Panel>

        {detail.kernel.blueprint ? (
          <Panel>
            <PanelHeader eyebrow="Blueprint" title="蓝图快照" description="记录本次运行所使用的蓝图版本与触发方式。" />
            <PanelBody>
              <FactGrid
                items={[
                  { label: "蓝图名称", value: detail.kernel.blueprint.name },
                  { label: "蓝图类别", value: detail.kernel.blueprint.category },
                  { label: "蓝图版本", value: `v${detail.kernel.blueprint.version}` },
                  { label: "触发器", value: String(detail.kernel.blueprint.trigger.type ?? "manual") },
                ]}
              />
            </PanelBody>
          </Panel>
        ) : null}

        {detail.kernel.agentTeamRunPlan ? (
          <Panel>
            <PanelHeader
              eyebrow="Orchestration"
              title="编排协议"
              description={`${detail.kernel.agentTeamRunPlan.strategy} · Leader ${detail.kernel.agentTeamRunPlan.leader.agentName}`}
            />
            <PanelBody className="space-y-3">
              {detail.kernel.agentTeamRunPlan.workers.map((worker) => (
                <div key={`${worker.agent}-${worker.task}`} className="rounded-xl border border-[var(--line)] bg-[var(--surface-muted)] px-4 py-3">
                  <div className="text-sm font-semibold text-[var(--ink)]">{worker.agentName}</div>
                  <div className="mt-1 text-sm leading-6 text-[var(--ink-muted)]">{worker.task}</div>
                </div>
              ))}
            </PanelBody>
          </Panel>
        ) : null}

        {detail.accessGrant ? (
          <Panel>
            <PanelHeader eyebrow="Access Grant" title="跨团队授权" description={detail.accessGrant.serviceAccountRef} />
            <PanelBody>
              <FactGrid
                items={[
                  { label: "状态", value: translateStatus(detail.accessGrant.status) },
                  { label: "动作范围", value: (detail.accessGrant.scope.actions ?? []).join(", ") || "无" },
                  { label: "工具范围", value: (detail.accessGrant.scope.tools ?? []).join(", ") || "无" },
                  {
                    label: "SLA",
                    value: `${detail.accessGrant.sla.responseSeconds ?? 0}s / ${Math.round((detail.accessGrant.sla.successRateFloor ?? 0) * 100)}%`,
                  },
                ]}
              />
            </PanelBody>
          </Panel>
        ) : null}

        {detail.executionPolicy ? (
          <Panel>
            <PanelHeader eyebrow="Policy" title="运行约束" description={detail.executionPolicy.name} />
            <PanelBody className="space-y-4">
              <p className="text-sm leading-6 text-[var(--ink-muted)]">{detail.executionPolicy.instruction}</p>
              <FactGrid
                items={[
                  { label: "允许工具", value: detail.executionPolicy.allowedTools.join(", ") || "无" },
                  { label: "需人工批准", value: detail.executionPolicy.approvalRequiredTools.join(", ") || "无" },
                  { label: "阻断工具", value: detail.executionPolicy.blockedTools.join(", ") || "无" },
                  {
                    label: "预算",
                    value: `${detail.executionPolicy.budget.maxRuntimeMinutes} 分钟 / ${detail.executionPolicy.budget.maxSteps} 步 / ${detail.executionPolicy.budget.maxToolCalls} 次工具调用`,
                  },
                  { label: "默认语言", value: detail.executionPolicy.safety.defaultLocale },
                  { label: "默认折叠思考", value: detail.executionPolicy.safety.collapseThinkingByDefault ? "是" : "否" },
                ]}
              />
            </PanelBody>
          </Panel>
        ) : null}

        <Panel>
          <PanelHeader
            eyebrow="Nodes"
            title="计划与节点"
            description={detail.plan?.summary ? localizeDemoCopy(detail.plan.summary) : "当前没有计划摘要"}
          />
          <PanelBody className="space-y-3">
            {detail.nodes.map((node) => (
              <div
                key={node.id}
                className="rounded-xl border border-[var(--line)] bg-[var(--surface-muted)] px-4 py-4"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="text-base font-semibold text-[var(--ink)]">
                    {node.nodeKey} · {node.agentName}
                  </div>
                  <Badge variant={statusVariant(node.status)}>{translateStatus(node.status)}</Badge>
                </div>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <div className="text-sm text-[var(--ink-muted)]">尝试次数: {node.attemptLabel}</div>
                  <div className="text-sm text-[var(--ink-muted)]">依赖节点数: {node.dependencyCount}</div>
                </div>
              </div>
            ))}
          </PanelBody>
        </Panel>

        {detail.interventions.length > 0 ? (
          <Panel>
            <PanelHeader eyebrow="Interventions" title="人工干预" description="审批门禁和人工决策请求。" />
            <PanelBody className="space-y-3">
              {detail.interventions.map((intervention) => (
                <div
                  key={intervention.id}
                  className="rounded-xl border border-[var(--line)] bg-[var(--surface-muted)] px-4 py-4"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-base font-semibold text-[var(--ink)]">
                      {localizeDemoCopy(intervention.requestedAction)}
                    </div>
                    <Badge variant={statusVariant(intervention.status)}>
                      {translateStatus(intervention.status)}
                    </Badge>
                  </div>
                </div>
              ))}
            </PanelBody>
          </Panel>
        ) : null}

        {detail.executionInsights ? (
          <Panel>
            <PanelHeader eyebrow="Metrics" title="执行指标" description="评估本次运行的吞吐、失败与人工介入水平。" />
            <PanelBody>
              <FactGrid
                items={[
                  { label: "吞吐率", value: `${Math.round(detail.executionInsights.metrics.throughput * 100)}%` },
                  { label: "失败率", value: `${Math.round(detail.executionInsights.metrics.failureRate * 100)}%` },
                  { label: "人工介入率", value: `${Math.round(detail.executionInsights.metrics.humanInterventionRate * 100)}%` },
                  { label: "失败可恢复率", value: `${Math.round(detail.executionInsights.metrics.retryRecoveryPotential * 100)}%` },
                ]}
              />
            </PanelBody>
          </Panel>
        ) : null}

        </section>

        <section className="space-y-4">
          <Panel>
            <PanelHeader
              eyebrow="Workspace"
              title="任务空间"
              description="对话、thinking、tool use、标准事件与人工操作在这里统一展开。"
            />
            <PanelBody className="text-sm leading-6 text-[var(--ink-muted)]">
              下方内容按调用阶段、执行事件和产出结果组织，便于值班排障和复盘。
            </PanelBody>
          </Panel>

          <Panel>
            <PanelHeader eyebrow="Stages" title="调用阶段" description="展示从调度到输出的主要执行步骤。" />
            <PanelBody className="space-y-3">
            {detail.invocationStages.map((stage, index) => (
              <div
                key={stage.key}
                className="grid gap-3 rounded-xl border border-[var(--line)] bg-[var(--surface-muted)] px-4 py-4 md:grid-cols-[auto_1fr]"
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
              <div className="rounded-xl border border-[var(--line)] bg-[var(--surface-muted)] p-4">
                <div className="text-[11px] font-medium uppercase tracking-[0.18em] text-[var(--ink-muted)]">
                  Provider 选择依据
                </div>
                <div className="mt-2 space-y-1 text-sm text-[var(--ink-muted)]">
                  {detail.providerRationale.map((line) => (
                    <div key={line}>{line}</div>
                  ))}
                </div>
              </div>
            </PanelBody>
          </Panel>

          {Object.entries(detail.groupedEvents).map(([group, events]) => (
            <TraceGroup key={group} title={group} events={events} />
          ))}

          <Panel>
            <PanelHeader eyebrow="Events" title="标准事件流" description="统一 Provider 事件、工具事件和状态事件。" />
            <PanelBody className="space-y-3">
              {detail.kernel.events.map((event) => (
                <div key={event.id} className="rounded-xl border border-[var(--line)] bg-[var(--surface-muted)] px-4 py-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="text-sm font-semibold text-[var(--ink)]">{event.eventType}</div>
                    <Badge variant="neutral">{event.visibility}</Badge>
                  </div>
                  <div className="mt-2 text-sm leading-6 text-[var(--ink-muted)]">
                    {String(event.payload.title ?? "")}
                  </div>
                </div>
              ))}
            </PanelBody>
          </Panel>

        {detail.kernel.findings.length > 0 ? (
            <Panel>
              <PanelHeader eyebrow="Findings" title="Finding 输出" description="本次运行产出的标准化问题列表。" />
              <PanelBody className="space-y-3">
                {detail.kernel.findings.map((finding) => (
                  <div key={finding.id} className="rounded-xl border border-[var(--line)] bg-[var(--surface-muted)] px-4 py-3">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="text-sm font-semibold text-[var(--ink)]">{finding.title}</div>
                      <Badge variant={finding.severity === "high" || finding.severity === "critical" ? "danger" : "neutral"}>
                        {finding.severity} · {finding.category}
                      </Badge>
                    </div>
                    <p className="mt-2 text-sm leading-6 text-[var(--ink-muted)]">{finding.description}</p>
                  </div>
                ))}
              </PanelBody>
            </Panel>
        ) : null}

        {detail.kernel.environmentSnapshot ? (
            <Panel>
              <PanelHeader eyebrow="Environment" title="环境快照" description="记录本次运行使用的仓库、执行路径与凭据绑定。" />
              <PanelBody>
                <JsonBlock value={detail.kernel.environmentSnapshot} />
              </PanelBody>
            </Panel>
        ) : null}

          <Panel>
            <PanelHeader eyebrow="Permissions" title="权限快照" description="用于审计本次运行实际生效的权限规则。" />
            <PanelBody>
              <JsonBlock value={detail.kernel.permissionSnapshot} />
            </PanelBody>
          </Panel>

        {detail.costBreakdown ? (
            <Panel>
              <PanelHeader eyebrow="Costs" title="成本明细" description="估算与实际消耗对照。" />
              <PanelBody className="text-sm text-[var(--ink-muted)]">
                估算 ${detail.costBreakdown.estimatedUsd} / 实际 ${detail.costBreakdown.actualUsd}
              </PanelBody>
            </Panel>
        ) : null}
        </section>
      </div>
    </div>
  );
}
