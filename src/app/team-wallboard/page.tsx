import Link from "next/link";
import { PageHeader } from "@/components/page-header";
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
import { formatDateTime, formatNumber } from "@/lib/utils";
import { getActiveLanguagePack } from "@/server/language-pack-store";
import { getDashboardSnapshot } from "@/server/queries";

type DashboardSnapshot = ReturnType<typeof getDashboardSnapshot>;
type DashboardTaskRun = DashboardSnapshot["task_runs"][number];

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

function isActiveTaskRun(taskRun: DashboardTaskRun) {
  return ACTIVE_TASK_RUN_STATUSES.has(taskRun.status) || ACTIVE_TASK_RUN_STATUSES.has(taskRun.runState);
}

function sortRunsByCreatedAt(left: DashboardTaskRun, right: DashboardTaskRun) {
  return new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime();
}

export default function TeamWallboardPage() {
  const languagePack = getActiveLanguagePack();
  const t = (key: string, fallback?: string, params?: Record<string, string | number>) =>
    translateWithPack(languagePack, key, fallback, params);
  const snapshot = getDashboardSnapshot();
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
        ]}
      />

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
