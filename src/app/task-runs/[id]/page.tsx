import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { PageHeader } from "@/components/page-header";
import { TaskRunFindingActions } from "@/components/task-run-finding-actions";
import { TaskRunOpsConsole } from "@/components/task-run-ops-console";
import { TaskRunTeamNoteForm } from "@/components/task-run-team-note-form";
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
import { formatDateTime, formatNumber, formatPercent } from "@/lib/utils";
import { getTaskRunDetail } from "@/server/queries";

type TaskRunDetail = NonNullable<ReturnType<typeof getTaskRunDetail>>;
type TaskRunFinding = TaskRunDetail["kernel"]["findings"][number];
type TaskRunTeamActivity = TaskRunDetail["teamActivity"];
type TaskRunTeamActivityItem = TaskRunTeamActivity["items"][number];

function taskRunDetailText(key: string, params?: Record<string, string | number>) {
  return uiText(`ui.taskRunDetail.${key}`, undefined, params);
}

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
  if (["critical", "high"].includes(severity)) return "danger";
  if (severity === "medium") return "warning";
  if (severity === "low") return "accent";
  if (severity === "info") return "neutral";
  return "neutral";
}

function teamActivityVariant(kind: TaskRunTeamActivityItem["kind"]): "neutral" | "accent" | "success" | "warning" | "danger" {
  if (kind === "blocker" || kind === "policy") return "danger";
  if (kind === "gate") return "warning";
  if (kind === "decision" || kind === "handoff") return "accent";
  if (kind === "remediation" || kind === "cleanup") return "success";
  return "neutral";
}

function eventGroupLabel(group: string) {
  const keyByGroup: Record<string, string> = {
    "Team Actions": "events.groups.teamActions",
    "Human Actions": "events.groups.humanActions",
    Planning: "events.groups.planning",
    Analysis: "events.groups.analysis",
    Execution: "events.groups.execution",
    Synthesis: "events.groups.synthesis",
  };
  const key = keyByGroup[group];
  return key ? taskRunDetailText(key) : localizeDemoCopy(group);
}

function CompactList({ items }: { items: string[] }) {
  if (items.length === 0) return <span>{taskRunDetailText("common.none")}</span>;

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

function evidenceText(finding: TaskRunFinding, keys: string[]) {
  for (const key of keys) {
    const value = finding.evidence[key];
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
  }
  return null;
}

function findingLocation(finding: TaskRunFinding) {
  const filePath = evidenceText(finding, ["file_path", "filePath", "path"]);
  const line = evidenceText(finding, ["line_start", "lineStart", "line_number", "lineNumber"]);
  if (!filePath) return taskRunDetailText("findings.noLocation");
  return line ? `${filePath}:${line}` : filePath;
}

function activeFindingCount(findings: TaskRunFinding[]) {
  return findings.filter((finding) => !["fixed", "ignored", "false_positive", "deleted"].includes(finding.status)).length;
}

function highRiskFindingCount(findings: TaskRunFinding[]) {
  return findings.filter((finding) => ["critical", "high"].includes(finding.severity)).length;
}

function participantCount(detail: TaskRunDetail) {
  const names = new Set<string>();
  const plan = detail.kernel.agentTeamRunPlan;
  if (plan?.leader?.agentName) names.add(plan.leader.agentName);
  for (const worker of plan?.workers ?? []) {
    if (worker.agentName) names.add(worker.agentName);
  }
  for (const node of detail.nodes) {
    if (node.agentName) names.add(node.agentName);
  }
  return names.size;
}

function nextAction(detail: TaskRunDetail) {
  const pendingInterventions = detail.interventions.filter((intervention) => intervention.status === "pending");
  const failedNodes = detail.nodes.filter((node) => node.status === "failed");
  const findings = detail.kernel.findings;
  const activeCount = activeFindingCount(findings);
  const highRiskCount = highRiskFindingCount(findings);

  if (pendingInterventions.length > 0) {
    return {
      label: taskRunDetailText("brief.nextAction.pendingApproval"),
      detail: taskRunDetailText("brief.nextAction.pendingApprovalDetail", { count: pendingInterventions.length }),
      variant: "warning" as const,
    };
  }
  if (failedNodes.length > 0 || detail.taskRun.status === "failed") {
    return {
      label: taskRunDetailText("brief.nextAction.failed"),
      detail: taskRunDetailText("brief.nextAction.failedDetail", { count: failedNodes.length }),
      variant: "danger" as const,
    };
  }
  if (highRiskCount > 0) {
    return {
      label: taskRunDetailText("brief.nextAction.highRisk"),
      detail: taskRunDetailText("brief.nextAction.highRiskDetail", { count: highRiskCount }),
      variant: "danger" as const,
    };
  }
  if (activeCount > 0) {
    return {
      label: taskRunDetailText("brief.nextAction.triageFindings"),
      detail: taskRunDetailText("brief.nextAction.triageFindingsDetail", { count: activeCount }),
      variant: "accent" as const,
    };
  }
  if (["running", "queued", "preparing_environment", "publishing_output"].includes(detail.taskRun.runState)) {
    return {
      label: taskRunDetailText("brief.nextAction.monitor"),
      detail: taskRunDetailText("brief.nextAction.monitorDetail"),
      variant: "accent" as const,
    };
  }
  return {
    label: taskRunDetailText("brief.nextAction.review"),
    detail: taskRunDetailText("brief.nextAction.reviewDetail"),
    variant: "success" as const,
  };
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
        eyebrow="ui.taskRunDetail.workflow.eyebrow"
        title="ui.taskRunDetail.workflow.title"
        description={
          progress.currentStep
            ? taskRunDetailText("workflow.currentStep", { step: progress.currentStep.label })
            : "ui.taskRunDetail.workflow.completed"
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
                      {step.kind === "harness" ? "ui.taskRunDetail.stageKind.harness" : "ui.taskRunDetail.stageKind.model"}
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

function TeamExecutionBriefPanel({ detail }: { detail: TaskRunDetail }) {
  const findings = detail.kernel.findings;
  const pendingInterventionCount = detail.interventions.filter((intervention) => intervention.status === "pending").length;
  const currentStep = detail.workflowProgress.currentStep;
  const latestEvent = detail.workflowProgress.latestEvent;
  const action = nextAction(detail);

  return (
    <Panel>
      <PanelHeader
        eyebrow="ui.taskRunDetail.brief.eyebrow"
        title="ui.taskRunDetail.brief.title"
        description="ui.taskRunDetail.brief.description"
        action={<Badge variant={action.variant}>{action.label}</Badge>}
      />
      <PanelBody className="space-y-5">
        <SummaryStrip
          gridClassName="sm:grid-cols-2 xl:grid-cols-4"
          items={[
            {
              label: "ui.taskRunDetail.brief.metrics.progress",
              value: `${detail.workflowProgress.percent}%`,
              detail: taskRunDetailText("brief.metrics.progressDetail", {
                completed: detail.workflowProgress.completedCount,
                total: detail.workflowProgress.totalCount,
              }),
              tone: "accent",
            },
            {
              label: "ui.taskRunDetail.brief.metrics.activeFindings",
              value: formatNumber(activeFindingCount(findings)),
              detail: taskRunDetailText("brief.metrics.highRiskDetail", { count: highRiskFindingCount(findings) }),
            },
            {
              label: "ui.taskRunDetail.brief.metrics.interventions",
              value: formatNumber(pendingInterventionCount),
              detail: pendingInterventionCount > 0
                ? "ui.taskRunDetail.brief.metrics.interventionsWaiting"
                : "ui.taskRunDetail.brief.metrics.interventionsClear",
            },
            {
              label: "ui.taskRunDetail.brief.metrics.participants",
              value: formatNumber(participantCount(detail)),
              detail: detail.team?.name ?? "ui.taskRunDetail.common.unboundTeam",
            },
          ]}
        />

        <div className="grid gap-3 lg:grid-cols-3">
          <section className="rounded-lg border border-[var(--line)] bg-[var(--surface-muted)]/65 p-4">
            <div className="text-xs font-medium uppercase tracking-[0.12em] text-[var(--ink-subtle)]">
              {taskRunDetailText("brief.cards.currentStage")}
            </div>
            <div className="mt-2 text-sm font-semibold text-[var(--ink)]">
              {currentStep?.label ?? taskRunDetailText("workflow.completed")}
            </div>
            <div className="mt-1 text-xs leading-5 text-[var(--ink-muted)]">
              {currentStep ? `${currentStep.owner} · ${translateStatus(currentStep.status)}` : taskRunDetailText("brief.cards.noCurrentStage")}
            </div>
          </section>
          <section className="rounded-lg border border-[var(--line)] bg-[var(--surface-muted)]/65 p-4">
            <div className="text-xs font-medium uppercase tracking-[0.12em] text-[var(--ink-subtle)]">
              {taskRunDetailText("brief.cards.nextAction")}
            </div>
            <div className="mt-2 text-sm font-semibold text-[var(--ink)]">{action.label}</div>
            <div className="mt-1 text-xs leading-5 text-[var(--ink-muted)]">{action.detail}</div>
          </section>
          <section className="rounded-lg border border-[var(--line)] bg-[var(--surface-muted)]/65 p-4">
            <div className="text-xs font-medium uppercase tracking-[0.12em] text-[var(--ink-subtle)]">
              {taskRunDetailText("brief.cards.latestSignal")}
            </div>
            <div className="mt-2 text-sm font-semibold text-[var(--ink)]">
              {latestEvent?.title ? localizeDemoCopy(latestEvent.title) : taskRunDetailText("brief.cards.noLatestSignal")}
            </div>
            <div className="mt-1 text-xs leading-5 text-[var(--ink-muted)]">
              {latestEvent ? `${latestEvent.phase} · ${formatDateTime(latestEvent.createdAt)}` : taskRunDetailText("brief.cards.noLatestSignalDetail")}
            </div>
          </section>
        </div>
      </PanelBody>
    </Panel>
  );
}

function FindingsPanel({ taskRunId, findings }: { taskRunId: string; findings: TaskRunFinding[] }) {
  const activeCount = activeFindingCount(findings);

  return (
    <Panel>
      <PanelHeader
        eyebrow="ui.taskRunDetail.findings.eyebrow"
        title="ui.taskRunDetail.findings.title"
        description="ui.taskRunDetail.findings.description"
        action={<Badge variant={activeCount > 0 ? "warning" : "success"}>{taskRunDetailText("findings.activeCount", { count: activeCount })}</Badge>}
      />
      <PanelBody className="p-0">
        {findings.length === 0 ? (
          <div className="px-6 py-5">
            <EmptyState>ui.taskRunDetail.findings.empty</EmptyState>
          </div>
        ) : (
          <DataTable>
            <DataTableHeader>
              <DataTableRow>
                <DataTableHead>ui.taskRunDetail.findings.columns.severity</DataTableHead>
                <DataTableHead>ui.taskRunDetail.findings.columns.finding</DataTableHead>
                <DataTableHead>ui.taskRunDetail.findings.columns.evidence</DataTableHead>
                <DataTableHead>ui.taskRunDetail.findings.columns.status</DataTableHead>
                <DataTableHead>ui.taskRunDetail.findings.columns.recommendation</DataTableHead>
                <DataTableHead>ui.taskRunDetail.findings.columns.actions</DataTableHead>
              </DataTableRow>
            </DataTableHeader>
            <DataTableBody>
              {findings.map((finding) => (
                <DataTableRow key={finding.id}>
                  <DataTableCell>
                    <Badge variant={severityVariant(finding.severity)}>{finding.severity}</Badge>
                  </DataTableCell>
                  <DataTableCell className="min-w-[260px]">
                    <div className="font-medium text-[var(--ink)]">{localizeDemoCopy(finding.title)}</div>
                    <div className="mt-1 line-clamp-2 text-xs leading-5 text-[var(--ink-muted)]">
                      {localizeDemoCopy(finding.description)}
                    </div>
                  </DataTableCell>
                  <DataTableCell className="min-w-[220px]">
                    <code className="rounded-md bg-[var(--surface-muted)] px-2 py-1 text-xs text-[var(--ink)]">
                      {findingLocation(finding)}
                    </code>
                    <div className="mt-1 text-xs text-[var(--ink-muted)]">{finding.category}</div>
                  </DataTableCell>
                  <DataTableCell>
                    <Badge variant={statusVariant(finding.status)}>{translateStatus(finding.status)}</Badge>
                  </DataTableCell>
                  <DataTableCell className="max-w-[360px] leading-6">
                    {localizeDemoCopy(finding.recommendation || taskRunDetailText("findings.noRecommendation"))}
                  </DataTableCell>
                  <DataTableCell>
                    <TaskRunFindingActions
                      taskRunId={taskRunId}
                      findingId={finding.id}
                      currentStatus={finding.status}
                      feedbackPath={finding.feedbackPath}
                      latestFeedback={finding.latestFeedback}
                      assignment={finding.assignment}
                    />
                  </DataTableCell>
                </DataTableRow>
              ))}
            </DataTableBody>
          </DataTable>
        )}
      </PanelBody>
    </Panel>
  );
}

function TeamActivityItemRow({ item }: { item: TaskRunTeamActivityItem }) {
  return (
    <li className="border-b border-[var(--line)] py-3 first:pt-0 last:border-b-0 last:pb-0">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={teamActivityVariant(item.kind)}>
          {taskRunDetailText(`teamActivity.kinds.${item.kind}`)}
        </Badge>
        <span className="text-xs text-[var(--ink-muted)]">
          {item.actor
            ? taskRunDetailText("teamActivity.actor", { actor: item.actor })
            : taskRunDetailText("teamActivity.systemActor")}
        </span>
      </div>
      <div className="mt-2 text-sm font-medium leading-6 text-[var(--ink)]">
        {localizeDemoCopy(item.title)}
      </div>
      <div className="mt-1 text-sm leading-6 text-[var(--ink-muted)]">
        {localizeDemoCopy(item.content)}
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[var(--ink-subtle)]">
        <span>{formatDateTime(item.createdAt)}</span>
        {item.target ? <span>{taskRunDetailText("teamActivity.target", { target: item.target })}</span> : null}
      </div>
    </li>
  );
}

function TeamActivityPanel({ activity }: { activity: TaskRunTeamActivity }) {
  return (
    <Panel>
      <PanelHeader
        eyebrow="ui.taskRunDetail.teamActivity.eyebrow"
        title="ui.taskRunDetail.teamActivity.title"
        description="ui.taskRunDetail.teamActivity.description"
        action={
          <Badge variant={activity.blockerCount > 0 ? "warning" : activity.totalCount > 0 ? "accent" : "neutral"}>
            {taskRunDetailText("teamActivity.actionCount", { count: activity.totalCount })}
          </Badge>
        }
      />
      <PanelBody className="space-y-5">
        <SummaryStrip
          gridClassName="grid-cols-2"
          items={[
            {
              label: "ui.taskRunDetail.teamActivity.metrics.blockers",
              value: formatNumber(activity.blockerCount),
              detail: "ui.taskRunDetail.teamActivity.metrics.blockersDetail",
              tone: activity.blockerCount > 0 ? "accent" : "default",
            },
            {
              label: "ui.taskRunDetail.teamActivity.metrics.handoffs",
              value: formatNumber(activity.handoffCount),
              detail: "ui.taskRunDetail.teamActivity.metrics.handoffsDetail",
            },
            {
              label: "ui.taskRunDetail.teamActivity.metrics.findingActions",
              value: formatNumber(activity.findingActionCount),
              detail: "ui.taskRunDetail.teamActivity.metrics.findingActionsDetail",
            },
            {
              label: "ui.taskRunDetail.teamActivity.metrics.gates",
              value: formatNumber(activity.gateActionCount),
              detail: "ui.taskRunDetail.teamActivity.metrics.gatesDetail",
            },
          ]}
        />

        {activity.latestHandoff ? (
          <section className="border-y border-[var(--line)] py-4">
            <div className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--ink-subtle)]">
              {taskRunDetailText("teamActivity.latestHandoff")}
            </div>
            <div className="mt-2 text-sm font-medium leading-6 text-[var(--ink)]">
              {localizeDemoCopy(activity.latestHandoff.title)}
            </div>
            <div className="mt-1 text-sm leading-6 text-[var(--ink-muted)]">
              {localizeDemoCopy(activity.latestHandoff.content)}
            </div>
          </section>
        ) : null}

        <div>
          <div className="mb-3 text-xs font-semibold uppercase tracking-[0.12em] text-[var(--ink-subtle)]">
            {taskRunDetailText("teamActivity.recent")}
          </div>
          {activity.items.length === 0 ? (
            <EmptyState>ui.taskRunDetail.teamActivity.empty</EmptyState>
          ) : (
            <ol>
              {activity.items.map((item) => (
                <TeamActivityItemRow key={item.id} item={item} />
              ))}
            </ol>
          )}
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
        eyebrow="ui.taskRunDetail.header.eyebrow"
        title={detail.taskRun.sourceRef ?? detail.taskRun.sourceType}
        description="ui.taskRunDetail.header.description"
        badges={[
          { label: translateStatus(detail.taskRun.status), variant: statusVariant(detail.taskRun.status) },
          { label: translateStatus(detail.taskRun.runState), variant: statusVariant(detail.taskRun.runState) },
          { label: translateSourceType(detail.taskRun.sourceType), variant: "neutral" },
        ]}
      />

      <SummaryStrip
        gridClassName="sm:grid-cols-2"
        items={[
          {
            label: "ui.taskRunDetail.summary.runState",
            value: translateStatus(detail.taskRun.runState),
            detail: taskRunDetailText("summary.statusDetail", { status: translateStatus(detail.taskRun.status) }),
          },
          {
            label: "ui.taskRunDetail.summary.nodes",
            value: detail.nodes.length,
            detail: taskRunDetailText("summary.nodesDetail", {
              percent: detail.executionInsights?.metrics.throughput ? formatPercent(detail.executionInsights.metrics.throughput) : "0%",
            }),
          },
        ]}
      />

      <TeamExecutionBriefPanel detail={detail} />

      <TaskRunOpsConsole
        taskRunId={detail.taskRun.id}
        retryNodeId={detail.nodes.find((node: NodeRow) => node.status === "failed")?.id}
        pendingInterventionId={detail.interventions.find((intervention: InterventionRow) => intervention.status === "pending")?.id}
      />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <main className="space-y-6">
          <WorkflowProgressPanel progress={detail.workflowProgress} />

          <FindingsPanel taskRunId={detail.taskRun.id} findings={detail.kernel.findings} />

          <Panel>
            <PanelHeader
              eyebrow="ui.taskRunDetail.plan.eyebrow"
              title="ui.taskRunDetail.plan.title"
              description={detail.plan?.summary ? localizeDemoCopy(detail.plan.summary) : "ui.taskRunDetail.plan.description"}
            />
            <PanelBody className="p-0">
              <DataTable>
                <DataTableHeader>
                  <DataTableRow>
                    <DataTableHead>ui.taskRunDetail.plan.columns.node</DataTableHead>
                    <DataTableHead>ui.taskRunDetail.plan.columns.agent</DataTableHead>
                    <DataTableHead>ui.taskRunDetail.plan.columns.status</DataTableHead>
                    <DataTableHead align="center">ui.taskRunDetail.plan.columns.attempts</DataTableHead>
                    <DataTableHead align="center">ui.taskRunDetail.plan.columns.dependencies</DataTableHead>
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
            <PanelHeader
              eyebrow="ui.taskRunDetail.invocation.eyebrow"
              title="ui.taskRunDetail.invocation.title"
              description="ui.taskRunDetail.invocation.description"
            />
            <PanelBody className="p-0">
              <DataTable>
                <DataTableHeader>
                  <DataTableRow>
                    <DataTableHead align="center">#</DataTableHead>
                    <DataTableHead>ui.taskRunDetail.invocation.columns.stage</DataTableHead>
                    <DataTableHead>ui.taskRunDetail.invocation.columns.owner</DataTableHead>
                    <DataTableHead>ui.taskRunDetail.invocation.columns.description</DataTableHead>
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
                      <DataTableCell>ui.taskRunDetail.invocation.empty</DataTableCell>
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
            <PanelHeader
              eyebrow="ui.taskRunDetail.events.eyebrow"
              title="ui.taskRunDetail.events.title"
              description="ui.taskRunDetail.events.description"
            />
            <PanelBody className="space-y-4">
              {eventGroups.length === 0 ? (
                <EmptyState>ui.taskRunDetail.events.empty</EmptyState>
              ) : (
                eventGroups.map(([group, events]) => (
                  <section key={group} className="space-y-2">
                    <div className="flex items-center justify-between gap-3 border-b border-[var(--line)] pb-2">
                      <div className="text-sm font-semibold text-[var(--ink)]">{eventGroupLabel(group)}</div>
                      <div className="text-xs text-[var(--ink-muted)]">
                        {taskRunDetailText("events.count", { count: events.length })}
                      </div>
                    </div>
                    <DataTable>
                      <DataTableHeader>
                        <DataTableRow>
                          <DataTableHead align="center">ui.taskRunDetail.events.columns.seq</DataTableHead>
                          <DataTableHead>ui.taskRunDetail.events.columns.phase</DataTableHead>
                          <DataTableHead>ui.taskRunDetail.events.columns.content</DataTableHead>
                          <DataTableHead>ui.taskRunDetail.events.columns.time</DataTableHead>
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
            <PanelHeader
              eyebrow="ui.taskRunDetail.kernelEvents.eyebrow"
              title="ui.taskRunDetail.kernelEvents.title"
              description="ui.taskRunDetail.kernelEvents.description"
            />
            <PanelBody className="p-0">
              <DataTable>
                <DataTableHeader>
                  <DataTableRow>
                    <DataTableHead>ui.taskRunDetail.kernelEvents.columns.type</DataTableHead>
                    <DataTableHead>ui.taskRunDetail.kernelEvents.columns.visibility</DataTableHead>
                    <DataTableHead>ui.taskRunDetail.kernelEvents.columns.payload</DataTableHead>
                    <DataTableHead>ui.taskRunDetail.kernelEvents.columns.time</DataTableHead>
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
                      <DataTableCell>ui.taskRunDetail.kernelEvents.empty</DataTableCell>
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
          <TaskRunTeamNoteForm taskRunId={detail.taskRun.id} />

          <TeamActivityPanel activity={detail.teamActivity} />

          <Panel>
            <PanelHeader
              eyebrow="ui.taskRunDetail.context.eyebrow"
              title="ui.taskRunDetail.context.title"
              description="ui.taskRunDetail.context.description"
            />
            <PanelBody>
              <DefinitionList
                columnsClassName="grid-cols-1"
                items={[
                  { label: "ui.taskRunDetail.context.fields.blueprint", value: detail.kernel.blueprint?.name ?? "ui.taskRunDetail.common.unboundBlueprint" },
                  { label: "ui.taskRunDetail.context.fields.tenant", value: detail.tenantSpace?.name ?? "ui.taskRunDetail.common.unboundTenant" },
                  { label: "ui.taskRunDetail.context.fields.businessTeam", value: detail.businessTeam?.name ?? "ui.taskRunDetail.common.unboundBusinessTeam" },
                  { label: "ui.taskRunDetail.context.fields.agentTeam", value: detail.team?.name ?? "ui.taskRunDetail.common.unboundTeam" },
                  { label: "ui.taskRunDetail.context.fields.requestedBy", value: detail.taskRun.requestedBy },
                  { label: "ui.taskRunDetail.context.fields.source", value: translateSourceType(detail.taskRun.sourceType), detail: detail.taskRun.sourceRef ?? "ui.taskRunDetail.common.noSourceRef" },
                  { label: "ui.taskRunDetail.context.fields.traceId", value: detail.taskRun.traceId },
                  { label: "ui.taskRunDetail.context.fields.idempotencyKey", value: detail.taskRun.idempotencyKey ?? "ui.taskRunDetail.common.none" },
                  { label: "ui.taskRunDetail.context.fields.createdAt", value: formatDateTime(detail.taskRun.createdAt) },
                  { label: "ui.taskRunDetail.context.fields.completedAt", value: detail.taskRun.completedAt ? formatDateTime(detail.taskRun.completedAt) : "ui.taskRunDetail.common.notCompleted" },
                ]}
              />
            </PanelBody>
          </Panel>

          {detail.kernel.blueprint ? (
            <Panel>
              <PanelHeader
                eyebrow="ui.taskRunDetail.blueprint.eyebrow"
                title="ui.taskRunDetail.blueprint.title"
                description="ui.taskRunDetail.blueprint.description"
              />
              <PanelBody>
                <DefinitionList
                  columnsClassName="grid-cols-1"
                  items={[
                    { label: "ui.taskRunDetail.blueprint.fields.name", value: detail.kernel.blueprint.name },
                    { label: "ui.taskRunDetail.blueprint.fields.category", value: detail.kernel.blueprint.category },
                    { label: "ui.taskRunDetail.blueprint.fields.version", value: `v${detail.kernel.blueprint.version}` },
                    { label: "ui.taskRunDetail.blueprint.fields.trigger", value: String(detail.kernel.blueprint.trigger.type ?? "manual") },
                  ]}
                />
              </PanelBody>
            </Panel>
          ) : null}

          {detail.kernel.agentTeamRunPlan ? (
            <Panel>
              <PanelHeader
                eyebrow="ui.taskRunDetail.agentRunPlan.eyebrow"
                title="ui.taskRunDetail.agentRunPlan.title"
                description={taskRunDetailText("agentRunPlan.description", {
                  strategy: detail.kernel.agentTeamRunPlan.strategy,
                  leader: detail.kernel.agentTeamRunPlan.leader.agentName,
                })}
              />
              <PanelBody>
                <div className="space-y-3">
                  {detail.kernel.agentTeamRunPlan.workers.map((worker) => (
                    <div key={`${worker.agent}-${worker.task}`} className="border-b border-[var(--line)] pb-3 last:border-b-0 last:pb-0">
                      <div className="text-sm font-medium text-[var(--ink)]">
                        {worker.title ?? worker.agentName}
                      </div>
                      <div className="mt-1 text-xs text-[var(--ink-soft)]">
                        {worker.blockType ?? taskRunDetailText("stageKind.model")} · {worker.tool ?? "agent.execute"} · {worker.agentName}
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
              <PanelHeader
                eyebrow="ui.taskRunDetail.accessGrant.eyebrow"
                title="ui.taskRunDetail.accessGrant.title"
                description={detail.accessGrant.serviceAccountRef}
              />
              <PanelBody>
                <DefinitionList
                  columnsClassName="grid-cols-1"
                  items={[
                    { label: "ui.taskRunDetail.accessGrant.fields.status", value: translateStatus(detail.accessGrant.status) },
                    { label: "ui.taskRunDetail.accessGrant.fields.actions", value: <CompactList items={detail.accessGrant.scope.actions ?? []} /> },
                    { label: "ui.taskRunDetail.accessGrant.fields.tools", value: <CompactList items={detail.accessGrant.scope.tools ?? []} /> },
                    {
                      label: "ui.taskRunDetail.accessGrant.fields.sla",
                      value: `${detail.accessGrant.sla.responseSeconds ?? 0}s / ${Math.round((detail.accessGrant.sla.successRateFloor ?? 0) * 100)}%`,
                    },
                  ]}
                />
              </PanelBody>
            </Panel>
          ) : null}

          {detail.executionPolicy ? (
            <Panel>
              <PanelHeader
                eyebrow="ui.taskRunDetail.executionPolicy.eyebrow"
                title="ui.taskRunDetail.executionPolicy.title"
                description={detail.executionPolicy.name}
              />
              <PanelBody className="space-y-4">
                <p className="text-sm leading-6 text-[var(--ink-muted)]">{detail.executionPolicy.instruction}</p>
                <DefinitionList
                  columnsClassName="grid-cols-1"
                  items={[
                    { label: "ui.taskRunDetail.executionPolicy.fields.allowedTools", value: <CompactList items={detail.executionPolicy.allowedTools} /> },
                    { label: "ui.taskRunDetail.executionPolicy.fields.approvalRequiredTools", value: <CompactList items={detail.executionPolicy.approvalRequiredTools} /> },
                    { label: "ui.taskRunDetail.executionPolicy.fields.blockedTools", value: <CompactList items={detail.executionPolicy.blockedTools} /> },
                    { label: "ui.taskRunDetail.executionPolicy.fields.defaultLocale", value: detail.executionPolicy.safety.defaultLocale },
                    { label: "ui.taskRunDetail.executionPolicy.fields.collapseThinking", value: detail.executionPolicy.safety.collapseThinkingByDefault ? "ui.common.boolean.yes" : "ui.common.boolean.no" },
                  ]}
                />
              </PanelBody>
            </Panel>
          ) : null}

          <Panel>
            <PanelHeader
              eyebrow="ui.taskRunDetail.provider.eyebrow"
              title="ui.taskRunDetail.provider.title"
              description="ui.taskRunDetail.provider.description"
            />
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
            <PanelHeader
              eyebrow="ui.taskRunDetail.interventions.eyebrow"
              title="ui.taskRunDetail.interventions.title"
              description="ui.taskRunDetail.interventions.description"
            />
            <PanelBody className="p-0">
              <DataTable>
                <DataTableHeader>
                  <DataTableRow>
                    <DataTableHead>ui.taskRunDetail.interventions.columns.action</DataTableHead>
                    <DataTableHead>ui.taskRunDetail.interventions.columns.status</DataTableHead>
                    <DataTableHead>ui.taskRunDetail.interventions.columns.time</DataTableHead>
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
                      <DataTableCell>ui.taskRunDetail.interventions.empty</DataTableCell>
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
              <PanelHeader
                eyebrow="ui.taskRunDetail.insights.eyebrow"
                title="ui.taskRunDetail.insights.title"
                description="ui.taskRunDetail.insights.description"
              />
              <PanelBody>
                <DefinitionList
                  columnsClassName="grid-cols-1"
                  items={[
                    { label: "ui.taskRunDetail.insights.fields.throughput", value: formatPercent(detail.executionInsights.metrics.throughput) },
                    { label: "ui.taskRunDetail.insights.fields.failureRate", value: formatPercent(detail.executionInsights.metrics.failureRate) },
                    { label: "ui.taskRunDetail.insights.fields.humanInterventionRate", value: formatPercent(detail.executionInsights.metrics.humanInterventionRate) },
                    { label: "ui.taskRunDetail.insights.fields.retryRecoveryPotential", value: formatPercent(detail.executionInsights.metrics.retryRecoveryPotential) },
                  ]}
                />
              </PanelBody>
            </Panel>
          ) : null}

          {detail.kernel.environmentSnapshot ? (
            <Panel>
              <PanelHeader
                eyebrow="ui.taskRunDetail.environment.eyebrow"
                title="ui.taskRunDetail.environment.title"
                description="ui.taskRunDetail.environment.description"
              />
              <PanelBody>
                <JsonBlock value={detail.kernel.environmentSnapshot} />
              </PanelBody>
            </Panel>
          ) : null}

          <Panel>
            <PanelHeader
              eyebrow="ui.taskRunDetail.permission.eyebrow"
              title="ui.taskRunDetail.permission.title"
              description="ui.taskRunDetail.permission.description"
            />
            <PanelBody>
              <JsonBlock value={detail.kernel.permissionSnapshot} />
            </PanelBody>
          </Panel>
        </aside>
      </div>
    </div>
  );
}
