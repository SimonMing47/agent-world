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
import { uiText } from "@/lib/language-pack";
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

function formatCurrency(value: number) {
  return `$${value.toFixed(2)}`;
}

function CompactList({ items }: { items: string[] }) {
  if (items.length === 0) return <span>ui.generated.c72077749f7</span>;

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

type WorkflowProgress = NonNullable<ReturnType<typeof getTaskRunDetail>>["workflowProgress"];

function WorkflowProgressPanel({ progress }: { progress: WorkflowProgress }) {
  return (
    <Panel>
      <PanelHeader
        eyebrow="Workflow"
        title={uiText("ui.taskRunDetail.workflow.title")}
        description={
          progress.currentStep
            ? uiText("ui.taskRunDetail.workflow.currentStep", undefined, { step: progress.currentStep.label })
            : uiText("ui.taskRunDetail.workflow.completed")
        }
      />
      <PanelBody>
        <div className="mb-4 flex items-center justify-between gap-3">
          <div className="text-sm font-medium text-[var(--ink)]">
            {uiText("ui.taskRunDetail.workflow.completedRatio", undefined, {
              completed: progress.completedCount,
              total: progress.totalCount,
            })}
          </div>
          <Badge variant={progress.currentStep?.status === "failed" ? "danger" : progress.currentStep?.status === "awaiting" ? "warning" : "accent"}>
            {progress.percent}%
          </Badge>
        </div>
        <div className="space-y-3">
          {progress.steps.map((step, index) => (
            <div key={step.id} className="grid grid-cols-[2rem_minmax(0,1fr)] gap-3">
              <div className="relative flex justify-center">
                <span
                  className={
                    step.status === "completed"
                      ? "mt-1 h-4 w-4 rounded-full bg-[#16a34a]"
                      : step.status === "running"
                        ? "mt-1 h-4 w-4 rounded-full bg-[var(--accent)]"
                        : step.status === "awaiting"
                          ? "mt-1 h-4 w-4 rounded-full bg-[var(--warning)]"
                          : step.status === "failed"
                            ? "mt-1 h-4 w-4 rounded-full bg-[var(--danger)]"
                            : "mt-1 h-4 w-4 rounded-full bg-[var(--line-strong)]"
                  }
                />
                {index < progress.steps.length - 1 ? (
                  <span className="absolute top-6 bottom-[-0.75rem] w-px bg-[var(--line-strong)]" aria-hidden="true" />
                ) : null}
              </div>
              <div className="rounded-lg border border-[var(--line)] bg-[var(--surface-muted)]/65 px-3 py-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="font-medium text-[var(--ink)]">{step.label}</div>
                  <div className="flex items-center gap-2">
                    <Badge variant={step.kind === "harness" ? "neutral" : "accent"}>
                      {step.kind === "harness" ? "Harness" : "Model"}
                    </Badge>
                    <Badge variant={statusVariant(step.status)}>{translateStatus(step.status)}</Badge>
                  </div>
                </div>
                <div className="mt-1 text-xs leading-5 text-[var(--ink-muted)]">
                  {step.owner} · {step.detail}
                </div>
              </div>
            </div>
          ))}
        </div>
      </PanelBody>
    </Panel>
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

  const eventGroups = Object.entries(detail.groupedEvents);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="ui.generated.ca939e999ca"
        title={detail.taskRun.sourceRef ?? detail.taskRun.sourceType}
        description="ui.generated.c8a3289e545"
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
            label: "ui.generated.c2a4080ad9f",
            value: translateStatus(detail.taskRun.runState),
            detail: <>ui.generated.c4f49ffd119 {translateStatus(detail.taskRun.status)}</>,
          },
          {
            label: "ui.generated.ce840cd6f1e",
            value: detail.nodes.length,
            detail: <>{detail.executionInsights?.metrics.throughput ? formatPercent(detail.executionInsights.metrics.throughput) : "0%"} ui.common.completed</>,
          },
          {
            label: "ui.generated.c5354b098e2",
            value: formatCurrency(detail.taskRun.costActual),
            detail: <>ui.common.estimatePrefix {formatCurrency(detail.taskRun.costEstimate)}</>,
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
          <WorkflowProgressPanel progress={detail.workflowProgress} />

          <Panel>
            <PanelHeader
              eyebrow="ui.generated.c28febba225"
              title="ui.generated.cc96e332bca"
              description={detail.plan?.summary ? localizeDemoCopy(detail.plan.summary) : "ui.generated.ca8b782cc01"}
            />
            <PanelBody className="p-0">
              <DataTable>
                <DataTableHeader>
                  <DataTableRow>
                    <DataTableHead>ui.generated.ce840cd6f1e</DataTableHead>
                    <DataTableHead>Agent</DataTableHead>
                    <DataTableHead>ui.generated.c62e951a692</DataTableHead>
                    <DataTableHead align="center">ui.generated.c31d1e44656</DataTableHead>
                    <DataTableHead align="center">ui.generated.c33a12a7ba9</DataTableHead>
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
            <PanelHeader eyebrow="ui.generated.c4ca39faad0" title="ui.generated.c97cbaa1711" description="ui.generated.c13762e63f5" />
            <PanelBody className="p-0">
              <DataTable>
                <DataTableHeader>
                  <DataTableRow>
                    <DataTableHead align="center">#</DataTableHead>
                    <DataTableHead>ui.generated.c4ca39faad0</DataTableHead>
                    <DataTableHead>ui.generated.cf39e67d4b9</DataTableHead>
                    <DataTableHead>ui.generated.c26670dda42</DataTableHead>
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
                      <DataTableCell>ui.generated.cb9bdd531c7</DataTableCell>
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
            <PanelHeader eyebrow="ui.generated.c45da5e2d84" title="ui.generated.c2e2d00e345" description="ui.generated.c8f62f04612" />
            <PanelBody className="space-y-4">
              {eventGroups.length === 0 ? (
                <EmptyState>ui.generated.c3d32890e15</EmptyState>
              ) : (
                eventGroups.map(([group, events]) => (
                  <section key={group} className="space-y-2">
                    <div className="flex items-center justify-between gap-3 border-b border-[var(--line)] pb-2">
                      <div className="text-sm font-semibold text-[var(--ink)]">{group}</div>
                      <div className="text-xs text-[var(--ink-muted)]">{events.length} ui.generated.cee5f313268</div>
                    </div>
                    <DataTable>
                      <DataTableHeader>
                        <DataTableRow>
                          <DataTableHead align="center">Seq</DataTableHead>
                          <DataTableHead>ui.generated.c4ca39faad0</DataTableHead>
                          <DataTableHead>ui.generated.c550e328062</DataTableHead>
                          <DataTableHead>ui.generated.c89b4aa6364</DataTableHead>
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
            <PanelHeader eyebrow="ui.generated.c550e328062" title="ui.generated.cc58934da53" description="ui.generated.ca1fff15fb5" />
            <PanelBody className="p-0">
              <DataTable>
                <DataTableHeader>
                  <DataTableRow>
                    <DataTableHead>ui.generated.c5b2d75aa54</DataTableHead>
                    <DataTableHead>ui.generated.c747b74cec9</DataTableHead>
                    <DataTableHead>ui.generated.c46d4c1b4e4</DataTableHead>
                    <DataTableHead>ui.generated.c89b4aa6364</DataTableHead>
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
                      <DataTableCell>ui.generated.c4016f05ec9</DataTableCell>
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
            <PanelHeader eyebrow="ui.generated.c46d4c1b4e4" title="ui.generated.c535a2a9419" description="ui.generated.cd166e3d6aa" />
            <PanelBody>
              <DefinitionList
                columnsClassName="grid-cols-1"
                items={[
                  { label: "ui.generated.c2e17bc4894", value: detail.kernel.blueprint?.name ?? "ui.generated.c3bf179d8d0" },
                  { label: "ui.generated.c3db35d2741", value: detail.tenantSpace?.name ?? "ui.generated.cdad87f89f1" },
                  { label: "ui.generated.c2b90028ff3", value: detail.businessTeam?.name ?? "ui.generated.c7ae513bf4d" },
                  { label: "ui.generated.c70f970c1fc", value: detail.team?.name ?? "ui.generated.c603903ef14" },
                  { label: "ui.generated.c3c75f3646a", value: detail.taskRun.requestedBy },
                  { label: "ui.generated.cc63f79e636", value: translateSourceType(detail.taskRun.sourceType), detail: detail.taskRun.sourceRef ?? "ui.generated.cbaee8fc00e" },
                  { label: "Trace ID", value: detail.taskRun.traceId },
                  { label: "ui.generated.c11118f711c", value: detail.taskRun.idempotencyKey ?? "ui.generated.c72077749f7" },
                  { label: "ui.generated.c84e3802f60", value: formatDateTime(detail.taskRun.createdAt) },
                  { label: "ui.generated.c754a8a2e2d", value: detail.taskRun.completedAt ? formatDateTime(detail.taskRun.completedAt) : "ui.generated.cb61b08aec3" },
                ]}
              />
            </PanelBody>
          </Panel>

          {detail.kernel.blueprint ? (
            <Panel>
              <PanelHeader eyebrow="ui.generated.c6c72663ddb" title="ui.generated.cd82461b1da" description="ui.generated.c8f8b752ead" />
              <PanelBody>
                <DefinitionList
                  columnsClassName="grid-cols-1"
                  items={[
                    { label: "ui.generated.c1be7ae4fc2", value: detail.kernel.blueprint.name },
                    { label: "ui.generated.ced9f6d4d8e", value: detail.kernel.blueprint.category },
                    { label: "ui.generated.c989d1affa0", value: `v${detail.kernel.blueprint.version}` },
                    { label: "ui.generated.c2d189a3f46", value: String(detail.kernel.blueprint.trigger.type ?? "manual") },
                  ]}
                />
              </PanelBody>
            </Panel>
          ) : null}

          {detail.kernel.agentTeamRunPlan ? (
            <Panel>
              <PanelHeader
                eyebrow="ui.generated.c63881557e3"
                title="ui.generated.c47c3f7e80b"
                description={`${detail.kernel.agentTeamRunPlan.strategy} · Leader ${detail.kernel.agentTeamRunPlan.leader.agentName}`}
              />
              <PanelBody>
                <div className="space-y-3">
                  {detail.kernel.agentTeamRunPlan.workers.map((worker) => (
                    <div key={`${worker.agent}-${worker.task}`} className="border-b border-[var(--line)] pb-3 last:border-b-0 last:pb-0">
                      <div className="text-sm font-medium text-[var(--ink)]">
                        {worker.title ?? worker.agentName}
                      </div>
                      <div className="mt-1 text-xs text-[var(--ink-soft)]">
                        {worker.blockType ?? "agent"} · {worker.tool ?? "agent.execute"} · {worker.agentName}
                      </div>
                      <div className="mt-1 text-sm leading-6 text-[var(--ink-muted)]">{worker.task}</div>
                    </div>
                  ))}
                </div>
              </PanelBody>
            </Panel>
          ) : null}

          {detail.accessGrant ? (
            <Panel>
              <PanelHeader eyebrow="ui.generated.c3a6e607f0c" title="ui.generated.c2c4520c3e3" description={detail.accessGrant.serviceAccountRef} />
              <PanelBody>
                <DefinitionList
                  columnsClassName="grid-cols-1"
                  items={[
                    { label: "ui.generated.c62e951a692", value: translateStatus(detail.accessGrant.status) },
                    { label: "ui.generated.c89c12949bd", value: <CompactList items={detail.accessGrant.scope.actions ?? []} /> },
                    { label: "ui.generated.c2ff5d9099e", value: <CompactList items={detail.accessGrant.scope.tools ?? []} /> },
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
              <PanelHeader eyebrow="ui.generated.cf3c49831c6" title="ui.generated.c9b167bacc3" description={detail.executionPolicy.name} />
              <PanelBody className="space-y-4">
                <p className="text-sm leading-6 text-[var(--ink-muted)]">{detail.executionPolicy.instruction}</p>
                <DefinitionList
                  columnsClassName="grid-cols-1"
                  items={[
                    { label: "ui.generated.cae64ad83d4", value: <CompactList items={detail.executionPolicy.allowedTools} /> },
                    { label: "ui.generated.c05721ff529", value: <CompactList items={detail.executionPolicy.approvalRequiredTools} /> },
                    { label: "ui.generated.c7fcc2673a0", value: <CompactList items={detail.executionPolicy.blockedTools} /> },
                    {
                      label: "ui.generated.c0dcf0e012a",
                      value: `${detail.executionPolicy.budget.maxRuntimeMinutes} min / ${detail.executionPolicy.budget.maxSteps} steps / ${detail.executionPolicy.budget.maxToolCalls} tool calls`,
                    },
                    { label: "ui.generated.c607885d6d2", value: detail.executionPolicy.safety.defaultLocale },
                    { label: "ui.generated.c1c42609eaf", value: detail.executionPolicy.safety.collapseThinkingByDefault ? "ui.generated.c30160a21b9" : "ui.generated.c8bf5c10ad9" },
                  ]}
                />
              </PanelBody>
            </Panel>
          ) : null}

          <Panel>
            <PanelHeader eyebrow="ui.generated.cbc56f948bb" title="ui.generated.ced2bd2bf48" description="ui.generated.c5299224630" />
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
            <PanelHeader eyebrow="ui.generated.c8d8f100fb8" title="ui.generated.ced026e8593" description="ui.generated.c7d7af6731f" />
            <PanelBody className="p-0">
              <DataTable>
                <DataTableHeader>
                  <DataTableRow>
                    <DataTableHead>ui.generated.cd9d9827827</DataTableHead>
                    <DataTableHead>ui.generated.c62e951a692</DataTableHead>
                    <DataTableHead>ui.generated.c89b4aa6364</DataTableHead>
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
                      <DataTableCell>ui.generated.cadec1c5085</DataTableCell>
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
              <PanelHeader eyebrow="ui.generated.c1dfc810a7b" title="ui.generated.ce5e042d196" description="ui.generated.cc7282252c5" />
              <PanelBody>
                <DefinitionList
                  columnsClassName="grid-cols-1"
                  items={[
                    { label: "ui.generated.cf7433d17bd", value: formatPercent(detail.executionInsights.metrics.throughput) },
                    { label: "ui.generated.cc9951c649f", value: formatPercent(detail.executionInsights.metrics.failureRate) },
                    { label: "ui.generated.c6cc4015eb4", value: formatPercent(detail.executionInsights.metrics.humanInterventionRate) },
                    { label: "ui.generated.cb2509cb072", value: formatPercent(detail.executionInsights.metrics.retryRecoveryPotential) },
                  ]}
                />
              </PanelBody>
            </Panel>
          ) : null}

          {detail.costBreakdown ? (
            <Panel>
              <PanelHeader eyebrow="ui.generated.c5354b098e2" title="ui.generated.c9f89e5dcbd" description="ui.generated.ce8f2b3f9c3" />
              <PanelBody>
                <DefinitionList
                  columnsClassName="grid-cols-1"
                  items={[
                    { label: "ui.generated.c79437efdb6", value: formatCurrency(detail.costBreakdown.estimatedUsd) },
                    { label: "ui.generated.c1f118e1442", value: formatCurrency(detail.costBreakdown.actualUsd) },
                    { label: "ui.generated.cd0e0e8257e", value: formatCurrency(detail.costBreakdown.estimateFromTaskRun) },
                    { label: "ui.generated.c257cb670a4", value: formatCurrency(detail.costBreakdown.actualFromTaskRun) },
                  ]}
                />
              </PanelBody>
            </Panel>
          ) : null}

          {detail.kernel.environmentSnapshot ? (
            <Panel>
              <PanelHeader eyebrow="ui.generated.caa3833ea2a" title="ui.generated.c2f01454e91" description="ui.generated.c425eaa5447" />
              <PanelBody>
                <JsonBlock value={detail.kernel.environmentSnapshot} />
              </PanelBody>
            </Panel>
          ) : null}

          <Panel>
            <PanelHeader eyebrow="ui.generated.c560165a6d7" title="ui.generated.c15a9cfd4b8" description="ui.generated.c96b026a172" />
            <PanelBody>
              <JsonBlock value={detail.kernel.permissionSnapshot} />
            </PanelBody>
          </Panel>
        </aside>
      </div>
    </div>
  );
}
