import Link from "next/link";
import { FindingCleanupCampaignLauncher } from "@/components/finding-cleanup-campaign-launcher";
import { PageHeader } from "@/components/page-header";
import { TeamActionQueueActions } from "@/components/team-action-queue-actions";
import { TaskRunFindingActions } from "@/components/task-run-finding-actions";
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
import { localizeDemoCopy, translateSeverity, translateSourceType, translateStatus } from "@/lib/presentation";
import { formatDateTime, formatNumber } from "@/lib/utils";
import { getDashboardSnapshot } from "@/server/queries";

type DashboardSnapshot = ReturnType<typeof getDashboardSnapshot>;
type DashboardTaskRun = DashboardSnapshot["task_runs"][number];
type DashboardWorkflowProgress = DashboardSnapshot["taskRunWorkflowProgress"][string];
type DashboardTaskRunTeamActivity = DashboardSnapshot["taskRunTeamActivity"][string];
type DashboardTeamSummary = DashboardSnapshot["teamSummaries"][number];
type DashboardBusinessTeamSummary = DashboardSnapshot["businessTeamSummaries"][number];
type DashboardTaskBlueprintSummary = DashboardSnapshot["taskBlueprints"][number];
type DashboardFindingTriageItem = DashboardSnapshot["findingTriageQueue"][number];
type DashboardFindingOwnerBoardItem = DashboardSnapshot["findingOwnerBoard"][number];
type DashboardTeamActionQueueItem = DashboardSnapshot["teamActionQueue"][number];
type KanbanColumnId = "intake" | "running" | "waiting" | "done" | "blocked";

function buildCleanupTeamOptions(snapshot: DashboardSnapshot) {
  const findingCountByTeam = new Map<string, number>();
  for (const finding of snapshot.findingTriageQueue) {
    if (!finding.agentTeamId) continue;
    findingCountByTeam.set(finding.agentTeamId, (findingCountByTeam.get(finding.agentTeamId) ?? 0) + 1);
  }

  return snapshot.teamSummaries
    .map((team) => ({
      id: team.id,
      name: team.name,
      findingCount: findingCountByTeam.get(team.id) ?? 0,
    }))
    .filter((team) => team.findingCount > 0)
    .sort((left, right) => right.findingCount - left.findingCount || left.name.localeCompare(right.name));
}

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

function severityBadgeVariant(severity: string): "neutral" | "accent" | "success" | "warning" | "danger" {
  if (["critical", "high"].includes(severity)) return "danger";
  if (severity === "medium") return "warning";
  if (severity === "low") return "accent";
  return "neutral";
}

function actionQueuePriorityVariant(priority: DashboardTeamActionQueueItem["priority"]): "neutral" | "accent" | "success" | "warning" | "danger" {
  if (priority === "critical") return "danger";
  if (priority === "high") return "warning";
  if (priority === "medium") return "accent";
  return "neutral";
}

function teamActivityVariant(kind: string | undefined): "neutral" | "accent" | "success" | "warning" | "danger" {
  if (kind === "blocker" || kind === "policy") return "danger";
  if (kind === "handoff" || kind === "gate") return "warning";
  if (kind === "decision" || kind === "finding" || kind === "remediation") return "accent";
  if (kind === "cleanup") return "success";
  return "neutral";
}

function getLatestTeamActivity(activity: DashboardTaskRunTeamActivity | undefined) {
  return activity?.latestHandoff ?? activity?.latestItem ?? null;
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

function TeamActivitySignal({
  activity,
  compact = false,
}: {
  activity: DashboardTaskRunTeamActivity | undefined;
  compact?: boolean;
}) {
  const latestActivity = getLatestTeamActivity(activity);
  const totalCount = activity?.totalCount ?? 0;

  if (!latestActivity) {
    return (
      <div className={compact ? "mt-2 text-xs text-[var(--ink-muted)]" : "mt-3 border-t border-[var(--line)] pt-3 text-xs text-[var(--ink-muted)]"}>
        {taskRunsText("teamActivity.empty")}
      </div>
    );
  }

  const headlineKey = latestActivity.kind === "handoff" ? "teamActivity.latestHandoff" : "teamActivity.latestSignal";

  return (
    <div className={compact ? "mt-3 min-w-[240px]" : "mt-3 border-t border-[var(--line)] pt-3"}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs font-medium text-[var(--ink)]">{taskRunsText(headlineKey)}</span>
        <Badge variant={activity?.blockerCount ? "danger" : teamActivityVariant(latestActivity.kind)}>
          {taskRunsText("teamActivity.count", { count: formatNumber(totalCount) })}
        </Badge>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <Badge variant={teamActivityVariant(latestActivity.kind)}>
          {taskRunsText(`teamActivity.kinds.${latestActivity.kind}`)}
        </Badge>
        <span className="text-xs text-[var(--ink-muted)]">
          {latestActivity.actor
            ? taskRunsText("teamActivity.actor", { actor: latestActivity.actor })
            : taskRunsText("teamActivity.systemActor")}
        </span>
      </div>
      <div className={compact ? "mt-1 line-clamp-1 text-xs font-medium text-[var(--ink)]" : "mt-1 line-clamp-2 text-sm font-medium leading-5 text-[var(--ink)]"}>
        {localizeDemoCopy(latestActivity.title)}
      </div>
      <div className="mt-1 text-xs text-[var(--ink-subtle)]">{formatDateTime(latestActivity.createdAt)}</div>
    </div>
  );
}

function TaskKanbanCard({
  taskRun,
  progress,
  activity,
  team,
  businessTeam,
  blueprint,
}: {
  taskRun: DashboardTaskRun;
  progress: DashboardWorkflowProgress | undefined;
  activity: DashboardTaskRunTeamActivity | undefined;
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

      <TeamActivitySignal activity={activity} />

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
                    activity={snapshot.taskRunTeamActivity[taskRun.id]}
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

function TeamActionQueuePanel({ items }: { items: DashboardTeamActionQueueItem[] }) {
  const urgentCount = items.filter((item) => item.priority === "critical" || item.priority === "high").length;
  const gateCount = items.filter((item) => item.kind === "waiting_gate" || item.kind === "blocked_run").length;

  return (
    <Panel>
      <PanelHeader
        eyebrow={taskRunsText("actionQueue.eyebrow")}
        title={taskRunsText("actionQueue.title")}
        description={taskRunsText("actionQueue.description")}
        action={
          <div className="flex flex-wrap justify-end gap-2">
            <Badge variant={urgentCount > 0 ? "warning" : "success"}>
              {taskRunsText("actionQueue.badges.urgent", { count: formatNumber(urgentCount) })}
            </Badge>
            <Badge variant={gateCount > 0 ? "danger" : "neutral"}>
              {taskRunsText("actionQueue.badges.gates", { count: formatNumber(gateCount) })}
            </Badge>
          </div>
        }
      />
      <PanelBody className="p-0">
        {items.length === 0 ? (
          <div className="px-6 py-5">
            <div className="rounded-lg border border-dashed border-[var(--line)] bg-[var(--surface-muted)] px-4 py-6 text-sm text-[var(--ink-muted)]">
              {taskRunsText("actionQueue.empty")}
            </div>
          </div>
        ) : (
          <DataTable>
            <DataTableHeader>
              <DataTableRow className="hover:bg-transparent">
                <DataTableHead>{taskRunsText("actionQueue.columns.priority")}</DataTableHead>
                <DataTableHead>{taskRunsText("actionQueue.columns.work")}</DataTableHead>
                <DataTableHead>{taskRunsText("actionQueue.columns.context")}</DataTableHead>
                <DataTableHead>{taskRunsText("actionQueue.columns.updated")}</DataTableHead>
                <DataTableHead align="right">{taskRunsText("actionQueue.columns.action")}</DataTableHead>
              </DataTableRow>
            </DataTableHeader>
            <DataTableBody>
              {items.map((item) => (
                <DataTableRow key={item.id}>
                  <DataTableCell className="min-w-[150px]">
                    <div className="flex flex-wrap gap-1.5">
                      <Badge variant={actionQueuePriorityVariant(item.priority)}>
                        {taskRunsText(`actionQueue.priorities.${item.priority}`)}
                      </Badge>
                      <Badge variant="neutral">{taskRunsText(`actionQueue.kinds.${item.kind}`)}</Badge>
                    </div>
                  </DataTableCell>
                  <DataTableCell className="min-w-[320px]">
                    <Link href={item.href} className="font-semibold text-[var(--ink)] hover:underline">
                      {uiText(item.titleKey, undefined, item.titleParams)}
                    </Link>
                    <div className="mt-1 text-sm leading-6 text-[var(--ink-muted)]">
                      {uiText(item.descriptionKey, undefined, item.descriptionParams)}
                    </div>
                  </DataTableCell>
                  <DataTableCell className="min-w-[220px]">
                    <div className="font-medium text-[var(--ink)]">
                      {item.businessTeamName ?? taskRunsText("actionQueue.context.taskRun")}
                    </div>
                    <div className="mt-1 text-xs text-[var(--ink-muted)]">
                      {item.agentTeamName ?? taskRunsText("actionQueue.context.operational")}
                    </div>
                  </DataTableCell>
                  <DataTableCell className="min-w-[180px]">
                    {item.createdAt ? formatDateTime(item.createdAt) : taskRunsText("actionQueue.context.noTimestamp")}
                  </DataTableCell>
                  <DataTableCell align="right">
                    <TeamActionQueueActions
                      href={item.href}
                      actionKey={item.actionKey}
                      taskRunId={item.taskRunId}
                      findingId={item.findingId}
                      assignment={item.assignment}
                      remediation={item.remediation}
                      openVariant={item.priority === "critical" ? "primary" : "secondary"}
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

function FindingTriageQueuePanel({ snapshot }: { snapshot: DashboardSnapshot }) {
  const queue = snapshot.findingTriageQueue;
  const highRiskCount = queue.filter((finding) => ["critical", "high"].includes(finding.severity)).length;
  const cleanupTeamOptions = buildCleanupTeamOptions(snapshot);

  return (
    <Panel>
      <PanelHeader
        eyebrow={taskRunsText("findingQueue.eyebrow")}
        title={taskRunsText("findingQueue.title")}
        description={taskRunsText("findingQueue.description")}
        action={
          <div className="flex flex-wrap items-center justify-end gap-2">
            <div className="flex flex-wrap gap-2">
              <Badge variant={queue.length > 0 ? "warning" : "success"}>
                {taskRunsText("findingQueue.badges.open", { count: formatNumber(queue.length) })}
              </Badge>
              <Badge variant={highRiskCount > 0 ? "danger" : "neutral"}>
                {taskRunsText("findingQueue.badges.highRisk", { count: formatNumber(highRiskCount) })}
              </Badge>
            </div>
            <FindingCleanupCampaignLauncher disabled={queue.length === 0} teamOptions={cleanupTeamOptions} />
          </div>
        }
      />
      <PanelBody className="p-0">
        {queue.length === 0 ? (
          <div className="px-6 py-5">
            <div className="rounded-lg border border-dashed border-[var(--line)] bg-[var(--surface-muted)] px-4 py-6 text-sm text-[var(--ink-muted)]">
              {taskRunsText("findingQueue.empty")}
            </div>
          </div>
        ) : (
          <DataTable>
            <DataTableHeader>
              <DataTableRow className="hover:bg-transparent">
                <DataTableHead>{taskRunsText("findingQueue.columns.finding")}</DataTableHead>
                <DataTableHead>{taskRunsText("findingQueue.columns.team")}</DataTableHead>
                <DataTableHead>{taskRunsText("findingQueue.columns.source")}</DataTableHead>
                <DataTableHead>{taskRunsText("findingQueue.columns.status")}</DataTableHead>
                <DataTableHead>{taskRunsText("findingQueue.columns.actions")}</DataTableHead>
              </DataTableRow>
            </DataTableHeader>
            <DataTableBody>
              {queue.map((finding: DashboardFindingTriageItem) => (
                <DataTableRow key={finding.id}>
                  <DataTableCell className="min-w-[300px]">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant={severityBadgeVariant(finding.severity)}>{translateSeverity(finding.severity)}</Badge>
                      <Badge variant="neutral">{finding.category}</Badge>
                    </div>
                    <Link href={`/task-runs/${finding.taskRunId}`} className="mt-2 block font-medium text-[var(--ink)] hover:underline">
                      {localizeDemoCopy(finding.title)}
                    </Link>
                    <div className="mt-1 text-xs leading-5 text-[var(--ink-muted)]">
                      {finding.location ?? taskRunsText("findingQueue.noLocation")}
                    </div>
                  </DataTableCell>
                  <DataTableCell className="min-w-[220px]">
                    <div className="font-medium text-[var(--ink)]">{finding.businessTeamName}</div>
                    <div className="mt-1 text-xs text-[var(--ink-muted)]">{finding.agentTeamName}</div>
                  </DataTableCell>
                  <DataTableCell className="min-w-[220px]">
                    <div className="font-medium text-[var(--ink)]">
                      {finding.blueprintName ?? taskRunsText("fallback.unboundBlueprint")}
                    </div>
                    <div className="mt-1 text-xs text-[var(--ink-muted)]">
                      {finding.taskRunSourceRef ?? taskRunsText("findingQueue.noSource")}
                    </div>
                  </DataTableCell>
                  <DataTableCell>
                    <div className="flex flex-wrap gap-1.5">
                      <Badge variant={workflowBadgeVariant(finding.status)}>{translateStatus(finding.status)}</Badge>
                      {finding.taskRunStatus ? (
                        <Badge variant={workflowBadgeVariant(finding.taskRunStatus)}>
                          {translateStatus(finding.taskRunStatus)}
                        </Badge>
                      ) : null}
                    </div>
                    <div className="mt-2 text-xs text-[var(--ink-muted)]">{formatDateTime(finding.createdAt)}</div>
                  </DataTableCell>
                  <DataTableCell>
                    <TaskRunFindingActions
                      taskRunId={finding.taskRunId}
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

function FindingOwnerBoardPanel({ snapshot }: { snapshot: DashboardSnapshot }) {
  const rows = snapshot.findingOwnerBoard;
  const unassignedCount = rows.find((row) => row.isUnassigned)?.total ?? 0;
  const overdueCount = rows.reduce((sum, row) => sum + row.overdue, 0);

  return (
    <Panel>
      <PanelHeader
        eyebrow={taskRunsText("ownerBoard.eyebrow")}
        title={taskRunsText("ownerBoard.title")}
        description={taskRunsText("ownerBoard.description")}
        action={
          <div className="flex flex-wrap gap-2">
            <Badge variant={unassignedCount > 0 ? "warning" : "success"}>
              {taskRunsText("ownerBoard.badges.unassigned", { count: formatNumber(unassignedCount) })}
            </Badge>
            <Badge variant={overdueCount > 0 ? "danger" : "neutral"}>
              {taskRunsText("ownerBoard.badges.overdue", { count: formatNumber(overdueCount) })}
            </Badge>
          </div>
        }
      />
      <PanelBody className="p-0">
        {rows.length === 0 ? (
          <div className="px-6 py-5">
            <div className="rounded-lg border border-dashed border-[var(--line)] bg-[var(--surface-muted)] px-4 py-6 text-sm text-[var(--ink-muted)]">
              {taskRunsText("ownerBoard.empty")}
            </div>
          </div>
        ) : (
          <DataTable>
            <DataTableHeader>
              <DataTableRow className="hover:bg-transparent">
                <DataTableHead>{taskRunsText("ownerBoard.columns.owner")}</DataTableHead>
                <DataTableHead>{taskRunsText("ownerBoard.columns.workload")}</DataTableHead>
                <DataTableHead>{taskRunsText("ownerBoard.columns.sla")}</DataTableHead>
                <DataTableHead>{taskRunsText("ownerBoard.columns.samples")}</DataTableHead>
                <DataTableHead align="right">{taskRunsText("ownerBoard.columns.action")}</DataTableHead>
              </DataTableRow>
            </DataTableHeader>
            <DataTableBody>
              {rows.map((row: DashboardFindingOwnerBoardItem) => {
                const topFinding = row.sampleFindings[0] ?? null;
                return (
                  <DataTableRow key={row.ownerKey}>
                    <DataTableCell className="min-w-[220px]">
                      <div className="font-semibold text-[var(--ink)]">
                        {row.isUnassigned ? taskRunsText("ownerBoard.unassignedOwner") : row.ownerLabel}
                      </div>
                      <div className="mt-1 flex flex-wrap gap-1.5">
                        <Badge variant={row.isUnassigned ? "warning" : "accent"}>
                          {row.isUnassigned ? taskRunsText("ownerBoard.ownerState.unassigned") : taskRunsText("ownerBoard.ownerState.assigned")}
                        </Badge>
                      </div>
                    </DataTableCell>
                    <DataTableCell>
                      <div className="text-sm font-medium text-[var(--ink)]">
                        {taskRunsText("ownerBoard.totalFindings", { count: formatNumber(row.total) })}
                      </div>
                      <div className="mt-1 flex flex-wrap gap-1.5">
                        <Badge variant={row.highRisk > 0 ? "danger" : "neutral"}>
                          {taskRunsText("ownerBoard.highRisk", { count: formatNumber(row.highRisk) })}
                        </Badge>
                        <Badge variant={row.overdue > 0 ? "danger" : "neutral"}>
                          {taskRunsText("ownerBoard.overdue", { count: formatNumber(row.overdue) })}
                        </Badge>
                      </div>
                    </DataTableCell>
                    <DataTableCell className="min-w-[190px]">
                      {row.nextDueAt ? (
                        <div className="space-y-1">
                          <div className="text-sm font-medium text-[var(--ink)]">
                            {formatDateTime(row.nextDueAt)}
                          </div>
                          <div className="text-xs text-[var(--ink-muted)]">{taskRunsText("ownerBoard.nextDue")}</div>
                        </div>
                      ) : (
                        <span className="text-sm text-[var(--ink-muted)]">{taskRunsText("ownerBoard.noDueDate")}</span>
                      )}
                    </DataTableCell>
                    <DataTableCell className="min-w-[300px]">
                      <div className="space-y-2">
                        {row.sampleFindings.map((finding) => (
                          <Link
                            key={finding.id}
                            href={`/task-runs/${finding.taskRunId}`}
                            className="block rounded-md border border-[var(--line)] bg-[var(--surface-muted)] px-3 py-2 hover:border-[var(--accent)]"
                          >
                            <div className="flex flex-wrap items-center gap-1.5">
                              <Badge variant={severityBadgeVariant(finding.severity)}>{translateSeverity(finding.severity)}</Badge>
                              <Badge variant={finding.overdue ? "danger" : "neutral"}>
                                {finding.overdue ? taskRunsText("ownerBoard.sampleOverdue") : taskRunsText("ownerBoard.sampleOnTrack")}
                              </Badge>
                            </div>
                            <div className="mt-1 line-clamp-1 text-sm font-medium text-[var(--ink)]">
                              {localizeDemoCopy(finding.title)}
                            </div>
                            <div className="mt-1 truncate text-xs text-[var(--ink-muted)]">
                              {finding.location ?? taskRunsText("findingQueue.noLocation")}
                            </div>
                          </Link>
                        ))}
                      </div>
                    </DataTableCell>
                    <DataTableCell align="right">
                      {topFinding ? (
                        <Link href={`/task-runs/${topFinding.taskRunId}`} className="text-sm font-medium text-[var(--accent)] hover:underline">
                          {taskRunsText("ownerBoard.openTopRun")}
                        </Link>
                      ) : (
                        <span className="text-sm text-[var(--ink-muted)]">{taskRunsText("ownerBoard.noAction")}</span>
                      )}
                    </DataTableCell>
                  </DataTableRow>
                );
              })}
            </DataTableBody>
          </DataTable>
        )}
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
  const unassignedFindingCount = snapshot.findingOwnerBoard.find((row) => row.isUnassigned)?.total ?? 0;
  const overdueFindingCount = snapshot.findingOwnerBoard.reduce((sum, row) => sum + row.overdue, 0);

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
          {
            label: taskRunsText("summary.unassignedFindings.label"),
            value: unassignedFindingCount,
            detail: taskRunsText("summary.unassignedFindings.detail"),
            tone: unassignedFindingCount > 0 ? "accent" : "default",
          },
          {
            label: taskRunsText("summary.overdueFindings.label"),
            value: overdueFindingCount,
            detail: taskRunsText("summary.overdueFindings.detail"),
            tone: overdueFindingCount > 0 ? "accent" : "default",
          },
        ]}
        gridClassName="sm:grid-cols-2 xl:grid-cols-6"
      />

      <TeamActionQueuePanel items={snapshot.teamActionQueue} />

      <TaskKanbanBoard snapshot={snapshot} />

      <FindingOwnerBoardPanel snapshot={snapshot} />

      <FindingTriageQueuePanel snapshot={snapshot} />

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
                        <TeamActivitySignal activity={snapshot.taskRunTeamActivity[taskRun.id]} compact />
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
