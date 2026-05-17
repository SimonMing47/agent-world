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
import { DefinitionList } from "@/components/ui/definition-list";
import { Panel, PanelBody, PanelHeader } from "@/components/ui/panel";
import { SummaryStrip } from "@/components/ui/summary-strip";
import { translateSeverity, translateSourceType, translateStatus } from "@/lib/presentation";
import { formatDateTime } from "@/lib/utils";
import { getDashboardSnapshot, getSettingsSnapshot } from "@/server/queries";

export default function OverviewPage() {
  const snapshot = getDashboardSnapshot();
  const settings = getSettingsSnapshot();

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="ui.generated.cc122e1758c"
        title="ui.generated.cdf49420f76"
        description="ui.generated.c6310a0e06c"
        badges={[
          { label: <>{snapshot.task_runs.length} ui.common.count.runs</>, variant: "accent" },
          { label: <>{settings.metrics.providerProfileCount} ui.common.count.modelServices</>, variant: "neutral" },
        ]}
      />

      <SummaryStrip items={snapshot.metrics} />

      <section className="grid gap-4 2xl:grid-cols-[1.35fr_0.65fr]">
        <Panel>
          <PanelHeader
            eyebrow="ui.generated.c0a4e01232c"
            title="ui.generated.c11a785d660"
            description="ui.generated.c571219824d"
          />
          <PanelBody className="p-0">
            <DataTable>
              <DataTableHeader>
                <DataTableRow className="hover:bg-transparent">
                  <DataTableHead>ui.generated.c7526ca012d</DataTableHead>
                  <DataTableHead>ui.generated.c97fa784b22</DataTableHead>
                  <DataTableHead>ui.generated.c2a4080ad9f</DataTableHead>
                  <DataTableHead>ui.generated.cf67f1852d8</DataTableHead>
                  <DataTableHead align="right">ui.generated.c84e3802f60</DataTableHead>
                </DataTableRow>
              </DataTableHeader>
              <DataTableBody>
                {snapshot.task_runs.slice(0, 8).map((taskRun) => {
                  const team = snapshot.teamSummaries.find((item) => item.id === taskRun.teamId);
                  const businessTeam = snapshot.businessTeamSummaries.find((item) => item.id === taskRun.businessTeamId);

                  return (
                    <DataTableRow key={taskRun.id}>
                      <DataTableCell className="min-w-[220px]">
                        <Link href={`/task-runs/${taskRun.id}`} className="font-medium text-[var(--ink)] hover:underline">
                          {taskRun.sourceRef ?? taskRun.sourceType}
                        </Link>
                        <div className="mt-1 text-xs text-[var(--ink-muted)]">{taskRun.idempotencyKey ?? "ui.generated.c2874ba6f1c"}</div>
                      </DataTableCell>
                      <DataTableCell>
                        <div className="font-medium text-[var(--ink)]">{businessTeam?.name ?? "ui.generated.c7ae513bf4d"}</div>
                        <div className="mt-1 text-xs text-[var(--ink-muted)]">{team?.name ?? "ui.generated.c603903ef14"}</div>
                      </DataTableCell>
                      <DataTableCell>
                        <div>
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
                        </div>
                        <div className="mt-2 text-xs text-[var(--ink-muted)]">{translateStatus(taskRun.runState)}</div>
                      </DataTableCell>
                      <DataTableCell>{translateSourceType(taskRun.sourceType)}</DataTableCell>
                      <DataTableCell align="right">{formatDateTime(taskRun.createdAt)}</DataTableCell>
                    </DataTableRow>
                  );
                })}
              </DataTableBody>
            </DataTable>
          </PanelBody>
        </Panel>

        <Panel>
          <PanelHeader
            eyebrow="ui.generated.c4d5e4d7797"
            title="ui.generated.c600f0cb918"
            description="ui.generated.cf86759abbc"
          />
          <PanelBody className="space-y-6">
            <div>
              <div className="mb-3 text-xs font-medium text-[var(--ink-muted)]">
                ui.generated.c3a2573f2a1
              </div>
              <DataTable>
                <DataTableHeader>
                  <DataTableRow className="hover:bg-transparent">
                    <DataTableHead>ui.generated.cc63f79e636</DataTableHead>
                    <DataTableHead align="right">ui.generated.cc184a1f9d0</DataTableHead>
                    <DataTableHead align="right">ui.generated.cb135b311ab</DataTableHead>
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
            </div>

            <div>
              <div className="mb-3 text-xs font-medium text-[var(--ink-muted)]">
                ui.generated.c970b477286
              </div>
              <DataTable>
                <DataTableHeader>
                  <DataTableRow className="hover:bg-transparent">
                    <DataTableHead>ui.generated.c2548499200</DataTableHead>
                    <DataTableHead align="right">ui.generated.cb9ae893190</DataTableHead>
                  </DataTableRow>
                </DataTableHeader>
                <DataTableBody>
                  {snapshot.findingDashboard.bySeverity.map((item) => (
                    <DataTableRow key={item.severity}>
                      <DataTableCell className="font-medium text-[var(--ink)]">
                        {translateSeverity(item.severity)}
                      </DataTableCell>
                      <DataTableCell align="right">{item.count}</DataTableCell>
                    </DataTableRow>
                  ))}
                </DataTableBody>
              </DataTable>
            </div>
          </PanelBody>
        </Panel>
      </section>

      <section className="grid gap-4 xl:grid-cols-[0.8fr_1.2fr]">
        <Panel>
          <PanelHeader
            eyebrow="ui.generated.c1d2cbbea2f"
            title="ui.generated.c4ae36a315e"
            description="ui.generated.c4c59ef3914"
          />
          <PanelBody>
            <DefinitionList
              items={[
                {
                  label: "ui.generated.cbc56f948bb",
                  value: `${settings.metrics.enabledProviderProfileCount}/${settings.metrics.providerProfileCount}`,
                  detail: "ui.generated.c284ed6750f",
                },
                {
                  label: "ui.generated.c2e17bc4894",
                  value: `${settings.metrics.enabledBlueprintCount}/${settings.metrics.blueprintCount}`,
                  detail: "ui.generated.cee6d753fb9",
                },
                {
                  label: "ui.generated.c65243bac10",
                  value: `${settings.webhooks.length} / ${settings.environments.length}`,
                  detail: "ui.generated.c7324947cb6",
                },
              ]}
            />
          </PanelBody>
        </Panel>

        <Panel>
          <PanelHeader
            eyebrow="ui.generated.c2e17bc4894"
            title="ui.generated.cacc75374db"
            description="ui.generated.c21a3fd73aa"
          />
          <PanelBody className="p-0">
            <DataTable>
              <DataTableHeader>
                <DataTableRow className="hover:bg-transparent">
                  <DataTableHead>ui.generated.c6c72663ddb</DataTableHead>
                  <DataTableHead>ui.generated.ced9f6d4d8e</DataTableHead>
                  <DataTableHead>ui.generated.c2d189a3f46</DataTableHead>
                  <DataTableHead align="right">ui.generated.cc184a1f9d0</DataTableHead>
                  <DataTableHead align="right">Finding</DataTableHead>
                </DataTableRow>
              </DataTableHeader>
              <DataTableBody>
                {snapshot.taskBlueprints.map((blueprint) => (
                  <DataTableRow key={blueprint.id}>
                    <DataTableCell className="min-w-[220px]">
                      <Link
                        href={`/task-blueprints/${blueprint.id}`}
                        className="font-medium text-[var(--ink)] hover:underline"
                      >
                        {blueprint.name}
                      </Link>
                      <div className="mt-1 text-xs text-[var(--ink-muted)]">{blueprint.businessTeamName}</div>
                    </DataTableCell>
                    <DataTableCell>
                      <div className="flex items-center gap-2">
                        <Badge variant="neutral">{blueprint.category}</Badge>
                        <Badge variant={blueprint.status === "active" ? "success" : "neutral"}>
                          {translateStatus(blueprint.status)}
                        </Badge>
                      </div>
                    </DataTableCell>
                    <DataTableCell>{String((blueprint.trigger as Record<string, unknown>).type ?? "manual")}</DataTableCell>
                    <DataTableCell align="right">{blueprint.runCount}</DataTableCell>
                    <DataTableCell align="right">{blueprint.findingCount}</DataTableCell>
                  </DataTableRow>
                ))}
              </DataTableBody>
            </DataTable>
          </PanelBody>
        </Panel>
      </section>
    </div>
  );
}
