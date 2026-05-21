import Link from "next/link";
import {
  ArrowUpRight,
  Bot,
  Cable,
  CircleDashed,
  Info,
  MessageSquareMore,
  Users,
  Workflow,
} from "lucide-react";
import { AgentWorldLogo } from "@/components/agentworld-logo";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { uiText } from "@/lib/language-pack";
import { translateSeverity, translateSourceType, translateStatus } from "@/lib/presentation";
import { formatDateTime, formatNumber } from "@/lib/utils";
import { getDashboardSnapshot, getSettingsSnapshot } from "@/server/queries";
import { listRuntimeSessions } from "@/server/runtime-session-core";

function OverviewStat({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="aw-overview-stat">
      <div className="aw-overview-stat__label">{label}</div>
      <div className="aw-overview-stat__value">{value}</div>
      <div className="aw-overview-stat__detail">{detail}</div>
    </div>
  );
}

function OverviewSection({
  eyebrow,
  title,
  description,
  children,
  action,
}: {
  eyebrow: string;
  title: string;
  description: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <section className="aw-surface">
      <div className="aw-section-header">
        <div>
          <div className="aw-section-header__eyebrow">{eyebrow}</div>
          <h2 className="aw-section-header__title">{title}</h2>
          <p className="aw-section-header__description">{description}</p>
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
      {children}
    </section>
  );
}

function OverviewEmptyState({
  message,
  actionLabel,
  actionHref,
}: {
  message: string;
  actionLabel?: string;
  actionHref?: string;
}) {
  return (
    <div className="aw-empty-state">
      <div className="aw-empty-state__icon">
        <CircleDashed className="h-5 w-5" />
      </div>
      <div className="aw-empty-state__message">{message}</div>
      {actionLabel && actionHref ? (
        <Button asChild variant="ghost" size="sm">
          <Link href={actionHref}>{actionLabel}</Link>
        </Button>
      ) : null}
    </div>
  );
}

function OverviewHint({ text }: { text: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button type="button" className="aw-hint" aria-label={text}>
          <Info className="h-3.5 w-3.5" />
        </button>
      </TooltipTrigger>
      <TooltipContent>{text}</TooltipContent>
    </Tooltip>
  );
}

export default function OverviewPage() {
  const snapshot = getDashboardSnapshot();
  const settings = getSettingsSnapshot();
  const runtimeSessions = listRuntimeSessions().slice(0, 3);

  const activeRuns = snapshot.task_runs.filter((taskRun) => ["running", "awaiting"].includes(taskRun.status));
  const featuredRun = activeRuns[0] ?? snapshot.task_runs[0] ?? null;
  const featuredBusinessTeam = featuredRun
    ? snapshot.businessTeamSummaries.find((item) => item.id === featuredRun.businessTeamId) ?? null
    : null;
  const featuredAgentTeam = featuredRun
    ? snapshot.teamSummaries.find((item) => item.id === featuredRun.teamId) ?? null
    : null;
  const topPriorityRuns = snapshot.taskRunPriorityBoard
    .slice(0, 5)
    .map((assessment) => ({
      ...assessment,
      taskRun: snapshot.task_runs.find((taskRun) => taskRun.id === assessment.taskRunId) ?? null,
    }))
    .filter((item) => item.taskRun);
  const sourceMax = Math.max(1, ...snapshot.taskExecutionDashboard.bySourceType.map((item) => item.taskRunCount));
  const severityMax = Math.max(1, ...snapshot.findingDashboard.bySeverity.map((item) => item.count));
  const highlightedBlueprints = snapshot.taskBlueprints.slice(0, 6);
  const teamHighlights = snapshot.taskExecutionDashboard.byBusinessTeam
    .slice()
    .sort((left, right) => right.taskRunCount - left.taskRunCount)
    .slice(0, 5);
  const footerMetrics = [
    {
      icon: Workflow,
      label: uiText("overview.footer.agentTeams"),
      value: formatNumber(snapshot.teamSummaries.length),
      detail: uiText("overview.footer.agentTeamsHint"),
    },
    {
      icon: Users,
      label: uiText("overview.footer.businessTeams"),
      value: formatNumber(snapshot.businessTeamSummaries.length),
      detail: uiText("overview.footer.businessTeamsHint"),
    },
    {
      icon: Cable,
      label: uiText("overview.footer.runtimes"),
      value: formatNumber(snapshot.runtimes.length),
      detail: uiText("overview.footer.runtimesHint"),
    },
    {
      icon: Bot,
      label: uiText("overview.footer.executionEnvironments"),
      value: formatNumber(snapshot.executionEnvironments.length),
      detail: uiText("overview.footer.executionEnvironmentsHint"),
    },
  ];

  return (
    <>
      <div className="space-y-6 xl:space-y-8">
        <section className="aw-hero">
        <div className="aw-hero__grid" />
        <div className="aw-hero__content">
          <div className="aw-hero__intro">
            <div className="aw-hero__brandline">
              <AgentWorldLogo className="h-10 w-10 text-[var(--accent)]" />
              <span>{uiText("overview.hero.brandLabel")}</span>
            </div>
            <h1 className="aw-hero__title">{uiText("overview.hero.title")}</h1>
            <p className="aw-hero__description">{uiText("overview.hero.description")}</p>
            <div className="flex flex-wrap gap-3">
              <Button asChild variant="primary" size="lg">
                <Link href="/task-runs">
                  {uiText("overview.hero.primaryAction")}
                  <ArrowUpRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button asChild variant="secondary" size="lg">
                <Link href="/interactions">{uiText("overview.hero.secondaryAction")}</Link>
              </Button>
            </div>
          </div>

          <div className="aw-hero__featured">
            <div className="aw-hero__featured-shell">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="aw-hero__eyebrow">{uiText("overview.featured.kicker")}</div>
                  <div className="mt-1 text-lg font-semibold text-[var(--ink)]">
                    {featuredRun?.sourceRef ?? uiText("overview.featured.emptyTitle")}
                  </div>
                </div>
                <Badge
                  variant={
                    featuredRun?.status === "failed"
                      ? "danger"
                      : featuredRun?.status === "running"
                        ? "accent"
                        : "neutral"
                  }
                >
                  {translateStatus(featuredRun?.status ?? "idle")}
                </Badge>
              </div>

              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                <div className="aw-hero__meta">
                  <div className="aw-hero__meta-label">{uiText("overview.featured.businessTeam")}</div>
                  <div className="aw-hero__meta-value">
                    {featuredBusinessTeam?.name ?? uiText("overview.common.empty")}
                  </div>
                </div>
                <div className="aw-hero__meta">
                  <div className="aw-hero__meta-label">{uiText("overview.featured.agentTeam")}</div>
                  <div className="aw-hero__meta-value">
                    {featuredAgentTeam?.name ?? uiText("overview.common.empty")}
                  </div>
                </div>
                <div className="aw-hero__meta">
                  <div className="aw-hero__meta-label">{uiText("overview.featured.window")}</div>
                  <div className="aw-hero__meta-value">{formatDateTime(snapshot.upcomingWindow)}</div>
                </div>
                <div className="aw-hero__meta">
                  <div className="aw-hero__meta-label">{uiText("overview.featured.dueSchedules")}</div>
                  <div className="aw-hero__meta-value">{formatNumber(snapshot.dueScheduleCount)}</div>
                </div>
              </div>

              <div className="mt-6 space-y-3">
                <div className="aw-hero__eyebrow">{uiText("overview.featured.providerRationale")}</div>
                <ul className="space-y-2">
                  {(snapshot.featuredProviderRationale.length
                    ? snapshot.featuredProviderRationale
                    : [uiText("overview.featured.noRationale")]).slice(0, 3).map((item) => (
                    <li key={item} className="aw-hero__bullet">
                      <span className="aw-hero__bullet-dot" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>

        <div className="aw-hero__stats">
          <OverviewStat
            label={uiText("overview.stats.activeRuns")}
            value={formatNumber(activeRuns.length)}
            detail={uiText("overview.stats.activeRunsDetail")}
          />
          <OverviewStat
            label={uiText("overview.stats.completedRuns")}
            value={formatNumber(snapshot.completedTaskRunCount)}
            detail={uiText("overview.stats.completedRunsDetail")}
          />
          <OverviewStat
            label={uiText("overview.stats.findingsOpen")}
            value={formatNumber(snapshot.findingDashboard.open)}
            detail={uiText("overview.stats.findingsOpenDetail")}
          />
          <OverviewStat
            label={uiText("overview.stats.modelServices")}
            value={formatNumber(settings.metrics.providerProfileCount)}
            detail={uiText("overview.stats.modelServicesDetail")}
          />
        </div>
        </section>

        <OverviewSection
          eyebrow={uiText("overview.interactions.eyebrow")}
          title={uiText("overview.interactions.title")}
          description={uiText("overview.interactions.description")}
          action={
            <Button asChild variant="ghost" size="sm">
              <Link href="/interactions">{uiText("overview.interactions.action")}</Link>
            </Button>
          }
        >
          <div className="grid gap-4 lg:grid-cols-[0.92fr_1.08fr]">
            <div className="rounded-[24px] border border-[var(--line)] bg-[var(--surface-subtle)] p-5">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-[var(--ink)] shadow-sm">
                <MessageSquareMore className="h-5 w-5" />
              </div>
              <div className="mt-4 text-base font-semibold text-[var(--ink)]">
                {uiText("overview.interactions.cardTitle")}
              </div>
              <p className="mt-3 text-sm leading-7 text-[var(--ink-muted)]">
                {uiText("overview.interactions.cardDescription")}
              </p>
              <div className="mt-5 flex flex-wrap gap-2">
                <Badge variant="neutral">{uiText("overview.interactions.badges.single")}</Badge>
                <Badge variant="accent">{uiText("overview.interactions.badges.team")}</Badge>
                <Badge variant="success">{uiText("overview.interactions.badges.trace")}</Badge>
              </div>
            </div>

            <div className="space-y-3">
              {runtimeSessions.length ? runtimeSessions.map((session) => (
                <Link
                  key={session.id}
                  href={`/interactions/${session.id}`}
                  className="block rounded-[22px] bg-white px-5 py-4 shadow-[var(--shadow-soft)] ring-1 ring-black/4 transition hover:-translate-y-0.5 hover:shadow-[var(--shadow-medium)]"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold text-[var(--ink)]">{session.title}</div>
                      <div className="mt-1 text-xs text-[var(--ink-muted)]">{session.model}</div>
                    </div>
                    <Badge variant={session.status === "running" ? "accent" : "neutral"}>
                      {translateStatus(session.status)}
                    </Badge>
                  </div>
                  <div className="mt-4 flex items-center justify-between gap-3 text-xs text-[var(--ink-subtle)]">
                    <span>{formatDateTime(session.updatedAt)}</span>
                    <span>{session.mode === "agent_team" ? uiText("overview.interactions.badges.team") : uiText("overview.interactions.badges.single")}</span>
                  </div>
                </Link>
              )) : (
                <OverviewEmptyState
                  message={uiText("overview.interactions.empty")}
                  actionLabel={uiText("overview.interactions.action")}
                  actionHref="/interactions"
                />
              )}
            </div>
          </div>
        </OverviewSection>

        <section className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <OverviewSection
          eyebrow={uiText("overview.radar.eyebrow")}
          title={uiText("overview.radar.title")}
          description={uiText("overview.radar.description")}
        >
          <div className="space-y-4">
            {snapshot.taskExecutionDashboard.bySourceType.map((item) => (
              <div key={item.sourceType} className="aw-meter">
                <div className="aw-meter__header">
                  <div className="aw-meter__title">{translateSourceType(item.sourceType)}</div>
                  <div className="aw-meter__value">
                    {formatNumber(item.taskRunCount)}
                    <span>{uiText("overview.common.totalSuffix")}</span>
                  </div>
                </div>
                <div className="aw-meter__track">
                  <div
                    className="aw-meter__fill"
                    style={{ width: `${Math.max(10, (item.taskRunCount / sourceMax) * 100)}%` }}
                  />
                </div>
                <div className="aw-meter__detail">
                  {formatNumber(item.activeCount)} {uiText("overview.common.activeSuffix")}
                </div>
              </div>
            ))}
          </div>
        </OverviewSection>

        <OverviewSection
          eyebrow={uiText("overview.signal.eyebrow")}
          title={uiText("overview.signal.title")}
          description={uiText("overview.signal.description")}
        >
          <div className="space-y-4">
            {snapshot.findingDashboard.bySeverity.map((item) => (
              <div key={item.severity} className="aw-meter">
                <div className="aw-meter__header">
                  <div className="aw-meter__title">{translateSeverity(item.severity)}</div>
                  <div className="aw-meter__value">{formatNumber(item.count)}</div>
                </div>
                <div className="aw-meter__track aw-meter__track--subtle">
                  <div
                    className="aw-meter__fill aw-meter__fill--danger"
                    style={{ width: `${Math.max(8, (item.count / severityMax) * 100)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </OverviewSection>
        </section>

        <section className="grid gap-6 xl:grid-cols-[1.18fr_0.82fr]">
        <OverviewSection
          eyebrow={uiText("overview.queue.eyebrow")}
          title={uiText("overview.queue.title")}
          description={uiText("overview.queue.description")}
          action={
            <Button asChild variant="ghost" size="sm">
              <Link href="/task-runs">{uiText("overview.queue.action")}</Link>
            </Button>
          }
        >
          <div className="overflow-hidden">
            <div className="divide-y divide-[var(--line)]">
              {topPriorityRuns.length ? topPriorityRuns.map((item) => (
                <div key={item.taskRunId} className="aw-list-row">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-3">
                      <div className="aw-priority-chip">{formatNumber(item.effectivePriority)}</div>
                      <div className="truncate text-sm font-medium text-[var(--ink)]">
                        {item.taskRun?.sourceRef ?? item.taskRun?.sourceType}
                      </div>
                    </div>
                    <div className="mt-2 text-sm leading-6 text-[var(--ink-muted)]">
                      {item.rationale[0]}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <Badge variant={item.taskRun?.status === "running" ? "accent" : "neutral"}>
                      {translateStatus(item.taskRun?.status ?? "idle")}
                    </Badge>
                    <div className="text-xs text-[var(--ink-subtle)]">
                      {item.taskRun ? formatDateTime(item.taskRun.createdAt) : ""}
                    </div>
                  </div>
                </div>
              )) : (
                <OverviewEmptyState
                  message={uiText("overview.queue.empty")}
                  actionLabel={uiText("overview.queue.action")}
                  actionHref="/task-runs"
                />
              )}
            </div>
          </div>
        </OverviewSection>

        <OverviewSection
          eyebrow={uiText("overview.invocation.eyebrow")}
          title={uiText("overview.invocation.title")}
          description={uiText("overview.invocation.description")}
        >
          <div className="space-y-4">
            {snapshot.featuredInvocation.length ? snapshot.featuredInvocation.map((stage, index) => (
              <div key={stage.key} className="aw-stage">
                <div className="aw-stage__rail">
                  <span className="aw-stage__dot" />
                  {index < snapshot.featuredInvocation.length - 1 ? <span className="aw-stage__line" /> : null}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-sm font-semibold text-[var(--ink)]">{stage.label}</div>
                    <div className="text-xs text-[var(--ink-subtle)]">{stage.owner}</div>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-[var(--ink-muted)]">{stage.description}</p>
                </div>
              </div>
            )) : (
              <OverviewEmptyState message={uiText("overview.invocation.empty")} />
            )}
          </div>
        </OverviewSection>
        </section>

        <section className="grid gap-6 xl:grid-cols-[0.92fr_1.08fr]">
        <OverviewSection
          eyebrow={uiText("overview.teams.eyebrow")}
          title={uiText("overview.teams.title")}
          description={uiText("overview.teams.description")}
          action={
            <Button asChild variant="ghost" size="sm">
              <Link href="/business-teams">{uiText("overview.teams.action")}</Link>
            </Button>
          }
        >
          <div className="space-y-4">
            {teamHighlights.length ? teamHighlights.map((team, index) => (
              <div key={team.businessTeamId} className="aw-ranking-row">
                <div className="aw-ranking-row__index">{String(index + 1).padStart(2, "0")}</div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold text-[var(--ink)]">{team.businessTeamName}</div>
                  <div className="mt-1 text-xs text-[var(--ink-muted)]">
                    {formatNumber(team.teamCount)} {uiText("overview.teams.agentTeamSuffix")}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-semibold text-[var(--ink)]">{formatNumber(team.taskRunCount)}</div>
                  <div className="mt-1 text-xs text-[var(--ink-subtle)]">
                    {formatNumber(team.activeCount)} {uiText("overview.common.activeSuffix")}
                  </div>
                </div>
              </div>
            )) : (
              <OverviewEmptyState
                message={uiText("overview.teams.empty")}
                actionLabel={uiText("overview.teams.action")}
                actionHref="/business-teams"
              />
            )}
          </div>
        </OverviewSection>

        <OverviewSection
          eyebrow={uiText("overview.blueprints.eyebrow")}
          title={uiText("overview.blueprints.title")}
          description={uiText("overview.blueprints.description")}
          action={
            <Button asChild variant="ghost" size="sm">
              <Link href="/task-blueprints">{uiText("overview.blueprints.action")}</Link>
            </Button>
          }
        >
          <div className="overflow-auto">
            <table className="aw-table min-w-full">
              <thead>
                <tr>
                  <th>{uiText("overview.blueprints.columns.name")}</th>
                  <th>{uiText("overview.blueprints.columns.team")}</th>
                  <th>{uiText("overview.blueprints.columns.trigger")}</th>
                  <th className="text-right">{uiText("overview.blueprints.columns.runs")}</th>
                  <th className="text-right">{uiText("overview.blueprints.columns.findings")}</th>
                </tr>
              </thead>
              <tbody>
                {highlightedBlueprints.length ? highlightedBlueprints.map((blueprint) => (
                  <tr key={blueprint.id}>
                    <td>
                      <div className="font-medium text-[var(--ink)]">{blueprint.name}</div>
                      <div className="mt-1 text-xs text-[var(--ink-muted)]">{blueprint.category}</div>
                    </td>
                    <td>{blueprint.businessTeamName}</td>
                    <td>{translateSourceType(String((blueprint.trigger as Record<string, unknown>).type ?? "manual"))}</td>
                    <td className="text-right">{formatNumber(blueprint.runCount)}</td>
                    <td className="text-right">{formatNumber(blueprint.findingCount)}</td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan={5} className="aw-table__empty">{uiText("overview.blueprints.empty")}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </OverviewSection>
        </section>

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {footerMetrics.map((item) => {
          const Icon = item.icon;
          return (
            <div key={item.label} className="aw-summary-tile">
              <div className="aw-summary-tile__icon">
                <Icon className="h-4 w-4" />
              </div>
              <div className="flex items-center gap-2 text-sm text-[var(--ink-muted)]">
                <span>{item.label}</span>
                <OverviewHint text={item.detail} />
              </div>
              <div className="mt-2 text-[32px] font-light leading-none text-[var(--ink)]">{item.value}</div>
            </div>
          );
        })}
        </section>
      </div>
    </>
  );
}
