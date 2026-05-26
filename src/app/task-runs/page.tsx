import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import {
  DataTable,
  DataTableBody,
  DataTableCell,
  DataTableHead,
  DataTableHeader,
  DataTableRow,
} from "@/components/ui/data-table";
import { Panel, PanelBody, PanelHeader } from "@/components/ui/panel";
import { SummaryStrip } from "@/components/ui/summary-strip";
import { uiText } from "@/lib/language-pack";
import { translateSourceType, translateStatus } from "@/lib/presentation";
import { formatDateTime } from "@/lib/utils";
import { getDashboardSnapshot } from "@/server/queries";

type DashboardSnapshot = ReturnType<typeof getDashboardSnapshot>;
type DashboardTaskRun = DashboardSnapshot["task_runs"][number];
type DashboardWorkflowProgress = DashboardSnapshot["taskRunWorkflowProgress"][string];
type DashboardTeamSummary = DashboardSnapshot["teamSummaries"][number];
type DashboardBusinessTeamSummary = DashboardSnapshot["businessTeamSummaries"][number];
type DashboardTaskBlueprintSummary = DashboardSnapshot["taskBlueprints"][number];
type KanbanColumnId = "intake" | "running" | "waiting" | "done" | "blocked";

function taskRunsText(key: string, params?: Record<string, string | number>) {
  return uiText(`ui.taskRuns.${key}`, undefined, params);
}

function workflowBadgeVariant(status: string): "neutral" | "accent" | "success" | "warning" | "danger" {
  if (["failed", "blocked", "rejected"].includes(status)) return "danger";
  if (["awaiting", "waiting_approval", "pending"].includes(status)) return "warning";
  if (["running", "queued", "preparing_environment", "publishing_output"].includes(status)) return "accent";
  if (["completed", "succeeded", "approved"].includes(status)) return "success";
  return "neutral";
}

function taskDisplayName(taskRun: DashboardTaskRun) {
  return taskRun.sourceRef ?? taskRun.idempotencyKey ?? taskRun.sourceType;
}

function initials(value: string) {
  return Array.from(value.trim() || "A").slice(0, 2).join("").toUpperCase();
}

function resolveKanbanColumn(taskRun: DashboardTaskRun, progress: DashboardWorkflowProgress | undefined): KanbanColumnId {
  const currentStatus = progress?.currentStep?.status;
  if (taskRun.status === "failed" || taskRun.runState === "failed" || currentStatus === "failed") return "blocked";
  if (taskRun.status === "completed" || taskRun.runState === "completed") return "done";
  if (taskRun.status === "awaiting" || taskRun.runState === "waiting_approval" || currentStatus === "awaiting") return "waiting";
  if (["queued", "preparing_environment"].includes(taskRun.runState) || progress?.currentStep?.kind === "harness") {
    return "intake";
  }
  return "running";
}

const kanbanColumns: Array<{
  id: KanbanColumnId;
  labelKey: string;
  descriptionKey: string;
  railClassName: string;
}> = [
  {
    id: "intake",
    labelKey: "kanban.columns.intake.label",
    descriptionKey: "kanban.columns.intake.description",
    railClassName: "bg-sky-500",
  },
  {
    id: "running",
    labelKey: "kanban.columns.running.label",
    descriptionKey: "kanban.columns.running.description",
    railClassName: "bg-cyan-500",
  },
  {
    id: "waiting",
    labelKey: "kanban.columns.waiting.label",
    descriptionKey: "kanban.columns.waiting.description",
    railClassName: "bg-amber-500",
  },
  {
    id: "done",
    labelKey: "kanban.columns.done.label",
    descriptionKey: "kanban.columns.done.description",
    railClassName: "bg-emerald-500",
  },
  {
    id: "blocked",
    labelKey: "kanban.columns.blocked.label",
    descriptionKey: "kanban.columns.blocked.description",
    railClassName: "bg-rose-500",
  },
];

function WorkflowProgressPreview({ progress }: { progress: DashboardWorkflowProgress | undefined }) {
  if (!progress) return <span className="text-xs text-[var(--ink-muted)]">{taskRunsText("workflowPreview.missing")}</span>;
  const visibleSteps = progress.steps.slice(0, 6);

  return (
    <div className="min-w-[260px]">
      <div className="flex items-center justify-between gap-3 text-xs">
        <span className="truncate font-medium text-[var(--ink)]">
          {progress.currentStep?.label ?? taskRunsText("workflowPreview.completed")}
        </span>
        <span className="shrink-0 text-[var(--ink-muted)]">{progress.completedCount}/{progress.totalCount}</span>
      </div>
      <div className="mt-2 grid grid-cols-[repeat(auto-fit,minmax(22px,1fr))] gap-1">
        {visibleSteps.map((step) => (
          <div
            key={step.id}
            title={`${step.label} · ${step.owner}`}
            className={
              step.status === "completed"
                ? "h-1.5 rounded-full bg-[#16a34a]"
                : step.status === "running"
                  ? "h-1.5 rounded-full bg-[var(--accent)]"
                  : step.status === "awaiting"
                    ? "h-1.5 rounded-full bg-[var(--warning)]"
                    : step.status === "failed"
                      ? "h-1.5 rounded-full bg-[var(--danger)]"
                      : "h-1.5 rounded-full bg-[var(--line-strong)]"
            }
          />
        ))}
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {visibleSteps.slice(0, 3).map((step) => (
          <Badge key={step.id} variant={workflowBadgeVariant(step.status)}>
            {step.kind === "harness" ? taskRunsText("stageKind.harness") : taskRunsText("stageKind.model")} · {step.label}
          </Badge>
        ))}
      </div>
    </div>
  );
}

function TaskKanbanCard({
  taskRun,
  progress,
  team,
  businessTeam,
  blueprint,
}: {
  taskRun: DashboardTaskRun;
  progress: DashboardWorkflowProgress | undefined;
  team: DashboardTeamSummary | undefined;
  businessTeam: DashboardBusinessTeamSummary | undefined;
  blueprint: DashboardTaskBlueprintSummary | undefined;
}) {
  const members = team?.members ?? [];
  const visibleMembers = members.slice(0, 5);
  const activeStep = progress?.currentStep;
  const visibleSteps = progress?.steps.slice(0, 4) ?? [];

  return (
    <article className="rounded-lg border border-[var(--line)] bg-[var(--surface)] p-3 shadow-[0_1px_0_rgba(15,23,42,0.03)]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <Link href={`/task-runs/${taskRun.id}`} className="line-clamp-2 text-sm font-semibold leading-5 text-[var(--ink)] hover:underline">
            {taskDisplayName(taskRun)}
          </Link>
          <div className="mt-1 truncate text-xs text-[var(--ink-muted)]">{blueprint?.name ?? translateSourceType(taskRun.sourceType)}</div>
        </div>
        <Badge variant={workflowBadgeVariant(taskRun.status)}>{translateStatus(taskRun.status)}</Badge>
      </div>

      <div className="mt-3 rounded-md border border-[var(--line)] bg-[var(--surface-muted)] px-3 py-2">
        <div className="flex items-center justify-between gap-3 text-xs">
          <span className="font-medium text-[var(--ink)]">{taskRunsText("kanban.currentStage")}</span>
          <span className="text-[var(--ink-muted)]">{progress ? `${progress.completedCount}/${progress.totalCount}` : "0/0"}</span>
        </div>
        <div className="mt-1 line-clamp-2 text-sm leading-5 text-[var(--ink)]">
          {activeStep?.label ?? taskRunsText("kanban.waitingWorkflow")}
        </div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[var(--line)]">
          <div
            className="h-full rounded-full bg-[var(--accent)]"
            style={{ width: `${progress?.percent ?? 0}%` }}
          />
        </div>
        {activeStep ? (
          <div className="mt-2 flex flex-wrap gap-1.5">
            <Badge variant={activeStep.kind === "harness" ? "neutral" : "accent"}>
              {activeStep.kind === "harness" ? taskRunsText("stageKind.harness") : taskRunsText("stageKind.model")}
            </Badge>
            <Badge variant={workflowBadgeVariant(activeStep.status)}>{translateStatus(activeStep.status)}</Badge>
          </div>
        ) : null}
      </div>

      <div className="mt-3">
        <div className="mb-2 flex items-center justify-between gap-2 text-xs">
          <span className="font-medium text-[var(--ink)]">{taskRunsText("kanban.participants")}</span>
          <span className="text-[var(--ink-muted)]">{taskRunsText("kanban.memberCount", { count: members.length })}</span>
        </div>
        {visibleMembers.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {visibleMembers.map((member) => (
              <div key={member.id} className="flex min-w-0 items-center gap-1.5 rounded-full border border-[var(--line)] bg-[var(--surface-muted)] py-1 pl-1 pr-2">
                <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-[var(--accent-soft)] text-[10px] font-semibold text-[var(--accent-strong)]">
                  {initials(member.name)}
                </span>
                <span className="max-w-[8rem] truncate text-xs text-[var(--ink)]">{member.role || member.name}</span>
              </div>
            ))}
            {members.length > visibleMembers.length ? (
              <span className="grid h-7 min-w-7 place-items-center rounded-full border border-[var(--line)] bg-[var(--surface-muted)] px-2 text-xs text-[var(--ink-muted)]">
                +{members.length - visibleMembers.length}
              </span>
            ) : null}
          </div>
        ) : (
          <div className="rounded-md border border-dashed border-[var(--line)] px-3 py-2 text-xs text-[var(--ink-muted)]">
            {taskRunsText("kanban.noParticipants")}
          </div>
        )}
      </div>

      <div className="mt-3 space-y-1.5">
        {visibleSteps.map((step) => (
          <div key={step.id} className="flex items-center gap-2 text-xs">
            <span
              className={
                step.status === "completed"
                  ? "h-2 w-2 shrink-0 rounded-full bg-[#16a34a]"
                  : step.status === "running"
                    ? "h-2 w-2 shrink-0 rounded-full bg-[var(--accent)]"
                    : step.status === "awaiting"
                      ? "h-2 w-2 shrink-0 rounded-full bg-[var(--warning)]"
                      : step.status === "failed"
                        ? "h-2 w-2 shrink-0 rounded-full bg-[var(--danger)]"
                        : "h-2 w-2 shrink-0 rounded-full bg-[var(--line-strong)]"
              }
            />
            <span className="min-w-0 flex-1 truncate text-[var(--ink-muted)]">{step.owner} · {step.label}</span>
          </div>
        ))}
      </div>

      <div className="mt-3 flex items-center justify-between gap-3 border-t border-[var(--line)] pt-3 text-xs text-[var(--ink-muted)]">
        <span className="truncate">{businessTeam?.name ?? taskRunsText("fallback.unboundBusinessTeam")}</span>
        <span className="shrink-0">{formatDateTime(taskRun.createdAt)}</span>
      </div>
    </article>
  );
}

function TaskKanbanBoard({ snapshot }: { snapshot: DashboardSnapshot }) {
  const tasksByColumn = Object.fromEntries(
    kanbanColumns.map((column) => [column.id, [] as DashboardTaskRun[]]),
  ) as Record<KanbanColumnId, DashboardTaskRun[]>;

  for (const taskRun of snapshot.task_runs) {
    const progress = snapshot.taskRunWorkflowProgress[taskRun.id];
    tasksByColumn[resolveKanbanColumn(taskRun, progress)].push(taskRun);
  }

  return (
    <Panel>
      <PanelHeader
        eyebrow={taskRunsText("kanban.eyebrow")}
        title={taskRunsText("kanban.title")}
        description={taskRunsText("kanban.description")}
      />
      <PanelBody>
        <div className="grid gap-3 lg:grid-cols-2 2xl:grid-cols-5">
          {kanbanColumns.map((column) => (
            <section key={column.id} className="min-h-[280px] rounded-lg border border-[var(--line)] bg-[var(--surface-muted)]/55">
              <div className="border-b border-[var(--line)] p-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-2">
                    <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${column.railClassName}`} />
                    <h2 className="truncate text-sm font-semibold text-[var(--ink)]">{taskRunsText(column.labelKey)}</h2>
                  </div>
                  <Badge variant={column.id === "blocked" ? "danger" : column.id === "waiting" ? "warning" : "neutral"}>
                    {tasksByColumn[column.id].length}
                  </Badge>
                </div>
                <p className="mt-1 min-h-8 text-xs leading-4 text-[var(--ink-muted)]">{taskRunsText(column.descriptionKey)}</p>
              </div>
              <div className="space-y-3 p-3">
                {tasksByColumn[column.id].map((taskRun) => (
                  <TaskKanbanCard
                    key={taskRun.id}
                    taskRun={taskRun}
                    progress={snapshot.taskRunWorkflowProgress[taskRun.id]}
                    team={snapshot.teamSummaries.find((item) => item.id === taskRun.teamId)}
                    businessTeam={snapshot.businessTeamSummaries.find((item) => item.id === taskRun.businessTeamId)}
                    blueprint={snapshot.taskBlueprints.find((item) => item.id === taskRun.blueprintId)}
                  />
                ))}
                {tasksByColumn[column.id].length === 0 ? (
                  <div className="rounded-lg border border-dashed border-[var(--line)] px-3 py-6 text-center text-xs text-[var(--ink-muted)]">
                    {taskRunsText("kanban.emptyColumn")}
                  </div>
                ) : null}
              </div>
            </section>
          ))}
        </div>
      </PanelBody>
    </Panel>
  );
}

export default function TaskRunsPage() {
  const snapshot = getDashboardSnapshot();
  const activeCount = snapshot.task_runs.filter((taskRun) =>
    ["queued", "preparing_environment", "running", "waiting_approval", "publishing_output"].includes(taskRun.runState),
  ).length;
  const failedCount = snapshot.task_runs.filter((taskRun) =>
    taskRun.status === "failed" || taskRun.runState === "failed",
  ).length;
  const webhookCount = snapshot.task_runs.filter((taskRun) => taskRun.sourceType === "webhook").length;
  const manualCount = snapshot.task_runs.filter((taskRun) => taskRun.sourceType === "manual").length;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={taskRunsText("page.eyebrow")}
        title={taskRunsText("page.title")}
        description={taskRunsText("page.description")}
        badges={[
          { label: <>{taskRunsText("badges.runs", { count: snapshot.task_runs.length })}</>, variant: "accent" },
          { label: <>{taskRunsText("badges.activeRuns", { count: activeCount })}</>, variant: "neutral" },
        ]}
      />

      <SummaryStrip
        items={[
          {
            label: taskRunsText("summary.activeRuns.label"),
            value: activeCount,
            detail: taskRunsText("summary.activeRuns.detail"),
          },
          {
            label: taskRunsText("summary.failedRuns.label"),
            value: failedCount,
            detail: taskRunsText("summary.failedRuns.detail"),
          },
          {
            label: taskRunsText("summary.webhookRuns.label"),
            value: webhookCount,
            detail: taskRunsText("summary.webhookRuns.detail"),
          },
          {
            label: taskRunsText("summary.manualRuns.label"),
            value: manualCount,
            detail: taskRunsText("summary.manualRuns.detail"),
          },
        ]}
      />

      <TaskKanbanBoard snapshot={snapshot} />

      <section className="grid gap-4 2xl:grid-cols-[1.45fr_0.55fr]">
        <Panel>
          <PanelHeader
            eyebrow={taskRunsText("table.eyebrow")}
            title={taskRunsText("table.title")}
            description={taskRunsText("table.description")}
          />
          <PanelBody className="p-0">
            <DataTable>
              <DataTableHeader>
                <DataTableRow className="hover:bg-transparent">
                  <DataTableHead>{taskRunsText("table.columns.task")}</DataTableHead>
                  <DataTableHead>{taskRunsText("table.columns.team")}</DataTableHead>
                  <DataTableHead>{taskRunsText("table.columns.status")}</DataTableHead>
                  <DataTableHead>{taskRunsText("table.columns.workflow")}</DataTableHead>
                  <DataTableHead>{taskRunsText("table.columns.taskBlueprint")}</DataTableHead>
                  <DataTableHead align="right">{taskRunsText("table.columns.createdAt")}</DataTableHead>
                </DataTableRow>
              </DataTableHeader>
              <DataTableBody>
                {snapshot.task_runs.map((taskRun) => {
                  const team = snapshot.teamSummaries.find((item) => item.id === taskRun.teamId);
                  const businessTeam = snapshot.businessTeamSummaries.find((item) => item.id === taskRun.businessTeamId);
                  const blueprint = snapshot.taskBlueprints.find((item) => item.id === taskRun.blueprintId);

                  return (
                    <DataTableRow key={taskRun.id}>
                      <DataTableCell className="min-w-[260px]">
                        <Link href={`/task-runs/${taskRun.id}`} className="font-medium text-[var(--ink)] hover:underline">
                          {taskRun.sourceRef ?? taskRun.sourceType}
                        </Link>
                        <div className="mt-1 text-xs text-[var(--ink-muted)]">{taskRun.idempotencyKey ?? taskRunsText("fallback.noIdempotencyKey")}</div>
                      </DataTableCell>
                      <DataTableCell>
                        <div className="font-medium text-[var(--ink)]">{businessTeam?.name ?? taskRunsText("fallback.unboundBusinessTeam")}</div>
                        <div className="mt-1 text-xs text-[var(--ink-muted)]">{team?.name ?? taskRunsText("fallback.unboundTeam")}</div>
                      </DataTableCell>
                      <DataTableCell>
                        <div className="flex flex-wrap gap-2">
                          <Badge
                            variant={
                              taskRun.status === "failed"
                                ? "danger"
                                : taskRun.status === "running"
                                  ? "accent"
                                  : "neutral"
                            }
                          >
                            {translateStatus(taskRun.status)}
                          </Badge>
                          <Badge variant="neutral">{translateSourceType(taskRun.sourceType)}</Badge>
                        </div>
                        <div className="mt-2 text-xs text-[var(--ink-muted)]">
                          {taskRunsText("table.runStatePriority", {
                            state: translateStatus(taskRun.runState),
                            priority: taskRun.priority,
                          })}
                        </div>
                      </DataTableCell>
                      <DataTableCell>
                        <WorkflowProgressPreview progress={snapshot.taskRunWorkflowProgress[taskRun.id]} />
                      </DataTableCell>
                      <DataTableCell>{blueprint?.name ?? taskRunsText("fallback.unboundBlueprint")}</DataTableCell>
                      <DataTableCell align="right">{formatDateTime(taskRun.createdAt)}</DataTableCell>
                    </DataTableRow>
                  );
                })}
              </DataTableBody>
            </DataTable>
          </PanelBody>
        </Panel>

        <div className="space-y-4">
          <Panel>
            <PanelHeader
              eyebrow={taskRunsText("sourcePanel.eyebrow")}
              title={taskRunsText("sourcePanel.title")}
              description={taskRunsText("sourcePanel.description")}
            />
            <PanelBody className="p-0">
              <DataTable>
                <DataTableHeader>
                  <DataTableRow className="hover:bg-transparent">
                    <DataTableHead>{taskRunsText("sourcePanel.columns.source")}</DataTableHead>
                    <DataTableHead align="right">{taskRunsText("sourcePanel.columns.runCount")}</DataTableHead>
                    <DataTableHead align="right">{taskRunsText("sourcePanel.columns.activeCount")}</DataTableHead>
                  </DataTableRow>
                </DataTableHeader>
                <DataTableBody>
                  {snapshot.taskExecutionDashboard.bySourceType.map((item) => (
                    <DataTableRow key={item.sourceType}>
                      <DataTableCell className="font-medium text-[var(--ink)]">
                        {translateSourceType(item.sourceType)}
                      </DataTableCell>
                      <DataTableCell align="right">{item.taskRunCount}</DataTableCell>
                      <DataTableCell align="right">{item.activeCount}</DataTableCell>
                    </DataTableRow>
                  ))}
                </DataTableBody>
              </DataTable>
            </PanelBody>
          </Panel>

          <Panel>
            <PanelHeader
              eyebrow={taskRunsText("recentPanel.eyebrow")}
              title={taskRunsText("recentPanel.title")}
              description={taskRunsText("recentPanel.description")}
            />
            <PanelBody className="p-0">
              <DataTable>
                <DataTableHeader>
                  <DataTableRow className="hover:bg-transparent">
                    <DataTableHead>{taskRunsText("recentPanel.columns.task")}</DataTableHead>
                    <DataTableHead>{taskRunsText("recentPanel.columns.status")}</DataTableHead>
                  </DataTableRow>
                </DataTableHeader>
                <DataTableBody>
                  {snapshot.task_runs.slice(0, 5).map((taskRun) => (
                    <DataTableRow key={taskRun.id}>
                      <DataTableCell className="min-w-[180px]">
                        <Link href={`/task-runs/${taskRun.id}`} className="font-medium text-[var(--ink)] hover:underline">
                          {taskRun.sourceRef ?? taskRun.sourceType}
                        </Link>
                        <div className="mt-1 text-xs text-[var(--ink-muted)]">{formatDateTime(taskRun.createdAt)}</div>
                      </DataTableCell>
                      <DataTableCell>
                        <Badge variant={taskRun.status === "failed" ? "danger" : "neutral"}>
                          {translateStatus(taskRun.status)}
                        </Badge>
                      </DataTableCell>
                    </DataTableRow>
                  ))}
                </DataTableBody>
              </DataTable>
            </PanelBody>
          </Panel>
        </div>
      </section>
    </div>
  );
}
