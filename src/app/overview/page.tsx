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
  if (status === "completed" || status === "succeeded" || status === "passed") return "success";
  return "neutral";
}

export default function OverviewPage() {
  const languagePack = getActiveLanguagePack();
  const t = (key: string, fallback?: string, params?: Record<string, string | number>) =>
    translateWithPack(languagePack, key, fallback, params);
  const snapshot = getDashboardSnapshot();
  const settings = getSettingsSnapshot();
  const runtimeSessions = listRuntimeSessions().slice(0, 5);

  const businessTeamHighlights = snapshot.businessTeamSummaries
    .slice()
    .sort((left, right) => right.toolRefCount - left.toolRefCount || left.name.localeCompare(right.name))
    .slice(0, 6);
  const highlightedBlueprints = snapshot.taskBlueprints.slice(0, 6);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={t("overview.hero.brandLabel")}
        title={t("overview.hero.title")}
        badges={[
          { label: t("overview.hero.teamBadge", undefined, { count: snapshot.teamSummaries.length }), variant: "accent" },
          {
            label: t("overview.hero.modelServiceBadge", undefined, { count: settings.metrics.providerProfileCount }),
            variant: "neutral",
          },
        ]}
        action={
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="primary" size="md" className="rounded-full px-5">
              <Link href="/team-wallboard">{t("overview.hero.primaryAction")}</Link>
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
            label: t("overview.stats.businessTeams"),
            value: formatNumber(snapshot.businessTeamSummaries.length),
            detail: t("overview.stats.businessTeamsDetail"),
            tone: snapshot.businessTeamSummaries.length > 0 ? "accent" : "default",
          },
          {
            label: t("overview.stats.agentTeams"),
            value: formatNumber(snapshot.teamSummaries.length),
            detail: t("overview.stats.agentTeamsDetail"),
            tone: snapshot.teamSummaries.length > 0 ? "accent" : "default",
          },
          {
            label: t("overview.stats.modelServices"),
            value: formatNumber(settings.metrics.providerProfileCount),
            detail: t("overview.stats.modelServicesDetail"),
            tone: settings.metrics.providerProfileCount > 0 ? "accent" : "default",
          },
          {
            label: t("overview.stats.runtimeEndpoints"),
            value: formatNumber(snapshot.runtimes.length),
            detail: t("overview.stats.runtimeEndpointsDetail"),
            tone: snapshot.runtimes.length > 0 ? "accent" : "default",
          },
        ]}
      />

      <div className="grid gap-6">
        <Panel>
          <PanelHeader
            eyebrow={t("overview.interactions.eyebrow")}
            title={t("overview.interactions.title")}
            description={t("overview.interactions.description")}
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
                    <DataTableHead>{t("ui.generated.c836ffe0e10")}</DataTableHead>
                    <DataTableHead>{t("ui.generated.c093dea88c9")}</DataTableHead>
                    <DataTableHead>{t("ui.generated.c8e175e7aa9")}</DataTableHead>
                    <DataTableHead align="right">{t("ui.generated.cf3ea6d345e")}</DataTableHead>
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
                          {t(`labels.status.${session.status}`, session.status)}
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
            eyebrow={t("overview.teams.eyebrow")}
            title={t("overview.teams.title")}
            description={t("overview.teams.description")}
            action={
              <Button asChild size="sm" variant="ghost">
                <Link href="/business-teams">{t("overview.teams.action")}</Link>
              </Button>
            }
          />
          <PanelBody className="space-y-1">
            {businessTeamHighlights.length ? (
              businessTeamHighlights.map((team) => (
                <div key={team.id} className="aw-metric-row">
                  <div>
                    <div className="text-sm font-medium text-[var(--ink)]">{team.name}</div>
                    <div className="mt-1 max-w-[220px] truncate text-xs text-[var(--ink-muted)]">{team.privateMemoryNamespace}</div>
                  </div>
                  <div className="text-right">
                    <div className="aw-metric-row__value">{formatNumber(team.toolRefCount)}</div>
                    <div className="mt-1 text-xs text-[var(--ink-muted)]">
                      {t("overview.teams.toolSuffix")}
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
            eyebrow={t("overview.blueprints.eyebrow")}
            title={t("overview.blueprints.title")}
            description={t("overview.blueprints.description")}
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
                    <DataTableHead align="right">{t("overview.blueprints.columns.status")}</DataTableHead>
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
                      <DataTableCell>
                        {t(`labels.sourceType.${String((blueprint.trigger as Record<string, unknown>).type ?? "manual")}`)}
                      </DataTableCell>
                      <DataTableCell align="right">
                        <Badge variant={statusVariant(blueprint.status)}>{t(`labels.status.${blueprint.status}`)}</Badge>
                      </DataTableCell>
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
