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
import { translateSourceType, translateStatus } from "@/lib/presentation";
import { formatDateTime } from "@/lib/utils";
import { getDashboardSnapshot, getSettingsSnapshot } from "@/server/queries";

export default function OverviewPage() {
  const snapshot = getDashboardSnapshot();
  const settings = getSettingsSnapshot();

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Operations"
        title="任务平台总览"
        description="围绕任务运行、Finding、配置完整度和蓝图活跃度组织日常操作视图。"
        badges={[
          { label: `${snapshot.task_runs.length} 个运行实例`, variant: "accent" },
          { label: `${settings.metrics.runtimeBindingCount} 个执行引擎`, variant: "neutral" },
        ]}
      />

      <SummaryStrip items={snapshot.metrics} />

      <section className="grid gap-4 2xl:grid-cols-[1.35fr_0.65fr]">
        <Panel>
          <PanelHeader
            eyebrow="Runs"
            title="最近任务运行"
            description="按来源、团队、状态和时间直接查看最近的任务执行。"
          />
          <PanelBody className="p-0">
            <DataTable>
              <DataTableHeader>
                <DataTableRow className="hover:bg-transparent">
                  <DataTableHead>任务来源</DataTableHead>
                  <DataTableHead>业务团队 / Agent 团队</DataTableHead>
                  <DataTableHead>运行状态</DataTableHead>
                  <DataTableHead>触发方式</DataTableHead>
                  <DataTableHead align="right">创建时间</DataTableHead>
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
                        <div className="mt-1 text-xs text-[var(--ink-muted)]">{taskRun.idempotencyKey ?? "无幂等键"}</div>
                      </DataTableCell>
                      <DataTableCell>
                        <div className="font-medium text-[var(--ink)]">{businessTeam?.name ?? "未知业务团队"}</div>
                        <div className="mt-1 text-xs text-[var(--ink-muted)]">{team?.name ?? "未知 Agent 团队"}</div>
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
            eyebrow="Load"
            title="来源与问题分布"
            description="值班时先看这里，判断负载来自哪里，问题集中在哪个等级。"
          />
          <PanelBody className="space-y-6">
            <div>
              <div className="mb-3 text-[11px] font-medium uppercase tracking-[0.16em] text-[var(--ink-muted)]">
                触发来源
              </div>
              <DataTable>
                <DataTableHeader>
                  <DataTableRow className="hover:bg-transparent">
                    <DataTableHead>来源</DataTableHead>
                    <DataTableHead align="right">运行数</DataTableHead>
                    <DataTableHead align="right">活跃数</DataTableHead>
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
              <div className="mb-3 text-[11px] font-medium uppercase tracking-[0.16em] text-[var(--ink-muted)]">
                Finding 严重级别
              </div>
              <DataTable>
                <DataTableHeader>
                  <DataTableRow className="hover:bg-transparent">
                    <DataTableHead>级别</DataTableHead>
                    <DataTableHead align="right">数量</DataTableHead>
                  </DataTableRow>
                </DataTableHeader>
                <DataTableBody>
                  {snapshot.findingDashboard.bySeverity.map((item) => (
                    <DataTableRow key={item.severity}>
                      <DataTableCell className="font-medium uppercase text-[var(--ink)]">
                        {item.severity}
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
            eyebrow="Readiness"
            title="配置完整度"
            description="从模型接口、执行引擎、蓝图和 Webhook 观察平台可运行程度。"
          />
          <PanelBody>
            <DefinitionList
              items={[
                {
                  label: "模型接口",
                  value: `${settings.metrics.enabledProviderProfileCount}/${settings.metrics.providerProfileCount}`,
                  detail: "已启用模型接口 / 全部接口",
                },
                {
                  label: "执行引擎",
                  value: `${settings.metrics.enabledRuntimeBindingCount}/${settings.metrics.runtimeBindingCount}`,
                  detail: "已启用运行时绑定 / 全部运行时",
                },
                {
                  label: "任务蓝图",
                  value: `${settings.metrics.enabledBlueprintCount}/${settings.metrics.blueprintCount}`,
                  detail: "激活蓝图 / 全部蓝图",
                },
                {
                  label: "Webhook 与环境",
                  value: `${settings.webhooks.length} / ${settings.environments.length}`,
                  detail: "Webhook 入口 / 执行环境",
                },
              ]}
            />
          </PanelBody>
        </Panel>

        <Panel>
          <PanelHeader
            eyebrow="Blueprints"
            title="蓝图目录"
            description="蓝图作为统一任务入口，直接在表格里看触发器、运行量和 Finding 产出。"
          />
          <PanelBody className="p-0">
            <DataTable>
              <DataTableHeader>
                <DataTableRow className="hover:bg-transparent">
                  <DataTableHead>蓝图</DataTableHead>
                  <DataTableHead>类别</DataTableHead>
                  <DataTableHead>触发器</DataTableHead>
                  <DataTableHead align="right">运行数</DataTableHead>
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
