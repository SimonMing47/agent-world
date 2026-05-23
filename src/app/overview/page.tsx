import Link from "next/link";
import { MessageSquareMore, ShieldCheck, Users, Workflow } from "lucide-react";
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
import { translateSourceType, translateStatus } from "@/lib/presentation";
import { formatDateTime, formatNumber } from "@/lib/utils";
import { getActiveLanguagePack } from "@/server/language-pack-store";
import { getDashboardSnapshot, getSettingsSnapshot } from "@/server/queries";
import { listRuntimeSessions } from "@/server/runtime-session-core";

function CompactEmpty({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="aw-compact-empty">
      <div className="aw-compact-empty__title">{title}</div>
      <div className="aw-compact-empty__description">{description}</div>
      {action ? <div className="pt-1">{action}</div> : null}
    </div>
  );
}

function statusVariant(status: string): "neutral" | "accent" | "success" | "warning" | "danger" {
  if (status === "running") return "accent";
  if (status === "failed") return "danger";
  if (status === "queued" || status === "awaiting") return "warning";
  if (status === "succeeded") return "success";
  return "neutral";
}

export default function OverviewPage() {
  const languagePack = getActiveLanguagePack();
  const t = (key: string, fallback?: string, params?: Record<string, string | number>) =>
    translateWithPack(languagePack, key, fallback, params);
  const snapshot = getDashboardSnapshot();
  const settings = getSettingsSnapshot();
  const runtimeSessions = listRuntimeSessions().slice(0, 5);

  const activeRuns = snapshot.task_runs.filter((taskRun) => ["running", "awaiting"].includes(taskRun.status));
  const featuredRun = activeRuns[0] ?? snapshot.task_runs[0] ?? null;
  const featuredBusinessTeam = featuredRun
    ? snapshot.businessTeamSummaries.find((item) => item.id === featuredRun.businessTeamId) ?? null
    : null;
  const featuredAgentTeam = featuredRun
    ? snapshot.teamSummaries.find((item) => item.id === featuredRun.teamId) ?? null
    : null;
  const teamHighlights = snapshot.taskExecutionDashboard.byBusinessTeam
    .slice()
    .sort((left, right) => right.taskRunCount - left.taskRunCount)
    .slice(0, 6);
  const topPriorityRuns = snapshot.taskRunPriorityBoard
    .slice(0, 6)
    .map((assessment) => ({
      ...assessment,
      taskRun: snapshot.task_runs.find((taskRun) => taskRun.id === assessment.taskRunId) ?? null,
      businessTeamName:
        (() => {
          const taskRun = snapshot.task_runs.find((candidate) => candidate.id === assessment.taskRunId);
          if (!taskRun) return t("overview.common.empty");
          return snapshot.businessTeamSummaries.find((team) => team.id === taskRun.businessTeamId)?.name ?? t("overview.common.empty");
        })(),
    }))
    .filter((item) => item.taskRun);
  const highlightedBlueprints = snapshot.taskBlueprints.slice(0, 6);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="overview.hero.brandLabel"
        title="ui.generated.cf0e2bbbacc"
        badges={[
          { label: `${activeRuns.length} ${t("ui.common.detail.running", "个运行中")}`, variant: "accent" },
          { label: `${settings.metrics.providerProfileCount} ${t("ui.common.count.modelServices", "个模型服务")}`, variant: "neutral" },
        ]}
        action={
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="primary" size="md" className="rounded-full px-5">
              <Link href="/task-runs">{t("overview.hero.primaryAction")}</Link>
            </Button>
            <Button asChild variant="secondary" size="md" className="rounded-full px-5">
              <Link href="/interactions">{t("overview.hero.secondaryAction")}</Link>
            </Button>
          </div>
        }
      />

      <SummaryStrip
        items={[
          {
            label: "overview.stats.activeRuns",
            value: formatNumber(activeRuns.length),
            detail: "overview.stats.activeRunsDetail",
            tone: activeRuns.length > 0 ? "accent" : "default",
          },
          {
            label: "overview.stats.completedRuns",
            value: formatNumber(snapshot.completedTaskRunCount),
            detail: "overview.stats.completedRunsDetail",
            tone: snapshot.completedTaskRunCount > 0 ? "accent" : "default",
          },
          {
            label: "overview.stats.modelServices",
            value: formatNumber(settings.metrics.providerProfileCount),
            detail: "overview.stats.modelServicesDetail",
            tone: settings.metrics.providerProfileCount > 0 ? "accent" : "default",
          },
        ]}
      />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.05fr)_360px]">
        <Panel>
          <PanelHeader
            eyebrow="overview.queue.eyebrow"
            title="overview.queue.title"
            description="overview.queue.description"
            action={
              <Button asChild size="sm" variant="ghost">
                      <Link href="/task-runs">{t("overview.queue.action")}</Link>
              </Button>
            }
          />
          <PanelBody className="p-0">
            {topPriorityRuns.length ? (
              <DataTable>
                <DataTableHeader>
                  <DataTableRow className="hover:bg-transparent">
                    <DataTableHead>{t("overview.blueprints.columns.name")}</DataTableHead>
                    <DataTableHead>{t("ui.generated.c62e951a692", "状态")}</DataTableHead>
                    <DataTableHead>{t("overview.featured.businessTeam")}</DataTableHead>
                    <DataTableHead align="right">{t("ui.generated.c7a25c53e48", "优先级")}</DataTableHead>
                  </DataTableRow>
                </DataTableHeader>
                <DataTableBody>
                  {topPriorityRuns.map((item) => (
                    <DataTableRow key={item.taskRunId}>
                      <DataTableCell className="min-w-[320px]">
                        <div className="font-medium text-[var(--ink)]">{item.taskRun?.sourceRef ?? item.taskRun?.sourceType}</div>
                        <div className="mt-1 text-xs text-[var(--ink-muted)]">{item.rationale[0]}</div>
                      </DataTableCell>
                      <DataTableCell>
                        <Badge variant={statusVariant(item.taskRun?.status ?? "idle")}>
                          {translateStatus(item.taskRun?.status ?? "idle")}
                        </Badge>
                      </DataTableCell>
                      <DataTableCell>{item.businessTeamName}</DataTableCell>
                      <DataTableCell align="right">
                        <span className="font-medium text-[var(--ink)]">{formatNumber(item.effectivePriority)}</span>
                      </DataTableCell>
                    </DataTableRow>
                  ))}
                </DataTableBody>
              </DataTable>
            ) : (
              <PanelBody>
                <CompactEmpty
                  title={t("overview.queue.empty")}
                  description={t("overview.queue.emptyDescription")}
                  action={
                    <Button asChild size="sm" variant="ghost">
                      <Link href="/task-blueprints">{t("overview.blueprints.action")}</Link>
                    </Button>
                  }
                />
              </PanelBody>
            )}
          </PanelBody>
        </Panel>

        <Panel>
          <PanelHeader eyebrow="overview.featured.kicker" title="overview.status.title" description="overview.status.description" />
          <PanelBody className="space-y-1">
            <div className="aw-metric-row">
              <div className="aw-metric-row__label">{t("overview.featured.agentTeam")}</div>
              <div className="aw-metric-row__value">{featuredAgentTeam?.name ?? t("overview.common.empty")}</div>
            </div>
            <div className="aw-metric-row">
              <div className="aw-metric-row__label">{t("overview.featured.businessTeam")}</div>
              <div className="aw-metric-row__value">{featuredBusinessTeam?.name ?? t("overview.common.empty")}</div>
            </div>
            <div className="aw-metric-row">
              <div className="aw-metric-row__label">{t("overview.featured.window")}</div>
              <div className="aw-metric-row__value">{formatDateTime(snapshot.upcomingWindow)}</div>
            </div>
            <div className="aw-metric-row">
              <div className="aw-metric-row__label">{t("overview.featured.dueSchedules")}</div>
              <div className="aw-metric-row__value">{formatNumber(snapshot.dueScheduleCount)}</div>
            </div>
            <div className="aw-metric-row">
              <div className="aw-metric-row__label">{t("overview.stats.modelServices")}</div>
              <div className="aw-metric-row__value">{formatNumber(settings.metrics.providerProfileCount)}</div>
            </div>
          </PanelBody>
        </Panel>
      </div>

      <div className="grid gap-6">
        <Panel>
          <PanelHeader
            eyebrow="overview.interactions.eyebrow"
            title="overview.interactions.title"
            description="overview.interactions.description"
            action={
              <Button asChild size="sm" variant="ghost">
                <Link href="/interactions">{t("overview.interactions.action")}</Link>
              </Button>
            }
          />
          <PanelBody className="p-0">
            {runtimeSessions.length ? (
              <DataTable>
                <DataTableHeader>
                  <DataTableRow className="hover:bg-transparent">
                    <DataTableHead>{t("ui.generated.c836ffe0e10", "会话")}</DataTableHead>
                    <DataTableHead>{t("ui.generated.c093dea88c9", "更新时间")}</DataTableHead>
                    <DataTableHead>{t("ui.generated.c8e175e7aa9", "执行配置")}</DataTableHead>
                    <DataTableHead align="right">{t("ui.generated.cf3ea6d345e", "操作")}</DataTableHead>
                  </DataTableRow>
                </DataTableHeader>
                <DataTableBody>
                  {runtimeSessions.map((session) => (
                    <DataTableRow key={session.id}>
                      <DataTableCell className="min-w-[260px]">
                        <div className="font-medium text-[var(--ink)]">{session.title}</div>
                        <div className="mt-1 text-xs text-[var(--ink-muted)]">{session.model}</div>
                      </DataTableCell>
                      <DataTableCell>
                        <Badge variant={session.status === "running" ? "accent" : "neutral"}>
                          {translateStatus(session.status)}
                        </Badge>
                      </DataTableCell>
                      <DataTableCell>{formatDateTime(session.updatedAt)}</DataTableCell>
                      <DataTableCell align="right">
                        <Link href={`/interactions/${session.id}`} className="text-sm font-medium text-[var(--accent)]">
                          {t("overview.interactions.action")}
                        </Link>
                      </DataTableCell>
                    </DataTableRow>
                  ))}
                </DataTableBody>
              </DataTable>
            ) : (
              <PanelBody>
                <CompactEmpty
                  title={t("overview.interactions.empty")}
                  description={t("overview.interactions.emptyDescription")}
                  action={
                    <Button asChild size="sm" variant="ghost">
                      <Link href="/interactions">{t("overview.interactions.action")}</Link>
                    </Button>
                  }
                />
              </PanelBody>
            )}
          </PanelBody>
        </Panel>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,0.86fr)_minmax(0,1.14fr)]">
        <Panel>
          <PanelHeader
            eyebrow="overview.teams.eyebrow"
            title="overview.teams.title"
            description="overview.teams.description"
            action={
              <Button asChild size="sm" variant="ghost">
                <Link href="/business-teams">{t("overview.teams.action")}</Link>
              </Button>
            }
          />
          <PanelBody className="space-y-1">
            {teamHighlights.length ? (
              teamHighlights.map((team) => (
                <div key={team.businessTeamId} className="aw-metric-row">
                  <div>
                    <div className="text-sm font-medium text-[var(--ink)]">{team.businessTeamName}</div>
                    <div className="mt-1 text-xs text-[var(--ink-muted)]">
                      {formatNumber(team.teamCount)} {t("overview.teams.agentTeamSuffix")}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="aw-metric-row__value">{formatNumber(team.taskRunCount)}</div>
                    <div className="mt-1 text-xs text-[var(--ink-muted)]">
                      {formatNumber(team.activeCount)} {t("overview.common.activeSuffix")}
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <CompactEmpty title={t("overview.teams.empty")} description={t("overview.teams.emptyDescription")} />
            )}
          </PanelBody>
        </Panel>

        <Panel>
          <PanelHeader
            eyebrow="overview.blueprints.eyebrow"
            title="overview.blueprints.title"
            description="overview.blueprints.description"
            action={
              <Button asChild size="sm" variant="ghost">
                <Link href="/task-blueprints">{t("overview.blueprints.action")}</Link>
              </Button>
            }
          />
          <PanelBody className="p-0">
            {highlightedBlueprints.length ? (
              <DataTable>
                <DataTableHeader>
                  <DataTableRow className="hover:bg-transparent">
                    <DataTableHead>{t("overview.blueprints.columns.name")}</DataTableHead>
                    <DataTableHead>{t("overview.blueprints.columns.team")}</DataTableHead>
                    <DataTableHead>{t("overview.blueprints.columns.trigger")}</DataTableHead>
                    <DataTableHead align="right">{t("overview.blueprints.columns.runs")}</DataTableHead>
                  </DataTableRow>
                </DataTableHeader>
                <DataTableBody>
                  {highlightedBlueprints.map((blueprint) => (
                    <DataTableRow key={blueprint.id}>
                      <DataTableCell>
                        <div className="font-medium text-[var(--ink)]">{blueprint.name}</div>
                        <div className="mt-1 text-xs text-[var(--ink-muted)]">{blueprint.category}</div>
                      </DataTableCell>
                      <DataTableCell>{blueprint.businessTeamName}</DataTableCell>
                      <DataTableCell>{translateSourceType(String((blueprint.trigger as Record<string, unknown>).type ?? "manual"))}</DataTableCell>
                      <DataTableCell align="right">{formatNumber(blueprint.runCount)}</DataTableCell>
                    </DataTableRow>
                  ))}
                </DataTableBody>
              </DataTable>
            ) : (
              <PanelBody>
                <CompactEmpty
                  title={t("overview.blueprints.empty")}
                  description={t("overview.blueprints.emptyDescription")}
                  action={
                    <Button asChild size="sm" variant="ghost">
                      <Link href="/task-blueprints">{t("overview.blueprints.action")}</Link>
                    </Button>
                  }
                />
              </PanelBody>
            )}
          </PanelBody>
        </Panel>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          {
            icon: Workflow,
            label: t("overview.footer.agentTeams"),
            value: formatNumber(snapshot.teamSummaries.length),
            detail: t("overview.footer.agentTeamsHint"),
          },
          {
            icon: Users,
            label: t("overview.footer.businessTeams"),
            value: formatNumber(snapshot.businessTeamSummaries.length),
            detail: t("overview.footer.businessTeamsHint"),
          },
          {
            icon: MessageSquareMore,
            label: t("overview.footer.runtimes"),
            value: formatNumber(snapshot.runtimes.length),
            detail: t("overview.footer.runtimesHint"),
          },
          {
            icon: ShieldCheck,
            label: t("overview.footer.executionEnvironments"),
            value: formatNumber(snapshot.executionEnvironments.length),
            detail: t("overview.footer.executionEnvironmentsHint"),
          },
        ].map((item) => (
          <div key={item.label} className="aw-kpi-card px-5 py-5">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-transparent text-[var(--ink-subtle)]">
              <item.icon className="h-4 w-4" />
            </div>
            <div className="mt-4 text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--ink-subtle)]">{item.label}</div>
            <div
              className="mt-2 font-mono text-[36px] font-medium leading-none tracking-[-0.05em] text-[rgba(14,17,22,0.88)]"
              data-tone={Number(item.value) > 0 ? "accent" : "default"}
              style={Number(item.value) > 0 ? { color: "var(--accent)" } : undefined}
            >
              {item.value}
            </div>
            <div className="mt-2 text-[12px] leading-6 text-[var(--ink-subtle)]">{item.detail}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
