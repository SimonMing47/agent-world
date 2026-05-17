import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { PageHeader } from "@/components/page-header";
import { TaskRunOpsConsole } from "@/components/task-run-ops-console";
import { Badge } from "@/components/ui/badge";
import {
  DataTable,
  DataTableBody,
  DataTableCell,
  DataTableHead,
  DataTableHeader,
  DataTableRow,
} from "@/components/ui/data-table";
import { DefinitionList } from "@/components/ui/definition-list";
import { Panel, PanelBody, PanelHeader } from "@/components/ui/panel";
import { SummaryStrip } from "@/components/ui/summary-strip";
import {
  localizeDemoCopy,
  translateSourceType,
  translateStatus,
} from "@/lib/presentation";
import { formatDateTime, formatPercent } from "@/lib/utils";
import { getTaskRunDetail } from "@/server/queries";

function JsonBlock({ value }: { value: unknown }) {
  return (
    <pre className="max-h-[340px] overflow-auto rounded-xl border border-[var(--line)] bg-[var(--surface-muted)] p-4 text-xs leading-5 text-[var(--ink-muted)]">
      {JSON.stringify(value, null, 2)}
    </pre>
  );
}

function EmptyState({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-[var(--line)] bg-[var(--surface-muted)] px-4 py-6 text-sm text-[var(--ink-muted)]">
      {children}
    </div>
  );
}

function statusVariant(status: string): "neutral" | "accent" | "success" | "warning" | "danger" {
  if (["failed", "rejected", "blocked"].includes(status)) return "danger";
  if (["awaiting", "waiting_approval", "pending"].includes(status)) return "warning";
  if (["running", "queued", "preparing_environment", "publishing_output"].includes(status)) return "accent";
  if (["succeeded", "completed", "approved", "healthy"].includes(status)) return "success";
  return "neutral";
}

function severityVariant(severity: string): "neutral" | "accent" | "success" | "warning" | "danger" {
  if (severity === "critical" || severity === "high") return "danger";
  if (severity === "medium") return "warning";
  if (severity === "low") return "accent";
  return "neutral";
}

function formatCurrency(value: number) {
  return `$${value.toFixed(2)}`;
}

function CompactList({ items }: { items: string[] }) {
  if (items.length === 0) return <span>无</span>;

  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((item) => (
        <Badge key={item} variant="neutral">
          {item}
        </Badge>
      ))}
    </div>
  );
}

type NodeRow = {
  id: string;
  nodeKey: string;
  agentName: string;
  status: string;
  attemptLabel: string;
  dependencyCount: number;
};

type InterventionRow = {
  id: string;
  status: string;
  requestedAction: string;
  requestedAt: string;
};

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

  const eventGroups = Object.entries(detail.groupedEvents);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Run Detail"
        title={detail.taskRun.sourceRef ?? detail.taskRun.sourceType}
        description="面向值班排障、审计复盘和人工介入的任务运行控制台。"
        badges={[
          { label: translateStatus(detail.taskRun.status), variant: statusVariant(detail.taskRun.status) },
          { label: translateStatus(detail.taskRun.runState), variant: statusVariant(detail.taskRun.runState) },
          { label: translateSourceType(detail.taskRun.sourceType), variant: "neutral" },
        ]}
      />

      <SummaryStrip
        gridClassName="sm:grid-cols-2 xl:grid-cols-4"
        items={[
          {
            label: "运行状态",
            value: translateStatus(detail.taskRun.runState),
            detail: `任务状态: ${translateStatus(detail.taskRun.status)}`,
          },
          {
            label: "节点",
            value: detail.nodes.length,
            detail: `${detail.executionInsights?.metrics.throughput ? formatPercent(detail.executionInsights.metrics.throughput) : "0%"} 已完成`,
          },
          {
            label: "Finding",
            value: detail.kernel.findings.length,
            detail: detail.kernel.findings.length > 0 ? "本次运行已有标准化产出" : "暂无 Finding",
          },
          {
            label: "成本",
            value: formatCurrency(detail.taskRun.costActual),
            detail: `估算 ${formatCurrency(detail.taskRun.costEstimate)}`,
          },
        ]}
      />

      <TaskRunOpsConsole
        taskRunId={detail.taskRun.id}
        retryNodeId={detail.nodes.find((node: NodeRow) => node.status === "failed")?.id}
        pendingInterventionId={detail.interventions.find((intervention: InterventionRow) => intervention.status === "pending")?.id}
      />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <main className="space-y-6">
          <Panel>
            <PanelHeader
              eyebrow="Execution"
              title="节点执行表"
              description={detail.plan?.summary ? localizeDemoCopy(detail.plan.summary) : "按计划节点展示 Agent、依赖和重试状态。"}
            />
            <PanelBody className="p-0">
              <DataTable>
                <DataTableHeader>
                  <DataTableRow>
                    <DataTableHead>节点</DataTableHead>
                    <DataTableHead>Agent</DataTableHead>
                    <DataTableHead>状态</DataTableHead>
                    <DataTableHead align="center">尝试</DataTableHead>
                    <DataTableHead align="center">依赖数</DataTableHead>
                  </DataTableRow>
                </DataTableHeader>
                <DataTableBody>
                  {detail.nodes.map((node: NodeRow) => (
                    <DataTableRow key={node.id}>
                      <DataTableCell className="font-medium text-[var(--ink)]">{node.nodeKey}</DataTableCell>
                      <DataTableCell>{node.agentName}</DataTableCell>
                      <DataTableCell>
                        <Badge variant={statusVariant(node.status)}>{translateStatus(node.status)}</Badge>
                      </DataTableCell>
                      <DataTableCell align="center">{node.attemptLabel}</DataTableCell>
                      <DataTableCell align="center">{node.dependencyCount}</DataTableCell>
                    </DataTableRow>
                  ))}
                </DataTableBody>
              </DataTable>
            </PanelBody>
          </Panel>

          <Panel>
            <PanelHeader eyebrow="Stages" title="调用阶段" description="从上下文组装到输出收尾的执行检查点。" />
            <PanelBody className="p-0">
              <DataTable>
                <DataTableHeader>
                  <DataTableRow>
                    <DataTableHead align="center">#</DataTableHead>
                    <DataTableHead>阶段</DataTableHead>
                    <DataTableHead>责任模块</DataTableHead>
                    <DataTableHead>说明</DataTableHead>
                  </DataTableRow>
                </DataTableHeader>
                <DataTableBody>
                  {detail.invocationStages.map((stage, index) => (
                    <DataTableRow key={stage.key}>
                      <DataTableCell align="center" className="font-medium text-[var(--ink)]">{index + 1}</DataTableCell>
                      <DataTableCell className="font-medium text-[var(--ink)]">{stage.label}</DataTableCell>
                      <DataTableCell>{stage.owner}</DataTableCell>
                      <DataTableCell className="max-w-[520px] leading-6">{stage.description}</DataTableCell>
                    </DataTableRow>
                  ))}
                  {detail.invocationStages.length === 0 ? (
                    <DataTableRow>
                      <DataTableCell>暂无调用阶段数据。</DataTableCell>
                      <DataTableCell>{" "}</DataTableCell>
                      <DataTableCell>{" "}</DataTableCell>
                      <DataTableCell>{" "}</DataTableCell>
                    </DataTableRow>
                  ) : null}
                </DataTableBody>
              </DataTable>
            </PanelBody>
          </Panel>

          <Panel>
            <PanelHeader eyebrow="Audit Trail" title="执行轨迹" description="按 fold group 保留原始执行事件，便于审计和复盘。" />
            <PanelBody className="space-y-4">
              {eventGroups.length === 0 ? (
                <EmptyState>暂无执行事件。</EmptyState>
              ) : (
                eventGroups.map(([group, events]) => (
                  <section key={group} className="space-y-2">
                    <div className="flex items-center justify-between gap-3 border-b border-[var(--line)] pb-2">
                      <div className="text-sm font-semibold text-[var(--ink)]">{group}</div>
                      <div className="text-xs text-[var(--ink-muted)]">{events.length} 条事件</div>
                    </div>
                    <DataTable>
                      <DataTableHeader>
                        <DataTableRow>
                          <DataTableHead align="center">Seq</DataTableHead>
                          <DataTableHead>阶段</DataTableHead>
                          <DataTableHead>事件</DataTableHead>
                          <DataTableHead>时间</DataTableHead>
                        </DataTableRow>
                      </DataTableHeader>
                      <DataTableBody>
                        {events.map((event) => (
                          <DataTableRow key={event.id}>
                            <DataTableCell align="center" className="font-medium text-[var(--ink)]">{event.seq}</DataTableCell>
                            <DataTableCell>{event.phase}</DataTableCell>
                            <DataTableCell className="max-w-[560px]">
                              <div className="font-medium text-[var(--ink)]">{localizeDemoCopy(event.title)}</div>
                              <div className="mt-1 leading-6">{localizeDemoCopy(event.content)}</div>
                            </DataTableCell>
                            <DataTableCell>{formatDateTime(event.createdAt)}</DataTableCell>
                          </DataTableRow>
                        ))}
                      </DataTableBody>
                    </DataTable>
                  </section>
                ))
              )}
            </PanelBody>
          </Panel>

          <Panel>
            <PanelHeader eyebrow="Events" title="标准事件流" description="统一 Provider 事件、工具事件和状态事件。" />
            <PanelBody className="p-0">
              <DataTable>
                <DataTableHeader>
                  <DataTableRow>
                    <DataTableHead>事件类型</DataTableHead>
                    <DataTableHead>可见性</DataTableHead>
                    <DataTableHead>摘要</DataTableHead>
                    <DataTableHead>时间</DataTableHead>
                  </DataTableRow>
                </DataTableHeader>
                <DataTableBody>
                  {detail.kernel.events.map((event) => (
                    <DataTableRow key={event.id}>
                      <DataTableCell className="font-medium text-[var(--ink)]">{event.eventType}</DataTableCell>
                      <DataTableCell>
                        <Badge variant="neutral">{event.visibility}</Badge>
                      </DataTableCell>
                      <DataTableCell className="max-w-[520px] leading-6">{String(event.payload.title ?? "")}</DataTableCell>
                      <DataTableCell>{formatDateTime(event.eventTime)}</DataTableCell>
                    </DataTableRow>
                  ))}
                  {detail.kernel.events.length === 0 ? (
                    <DataTableRow>
                      <DataTableCell>暂无标准事件。</DataTableCell>
                      <DataTableCell>{" "}</DataTableCell>
                      <DataTableCell>{" "}</DataTableCell>
                      <DataTableCell>{" "}</DataTableCell>
                    </DataTableRow>
                  ) : null}
                </DataTableBody>
              </DataTable>
            </PanelBody>
          </Panel>

          <Panel>
            <PanelHeader eyebrow="Findings" title="Finding 输出" description="本次运行产出的标准化问题、建议和置信度。" />
            <PanelBody className="p-0">
              <DataTable>
                <DataTableHeader>
                  <DataTableRow>
                    <DataTableHead>Finding</DataTableHead>
                    <DataTableHead>严重度</DataTableHead>
                    <DataTableHead>来源</DataTableHead>
                    <DataTableHead align="right">置信度</DataTableHead>
                    <DataTableHead>状态</DataTableHead>
                  </DataTableRow>
                </DataTableHeader>
                <DataTableBody>
                  {detail.kernel.findings.map((finding) => (
                    <DataTableRow key={finding.id}>
                      <DataTableCell className="max-w-[560px]">
                        <div className="font-medium text-[var(--ink)]">{finding.title}</div>
                        <div className="mt-1 leading-6">{finding.description}</div>
                        <div className="mt-2 text-xs text-[var(--ink-muted)]">建议: {finding.recommendation}</div>
                      </DataTableCell>
                      <DataTableCell>
                        <Badge variant={severityVariant(finding.severity)}>
                          {finding.severity} · {finding.category}
                        </Badge>
                      </DataTableCell>
                      <DataTableCell>{finding.sourceAgent}</DataTableCell>
                      <DataTableCell align="right">{formatPercent(finding.confidence)}</DataTableCell>
                      <DataTableCell>
                        <Badge variant={statusVariant(finding.status)}>{translateStatus(finding.status)}</Badge>
                      </DataTableCell>
                    </DataTableRow>
                  ))}
                  {detail.kernel.findings.length === 0 ? (
                    <DataTableRow>
                      <DataTableCell>暂无 Finding 输出。</DataTableCell>
                      <DataTableCell>{" "}</DataTableCell>
                      <DataTableCell>{" "}</DataTableCell>
                      <DataTableCell>{" "}</DataTableCell>
                      <DataTableCell>{" "}</DataTableCell>
                    </DataTableRow>
                  ) : null}
                </DataTableBody>
              </DataTable>
            </PanelBody>
          </Panel>
        </main>

        <aside className="space-y-6">
          <Panel>
            <PanelHeader eyebrow="Summary" title="运行摘要" description="主体对象、来源、时间和幂等信息。" />
            <PanelBody>
              <DefinitionList
                columnsClassName="grid-cols-1"
                items={[
                  { label: "任务蓝图", value: detail.kernel.blueprint?.name ?? "未绑定" },
                  { label: "租户空间", value: detail.tenantSpace?.name ?? "未知租户空间" },
                  { label: "业务团队", value: detail.businessTeam?.name ?? "未知业务团队" },
                  { label: "Agent 团队", value: detail.team?.name ?? "未知 Agent 团队" },
                  { label: "提交人", value: detail.taskRun.requestedBy },
                  { label: "来源", value: translateSourceType(detail.taskRun.sourceType), detail: detail.taskRun.sourceRef ?? "无来源引用" },
                  { label: "Trace ID", value: detail.taskRun.traceId },
                  { label: "幂等键", value: detail.taskRun.idempotencyKey ?? "无" },
                  { label: "创建时间", value: formatDateTime(detail.taskRun.createdAt) },
                  { label: "完成时间", value: detail.taskRun.completedAt ? formatDateTime(detail.taskRun.completedAt) : "未完成" },
                ]}
              />
            </PanelBody>
          </Panel>

          {detail.kernel.blueprint ? (
            <Panel>
              <PanelHeader eyebrow="Blueprint" title="蓝图快照" description="本次运行绑定的蓝图版本。" />
              <PanelBody>
                <DefinitionList
                  columnsClassName="grid-cols-1"
                  items={[
                    { label: "名称", value: detail.kernel.blueprint.name },
                    { label: "类别", value: detail.kernel.blueprint.category },
                    { label: "版本", value: `v${detail.kernel.blueprint.version}` },
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
              <PanelBody>
                <div className="space-y-3">
                  {detail.kernel.agentTeamRunPlan.workers.map((worker) => (
                    <div key={`${worker.agent}-${worker.task}`} className="border-b border-[var(--line)] pb-3 last:border-b-0 last:pb-0">
                      <div className="text-sm font-medium text-[var(--ink)]">{worker.agentName}</div>
                      <div className="mt-1 text-sm leading-6 text-[var(--ink-muted)]">{worker.task}</div>
                    </div>
                  ))}
                </div>
              </PanelBody>
            </Panel>
          ) : null}

          {detail.accessGrant ? (
            <Panel>
              <PanelHeader eyebrow="Access Grant" title="跨团队授权" description={detail.accessGrant.serviceAccountRef} />
              <PanelBody>
                <DefinitionList
                  columnsClassName="grid-cols-1"
                  items={[
                    { label: "状态", value: translateStatus(detail.accessGrant.status) },
                    { label: "动作范围", value: <CompactList items={detail.accessGrant.scope.actions ?? []} /> },
                    { label: "工具范围", value: <CompactList items={detail.accessGrant.scope.tools ?? []} /> },
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
                <DefinitionList
                  columnsClassName="grid-cols-1"
                  items={[
                    { label: "允许工具", value: <CompactList items={detail.executionPolicy.allowedTools} /> },
                    { label: "需人工批准", value: <CompactList items={detail.executionPolicy.approvalRequiredTools} /> },
                    { label: "阻断工具", value: <CompactList items={detail.executionPolicy.blockedTools} /> },
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
            <PanelHeader eyebrow="Provider" title="Provider 选择依据" description="调度前的模型接口选择说明。" />
            <PanelBody>
              <ul className="space-y-2 text-sm leading-6 text-[var(--ink-muted)]">
                {detail.providerRationale.map((line) => (
                  <li key={line} className="border-b border-[var(--line)] pb-2 last:border-b-0 last:pb-0">
                    {line}
                  </li>
                ))}
              </ul>
            </PanelBody>
          </Panel>

          <Panel>
            <PanelHeader eyebrow="Interventions" title="人工干预记录" description="审批门禁和人工决策请求。" />
            <PanelBody className="p-0">
              <DataTable>
                <DataTableHeader>
                  <DataTableRow>
                    <DataTableHead>动作</DataTableHead>
                    <DataTableHead>状态</DataTableHead>
                    <DataTableHead>时间</DataTableHead>
                  </DataTableRow>
                </DataTableHeader>
                <DataTableBody>
                  {detail.interventions.map((intervention: InterventionRow) => (
                    <DataTableRow key={intervention.id}>
                      <DataTableCell className="max-w-[220px] font-medium text-[var(--ink)]">
                        {localizeDemoCopy(intervention.requestedAction)}
                      </DataTableCell>
                      <DataTableCell>
                        <Badge variant={statusVariant(intervention.status)}>
                          {translateStatus(intervention.status)}
                        </Badge>
                      </DataTableCell>
                      <DataTableCell>{formatDateTime(intervention.requestedAt)}</DataTableCell>
                    </DataTableRow>
                  ))}
                  {detail.interventions.length === 0 ? (
                    <DataTableRow>
                      <DataTableCell>暂无人工干预。</DataTableCell>
                      <DataTableCell>{" "}</DataTableCell>
                      <DataTableCell>{" "}</DataTableCell>
                    </DataTableRow>
                  ) : null}
                </DataTableBody>
              </DataTable>
            </PanelBody>
          </Panel>

          {detail.executionInsights ? (
            <Panel>
              <PanelHeader eyebrow="Metrics" title="执行指标" description="吞吐、失败和人工介入水平。" />
              <PanelBody>
                <DefinitionList
                  columnsClassName="grid-cols-1"
                  items={[
                    { label: "吞吐率", value: formatPercent(detail.executionInsights.metrics.throughput) },
                    { label: "失败率", value: formatPercent(detail.executionInsights.metrics.failureRate) },
                    { label: "人工介入率", value: formatPercent(detail.executionInsights.metrics.humanInterventionRate) },
                    { label: "失败可恢复率", value: formatPercent(detail.executionInsights.metrics.retryRecoveryPotential) },
                  ]}
                />
              </PanelBody>
            </Panel>
          ) : null}

          {detail.costBreakdown ? (
            <Panel>
              <PanelHeader eyebrow="Costs" title="成本明细" description="估算与实际消耗对照。" />
              <PanelBody>
                <DefinitionList
                  columnsClassName="grid-cols-1"
                  items={[
                    { label: "运行估算", value: formatCurrency(detail.costBreakdown.estimatedUsd) },
                    { label: "运行实际", value: formatCurrency(detail.costBreakdown.actualUsd) },
                    { label: "任务记录估算", value: formatCurrency(detail.costBreakdown.estimateFromTaskRun) },
                    { label: "任务记录实际", value: formatCurrency(detail.costBreakdown.actualFromTaskRun) },
                  ]}
                />
              </PanelBody>
            </Panel>
          ) : null}

          {detail.kernel.environmentSnapshot ? (
            <Panel>
              <PanelHeader eyebrow="Environment" title="环境快照" description="仓库、执行路径与凭据绑定。" />
              <PanelBody>
                <JsonBlock value={detail.kernel.environmentSnapshot} />
              </PanelBody>
            </Panel>
          ) : null}

          <Panel>
            <PanelHeader eyebrow="Permissions" title="权限快照" description="本次运行实际生效的权限规则。" />
            <PanelBody>
              <JsonBlock value={detail.kernel.permissionSnapshot} />
            </PanelBody>
          </Panel>
        </aside>
      </div>
    </div>
  );
}
