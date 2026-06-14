import Link from "next/link";
import { FindingCleanupCampaignLauncher } from "@/components/finding-cleanup-campaign-launcher";
import { PageHeader } from "@/components/page-header";
import { SoftwareTeamWorkflowStarter } from "@/components/software-team-workflow-starter";
import { TeamActionQueueActions } from "@/components/team-action-queue-actions";
import { TaskRunFindingActions } from "@/components/task-run-finding-actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { translateWithPack } from "@/lib/language-pack";
import { localizeDemoCopy } from "@/lib/presentation";
import { formatDateTime, formatNumber } from "@/lib/utils";
import { canAccessBusinessTeam, getRequestAuthContext } from "@/server/auth-core";
import { getActiveLanguagePack } from "@/server/language-pack-store";
import { getDashboardSnapshot, getTaskBlueprintEditorOptions } from "@/server/queries";

type DashboardSnapshot = ReturnType<typeof getDashboardSnapshot>;
type DashboardTaskRun = DashboardSnapshot["task_runs"][number];
type DashboardFindingTriageItem = DashboardSnapshot["findingTriageQueue"][number];
type DashboardTeamActionQueueItem = DashboardSnapshot["teamActionQueue"][number];
type DashboardTaskRunTeamActivity = DashboardSnapshot["taskRunTeamActivity"][string];
type DashboardTeamActivityItem = NonNullable<DashboardTaskRunTeamActivity["latestItem"]>;
type TeamWallboardParticipationRow = {
  taskRun: DashboardTaskRun;
  activity: DashboardTaskRunTeamActivity;
  latest: DashboardTeamActivityItem;
  businessTeamName: string;
  agentTeamName: string;
  blueprintName: string | null;
};

const ACTIVE_TASK_RUN_STATUSES = new Set([
  "awaiting",
  "preparing_environment",
  "publishing_output",
  "queued",
  "running",
  "waiting_approval",
]);

function statusVariant(status: string): "neutral" | "accent" | "success" | "warning" | "danger" {
  if (status === "running" || status === "preparing_environment" || status === "publishing_output") return "accent";
  if (status === "failed" || status === "cancelled" || status === "rejected") return "danger";
  if (status === "queued" || status === "awaiting" || status === "waiting_approval") return "warning";
  if (status === "completed" || status === "succeeded" || status === "passed") return "success";
  return "neutral";
}

function severityVariant(severity: string): "neutral" | "accent" | "success" | "warning" | "danger" {
  if (severity === "critical" || severity === "high") return "danger";
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

function taskRunDisplayName(taskRun: DashboardTaskRun) {
  return taskRun.sourceRef ?? taskRun.idempotencyKey ?? taskRun.id.slice(0, 8);
}

function isActiveTaskRun(taskRun: DashboardTaskRun) {
  return ACTIVE_TASK_RUN_STATUSES.has(taskRun.status) || ACTIVE_TASK_RUN_STATUSES.has(taskRun.runState);
}

function sortRunsByCreatedAt(left: DashboardTaskRun, right: DashboardTaskRun) {
  return new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime();
}

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

function TeamWallboardParticipationPanel({
  rows,
  t,
}: {
  rows: TeamWallboardParticipationRow[];
  t: (key: string, fallback?: string, params?: Record<string, string | number>) => string;
}) {
  const blockerCount = rows.reduce((sum, row) => sum + row.activity.blockerCount, 0);
  const handoffCount = rows.reduce((sum, row) => sum + row.activity.handoffCount, 0);

  return (
    <Panel>
      <PanelHeader
        eyebrow={t("teamWallboard.teamActivity.eyebrow")}
        title={t("teamWallboard.teamActivity.title")}
        description={t("teamWallboard.teamActivity.description")}
        action={
          <div className="flex flex-wrap justify-end gap-2">
            <Badge variant={blockerCount > 0 ? "danger" : "neutral"}>
              {t("teamWallboard.teamActivity.badges.blockers", undefined, { count: formatNumber(blockerCount) })}
            </Badge>
            <Badge variant={handoffCount > 0 ? "warning" : "neutral"}>
              {t("teamWallboard.teamActivity.badges.handoffs", undefined, { count: formatNumber(handoffCount) })}
            </Badge>
          </div>
        }
      />
      <PanelBody className="p-0">
        {rows.length ? (
          <DataTable>
            <DataTableHeader>
              <DataTableRow className="hover:bg-transparent">
                <DataTableHead>{t("teamWallboard.teamActivity.columns.signal")}</DataTableHead>
                <DataTableHead>{t("teamWallboard.teamActivity.columns.run")}</DataTableHead>
                <DataTableHead>{t("teamWallboard.teamActivity.columns.context")}</DataTableHead>
                <DataTableHead align="right">{t("teamWallboard.teamActivity.columns.action")}</DataTableHead>
              </DataTableRow>
            </DataTableHeader>
            <DataTableBody>
              {rows.map((row) => (
                <DataTableRow key={`${row.taskRun.id}:${row.latest.id}`}>
                  <DataTableCell className="min-w-[320px]">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Badge variant={teamActivityVariant(row.latest.kind)}>
                        {t(`teamWallboard.teamActivity.kinds.${row.latest.kind}`)}
                      </Badge>
                      <span className="text-xs text-[var(--ink-muted)]">
                        {row.latest.actor
                          ? t("teamWallboard.teamActivity.actor", undefined, { actor: row.latest.actor })
                          : t("teamWallboard.teamActivity.systemActor")}
                      </span>
                    </div>
                    <div className="mt-2 line-clamp-1 text-sm font-semibold text-[var(--ink)]">
                      {localizeDemoCopy(row.latest.title)}
                    </div>
                    <div className="mt-1 line-clamp-2 text-xs leading-5 text-[var(--ink-muted)]">
                      {localizeDemoCopy(row.latest.content)}
                    </div>
                    <div className="mt-2 text-xs text-[var(--ink-subtle)]">{formatDateTime(row.latest.createdAt)}</div>
                  </DataTableCell>
                  <DataTableCell className="min-w-[240px]">
                    <Link href={`/task-runs/${row.taskRun.id}`} className="font-medium text-[var(--ink)] hover:underline">
                      {taskRunDisplayName(row.taskRun)}
                    </Link>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      <Badge variant={statusVariant(row.taskRun.status)}>
                        {t(`labels.status.${row.taskRun.status}`, row.taskRun.status)}
                      </Badge>
                      <Badge variant={teamActivityVariant(row.latest.kind)}>
                        {t("teamWallboard.teamActivity.actionCount", undefined, { count: formatNumber(row.activity.totalCount) })}
                      </Badge>
                    </div>
                  </DataTableCell>
                  <DataTableCell className="min-w-[240px]">
                    <div className="font-medium text-[var(--ink)]">{row.businessTeamName}</div>
                    <div className="mt-1 text-xs text-[var(--ink-muted)]">{row.agentTeamName}</div>
                    <div className="mt-1 text-xs text-[var(--ink-subtle)]">
                      {row.blueprintName ?? t("teamWallboard.teamActivity.unboundBlueprint")}
                    </div>
                  </DataTableCell>
                  <DataTableCell align="right">
                    <Button asChild size="sm" variant={row.latest.kind === "blocker" ? "primary" : "secondary"}>
                      <Link href={`/task-runs/${row.taskRun.id}`}>{t("teamWallboard.teamActivity.openRun")}</Link>
                    </Button>
                  </DataTableCell>
                </DataTableRow>
              ))}
            </DataTableBody>
          </DataTable>
        ) : (
          <div className="p-5">
            <div className="aw-compact-empty">
              <div className="aw-compact-empty__title">{t("teamWallboard.teamActivity.empty")}</div>
              <div className="aw-compact-empty__description">{t("teamWallboard.teamActivity.emptyDescription")}</div>
            </div>
          </div>
        )}
      </PanelBody>
    </Panel>
  );
}

function TeamWallboardActionQueue({
  items,
  t,
}: {
  items: DashboardTeamActionQueueItem[];
  t: (key: string, fallback?: string, params?: Record<string, string | number>) => string;
}) {
  const urgentCount = items.filter((item) => item.priority === "critical" || item.priority === "high").length;
  const visibleItems = items.slice(0, 5);

  return (
    <Panel>
      <PanelHeader
        eyebrow={t("teamWallboard.actionQueue.eyebrow")}
        title={t("teamWallboard.actionQueue.title")}
        description={t("teamWallboard.actionQueue.description")}
        action={
          <div className="flex flex-wrap justify-end gap-2">
            <Badge variant={urgentCount > 0 ? "warning" : "success"}>
              {t("teamWallboard.actionQueue.badges.urgent", undefined, { count: urgentCount })}
            </Badge>
            <Button asChild size="sm" variant="ghost">
              <Link href="/task-runs">{t("teamWallboard.actionQueue.openFullQueue")}</Link>
            </Button>
          </div>
        }
      />
      <PanelBody className="p-0">
        {visibleItems.length ? (
          <DataTable>
            <DataTableHeader>
              <DataTableRow className="hover:bg-transparent">
                <DataTableHead>{t("teamWallboard.actionQueue.columns.priority")}</DataTableHead>
                <DataTableHead>{t("teamWallboard.actionQueue.columns.work")}</DataTableHead>
                <DataTableHead>{t("teamWallboard.actionQueue.columns.context")}</DataTableHead>
                <DataTableHead align="right">{t("teamWallboard.actionQueue.columns.action")}</DataTableHead>
              </DataTableRow>
            </DataTableHeader>
            <DataTableBody>
              {visibleItems.map((item) => (
                <DataTableRow key={item.id}>
                  <DataTableCell className="min-w-[150px]">
                    <div className="flex flex-wrap gap-1.5">
                      <Badge variant={actionQueuePriorityVariant(item.priority)}>
                        {t(`ui.taskRuns.actionQueue.priorities.${item.priority}`)}
                      </Badge>
                      <Badge variant="neutral">{t(`ui.taskRuns.actionQueue.kinds.${item.kind}`)}</Badge>
                    </div>
                  </DataTableCell>
                  <DataTableCell className="min-w-[320px]">
                    <Link href={item.href} className="font-semibold text-[var(--ink)] hover:underline">
                      {t(item.titleKey, undefined, item.titleParams)}
                    </Link>
                    <div className="mt-1 text-sm leading-6 text-[var(--ink-muted)]">
                      {t(item.descriptionKey, undefined, item.descriptionParams)}
                    </div>
                  </DataTableCell>
                  <DataTableCell className="min-w-[220px]">
                    <div className="font-medium text-[var(--ink)]">
                      {item.businessTeamName ?? t("teamWallboard.actionQueue.context.taskRun")}
                    </div>
                    <div className="mt-1 text-xs text-[var(--ink-muted)]">
                      {item.agentTeamName ?? t("teamWallboard.actionQueue.context.operational")}
                    </div>
                    <div className="mt-1 text-xs text-[var(--ink-subtle)]">
                      {item.createdAt ? formatDateTime(item.createdAt) : t("teamWallboard.actionQueue.context.noTimestamp")}
                    </div>
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
        ) : (
          <div className="p-5">
            <div className="aw-compact-empty">
              <div className="aw-compact-empty__title">{t("teamWallboard.actionQueue.empty")}</div>
              <div className="aw-compact-empty__description">{t("teamWallboard.actionQueue.emptyDescription")}</div>
            </div>
          </div>
        )}
      </PanelBody>
    </Panel>
  );
}

export default async function TeamWallboardPage() {
  const languagePack = getActiveLanguagePack();
  const t = (key: string, fallback?: string, params?: Record<string, string | number>) =>
    translateWithPack(languagePack, key, fallback, params);
  const authContext = await getRequestAuthContext();
  const snapshot = getDashboardSnapshot();
  const rawOptions = getTaskBlueprintEditorOptions();
  const starterOptions = {
    ...rawOptions,
    businessTeams: rawOptions.businessTeams.filter((team) => canAccessBusinessTeam(authContext, team.id)),
    agentTeams: rawOptions.agentTeams.filter((team) => canAccessBusinessTeam(authContext, team.businessTeamId)),
    environments: rawOptions.environments.filter((environment) =>
      canAccessBusinessTeam(authContext, environment.businessTeamId),
    ),
    codebases: (rawOptions.codebases ?? []).filter((codebase) =>
      canAccessBusinessTeam(authContext, codebase.businessTeamId),
    ),
  };
  const blueprintIds = new Set(snapshot.taskBlueprints.map((blueprint) => blueprint.id));
  const taskRows = snapshot.taskBlueprints
    .map((blueprint) => {
      const runs = snapshot.task_runs
        .filter((taskRun) => taskRun.blueprintId === blueprint.id)
        .slice()
        .sort(sortRunsByCreatedAt);
      const activeRuns = runs.filter(isActiveTaskRun);
      return {
        blueprint,
        runs,
        activeRuns,
        latestRun: runs[0] ?? null,
      };
    })
    .sort(
      (left, right) =>
        right.activeRuns.length - left.activeRuns.length ||
        right.runs.length - left.runs.length ||
        left.blueprint.name.localeCompare(right.blueprint.name),
    );
  const unlinkedRuns = snapshot.task_runs
    .filter((taskRun) => !taskRun.blueprintId || !blueprintIds.has(taskRun.blueprintId))
    .slice()
    .sort(sortRunsByCreatedAt);
  const activeRunCount = snapshot.task_runs.filter(isActiveTaskRun).length;
  const findingQueue = snapshot.findingTriageQueue;
  const cleanupTeamOptions = buildCleanupTeamOptions(snapshot);
  const highRiskFindingCount = findingQueue.filter((finding) =>
    finding.severity === "critical" || finding.severity === "high",
  ).length;
  const unassignedFindingCount = snapshot.findingOwnerBoard.find((row) => row.isUnassigned)?.total ?? 0;
  const overdueFindingCount = snapshot.findingOwnerBoard.reduce((sum, row) => sum + row.overdue, 0);
  const participationRows = snapshot.task_runs
    .flatMap((taskRun) => {
      const activity = snapshot.taskRunTeamActivity[taskRun.id];
      const latest = getLatestTeamActivity(activity);
      if (!activity || !latest) return [];
      return [{
        taskRun,
        activity,
        latest,
        businessTeamName:
          snapshot.businessTeamSummaries.find((team) => team.id === taskRun.businessTeamId)?.name ??
          t("teamWallboard.teamActivity.unknownBusinessTeam"),
        agentTeamName:
          snapshot.teamSummaries.find((team) => team.id === taskRun.teamId)?.name ??
          t("teamWallboard.teamActivity.unknownAgentTeam"),
        blueprintName: snapshot.taskBlueprints.find((blueprint) => blueprint.id === taskRun.blueprintId)?.name ?? null,
      }];
    })
    .sort((left, right) => new Date(right.latest.createdAt).getTime() - new Date(left.latest.createdAt).getTime())
    .slice(0, 8);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={t("teamWallboard.page.eyebrow")}
        title={t("teamWallboard.page.title")}
        description={t("teamWallboard.page.description")}
        badges={[
          { label: t("teamWallboard.badges.tasks", undefined, { count: snapshot.taskBlueprints.length }), variant: "accent" },
          { label: t("teamWallboard.badges.runs", undefined, { count: snapshot.task_runs.length }), variant: "neutral" },
        ]}
      />

      <SummaryStrip
        items={[
          {
            label: t("teamWallboard.summary.tasks.label"),
            value: formatNumber(snapshot.taskBlueprints.length),
            detail: t("teamWallboard.summary.tasks.detail"),
            tone: snapshot.taskBlueprints.length > 0 ? "accent" : "default",
          },
          {
            label: t("teamWallboard.summary.runs.label"),
            value: formatNumber(snapshot.task_runs.length),
            detail: t("teamWallboard.summary.runs.detail"),
            tone: snapshot.task_runs.length > 0 ? "accent" : "default",
          },
          {
            label: t("teamWallboard.summary.activeRuns.label"),
            value: formatNumber(activeRunCount),
            detail: t("teamWallboard.summary.activeRuns.detail"),
            tone: activeRunCount > 0 ? "accent" : "default",
          },
          {
            label: t("teamWallboard.summary.unlinkedRuns.label"),
            value: formatNumber(unlinkedRuns.length),
            detail: t("teamWallboard.summary.unlinkedRuns.detail"),
            tone: unlinkedRuns.length > 0 ? "accent" : "default",
          },
          {
            label: t("teamWallboard.summary.findings.label"),
            value: formatNumber(findingQueue.length),
            detail: t("teamWallboard.summary.findings.detail", undefined, { count: highRiskFindingCount }),
            tone: findingQueue.length > 0 ? "accent" : "default",
          },
          {
            label: t("teamWallboard.summary.unassignedFindings.label"),
            value: formatNumber(unassignedFindingCount),
            detail: t("teamWallboard.summary.unassignedFindings.detail"),
            tone: unassignedFindingCount > 0 ? "accent" : "default",
          },
          {
            label: t("teamWallboard.summary.overdueFindings.label"),
            value: formatNumber(overdueFindingCount),
            detail: t("teamWallboard.summary.overdueFindings.detail"),
            tone: overdueFindingCount > 0 ? "accent" : "default",
          },
        ]}
        gridClassName="sm:grid-cols-2 xl:grid-cols-7"
      />

      <TeamWallboardParticipationPanel rows={participationRows} t={t} />

      <TeamWallboardActionQueue items={snapshot.teamActionQueue} t={t} />

      <SoftwareTeamWorkflowStarter options={starterOptions} />

      <Panel>
        <PanelHeader
          eyebrow={t("teamWallboard.findings.eyebrow")}
          title={t("teamWallboard.findings.title")}
          description={t("teamWallboard.findings.description")}
          action={
            <div className="flex flex-wrap items-center justify-end gap-2">
              <FindingCleanupCampaignLauncher disabled={findingQueue.length === 0} teamOptions={cleanupTeamOptions} />
              <Button asChild size="sm" variant="ghost">
                <Link href="/task-runs">{t("teamWallboard.findings.openQueue")}</Link>
              </Button>
            </div>
          }
        />
        <PanelBody className="p-0">
          {findingQueue.length ? (
            <DataTable>
              <DataTableHeader>
                <DataTableRow className="hover:bg-transparent">
                  <DataTableHead>{t("teamWallboard.findings.columns.finding")}</DataTableHead>
                  <DataTableHead>{t("teamWallboard.findings.columns.owner")}</DataTableHead>
                  <DataTableHead>{t("teamWallboard.findings.columns.source")}</DataTableHead>
                  <DataTableHead>{t("teamWallboard.findings.columns.status")}</DataTableHead>
                  <DataTableHead align="right">{t("teamWallboard.findings.columns.actions")}</DataTableHead>
                </DataTableRow>
              </DataTableHeader>
              <DataTableBody>
                {findingQueue.slice(0, 8).map((finding: DashboardFindingTriageItem) => (
                  <DataTableRow key={finding.id}>
                    <DataTableCell className="min-w-[300px]">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant={severityVariant(finding.severity)}>
                          {t(`labels.severity.${finding.severity}`, finding.severity)}
                        </Badge>
                        <Badge variant="neutral">{finding.category}</Badge>
                      </div>
                      <Link href={`/task-runs/${finding.taskRunId}`} className="mt-2 block font-medium text-[var(--ink)] hover:underline">
                        {localizeDemoCopy(finding.title)}
                      </Link>
                      <div className="mt-1 text-xs leading-5 text-[var(--ink-muted)]">
                        {finding.location ?? t("teamWallboard.findings.noLocation")}
                      </div>
                    </DataTableCell>
                    <DataTableCell className="min-w-[220px]">
                      <div className="font-medium text-[var(--ink)]">{finding.businessTeamName}</div>
                      <div className="mt-1 text-xs text-[var(--ink-muted)]">{finding.agentTeamName}</div>
                    </DataTableCell>
                    <DataTableCell className="min-w-[220px]">
                      <div className="font-medium text-[var(--ink)]">
                        {finding.blueprintName ?? t("teamWallboard.findings.unboundBlueprint")}
                      </div>
                      <div className="mt-1 text-xs text-[var(--ink-muted)]">
                        {finding.taskRunSourceRef ?? t("teamWallboard.findings.noSource")}
                      </div>
                    </DataTableCell>
                    <DataTableCell>
                      <div className="flex flex-wrap gap-1.5">
                        <Badge variant={statusVariant(finding.status)}>
                          {t(`labels.status.${finding.status}`, finding.status)}
                        </Badge>
                        {finding.taskRunStatus ? (
                          <Badge variant={statusVariant(finding.taskRunStatus)}>
                            {t(`labels.status.${finding.taskRunStatus}`, finding.taskRunStatus)}
                          </Badge>
                        ) : null}
                      </div>
                      <div className="mt-2 text-xs text-[var(--ink-muted)]">{formatDateTime(finding.createdAt)}</div>
                    </DataTableCell>
                    <DataTableCell align="right">
                      <div className="flex justify-end">
                        <TaskRunFindingActions
                          taskRunId={finding.taskRunId}
                          findingId={finding.id}
                          currentStatus={finding.status}
                          feedbackPath={finding.feedbackPath}
                          latestFeedback={finding.latestFeedback}
                          assignment={finding.assignment}
                        />
                      </div>
                    </DataTableCell>
                  </DataTableRow>
                ))}
              </DataTableBody>
            </DataTable>
          ) : (
            <div className="p-5">
              <div className="aw-compact-empty">
                <div className="aw-compact-empty__title">{t("teamWallboard.findings.empty")}</div>
                <div className="aw-compact-empty__description">{t("teamWallboard.findings.emptyDescription")}</div>
              </div>
            </div>
          )}
        </PanelBody>
      </Panel>

      <Panel>
        <PanelHeader
          eyebrow={t("teamWallboard.taskRuns.eyebrow")}
          title={t("teamWallboard.taskRuns.title")}
          description={t("teamWallboard.taskRuns.description")}
          action={
            <Button asChild size="sm" variant="ghost">
              <Link href="/task-blueprints">{t("teamWallboard.taskRuns.manageTasks")}</Link>
            </Button>
          }
        />
        <PanelBody className="p-0">
          <DataTable>
            <DataTableHeader>
              <DataTableRow className="hover:bg-transparent">
                <DataTableHead>{t("teamWallboard.taskRuns.columns.task")}</DataTableHead>
                <DataTableHead>{t("teamWallboard.taskRuns.columns.owner")}</DataTableHead>
                <DataTableHead>{t("teamWallboard.taskRuns.columns.trigger")}</DataTableHead>
                <DataTableHead>{t("teamWallboard.taskRuns.columns.runs")}</DataTableHead>
                <DataTableHead>{t("teamWallboard.taskRuns.columns.latest")}</DataTableHead>
                <DataTableHead align="right">{t("teamWallboard.taskRuns.columns.actions")}</DataTableHead>
              </DataTableRow>
            </DataTableHeader>
            <DataTableBody>
              {taskRows.length ? (
                taskRows.map((taskRow) => {
                  const triggerType = String((taskRow.blueprint.trigger as Record<string, unknown>).type ?? "manual");
                  return (
                    <DataTableRow key={taskRow.blueprint.id}>
                      <DataTableCell className="min-w-[260px]">
                        <Link
                          href={`/task-blueprints/${taskRow.blueprint.id}`}
                          className="font-semibold text-[var(--ink)] hover:underline"
                        >
                          {taskRow.blueprint.name}
                        </Link>
                        <div className="mt-1 text-xs text-[var(--ink-muted)]">
                          {t("teamWallboard.taskRuns.taskMeta", undefined, {
                            category: taskRow.blueprint.category,
                            version: taskRow.blueprint.version,
                          })}
                        </div>
                      </DataTableCell>
                      <DataTableCell className="min-w-[220px]">
                        <div className="text-sm text-[var(--ink)]">{taskRow.blueprint.businessTeamName}</div>
                        <div className="mt-1 text-xs text-[var(--ink-muted)]">{taskRow.blueprint.agentTeamName}</div>
                      </DataTableCell>
                      <DataTableCell>
                        <Badge variant="neutral">{t(`labels.sourceType.${triggerType}`, triggerType)}</Badge>
                      </DataTableCell>
                      <DataTableCell>
                        <div className="text-sm font-medium text-[var(--ink)]">
                          {t("teamWallboard.taskRuns.totalCount", undefined, { count: taskRow.runs.length })}
                        </div>
                        <div className="mt-1 text-xs text-[var(--ink-muted)]">
                          {t("teamWallboard.taskRuns.activeCount", undefined, { count: taskRow.activeRuns.length })}
                        </div>
                      </DataTableCell>
                      <DataTableCell className="min-w-[260px]">
                        {taskRow.latestRun ? (
                          <div className="space-y-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <Badge variant={statusVariant(taskRow.latestRun.status)}>
                                {t(`labels.status.${taskRow.latestRun.status}`, taskRow.latestRun.status)}
                              </Badge>
                              <Link
                                href={`/task-runs/${taskRow.latestRun.id}`}
                                className="text-sm font-medium text-[var(--accent)] hover:underline"
                              >
                                {taskRow.latestRun.sourceRef ?? taskRow.latestRun.id.slice(0, 8)}
                              </Link>
                            </div>
                            <div className="text-xs text-[var(--ink-muted)]">
                              {t("teamWallboard.taskRuns.latestAt", undefined, {
                                time: formatDateTime(taskRow.latestRun.createdAt),
                              })}
                            </div>
                          </div>
                        ) : (
                          <span className="text-sm text-[var(--ink-muted)]">{t("teamWallboard.taskRuns.noRuns")}</span>
                        )}
                      </DataTableCell>
                      <DataTableCell align="right">
                        <div className="flex justify-end gap-2">
                          <Button asChild size="sm" variant="ghost">
                            <Link href={`/task-blueprints/${taskRow.blueprint.id}`}>{t("teamWallboard.taskRuns.openTask")}</Link>
                          </Button>
                          <Button asChild size="sm" variant="secondary">
                            <Link href="/task-runs">{t("teamWallboard.taskRuns.openRuns")}</Link>
                          </Button>
                        </div>
                      </DataTableCell>
                    </DataTableRow>
                  );
                })
              ) : (
                <DataTableRow>
                  <DataTableCell colSpan={6}>
                    <div className="aw-compact-empty py-2">
                      <div className="aw-compact-empty__title">{t("teamWallboard.taskRuns.empty")}</div>
                      <div className="aw-compact-empty__description">{t("teamWallboard.taskRuns.emptyDescription")}</div>
                    </div>
                  </DataTableCell>
                </DataTableRow>
              )}
            </DataTableBody>
          </DataTable>
        </PanelBody>
      </Panel>

      <Panel>
        <PanelHeader
          eyebrow={t("teamWallboard.unlinked.eyebrow")}
          title={t("teamWallboard.unlinked.title")}
          description={t("teamWallboard.unlinked.description")}
        />
        <PanelBody className="p-0">
          {unlinkedRuns.length ? (
            <DataTable>
              <DataTableHeader>
                <DataTableRow className="hover:bg-transparent">
                  <DataTableHead>{t("teamWallboard.unlinked.columns.run")}</DataTableHead>
                  <DataTableHead>{t("teamWallboard.unlinked.columns.source")}</DataTableHead>
                  <DataTableHead>{t("teamWallboard.unlinked.columns.team")}</DataTableHead>
                  <DataTableHead>{t("teamWallboard.unlinked.columns.status")}</DataTableHead>
                  <DataTableHead align="right">{t("teamWallboard.unlinked.columns.createdAt")}</DataTableHead>
                </DataTableRow>
              </DataTableHeader>
              <DataTableBody>
                {unlinkedRuns.slice(0, 8).map((taskRun) => (
                  <DataTableRow key={taskRun.id}>
                    <DataTableCell>
                      <Link href={`/task-runs/${taskRun.id}`} className="font-semibold text-[var(--ink)] hover:underline">
                        {taskRun.sourceRef ?? taskRun.id.slice(0, 8)}
                      </Link>
                      <div className="mt-1 text-xs text-[var(--ink-muted)]">{taskRun.traceId}</div>
                    </DataTableCell>
                    <DataTableCell>{t(`labels.sourceType.${taskRun.sourceType}`, taskRun.sourceType)}</DataTableCell>
                    <DataTableCell>
                      {snapshot.businessTeamSummaries.find((team) => team.id === taskRun.businessTeamId)?.name ??
                        t("teamWallboard.unlinked.unknownTeam")}
                    </DataTableCell>
                    <DataTableCell>
                      <Badge variant={statusVariant(taskRun.status)}>{t(`labels.status.${taskRun.status}`, taskRun.status)}</Badge>
                    </DataTableCell>
                    <DataTableCell align="right">{formatDateTime(taskRun.createdAt)}</DataTableCell>
                  </DataTableRow>
                ))}
              </DataTableBody>
            </DataTable>
          ) : (
            <div className="p-5">
              <div className="aw-compact-empty">
                <div className="aw-compact-empty__title">{t("teamWallboard.unlinked.empty")}</div>
                <div className="aw-compact-empty__description">{t("teamWallboard.unlinked.emptyDescription")}</div>
              </div>
            </div>
          )}
        </PanelBody>
      </Panel>
    </div>
  );
}
