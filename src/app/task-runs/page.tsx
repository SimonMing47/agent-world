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
import { translateSourceType, translateStatus } from "@/lib/presentation";
import { formatDateTime } from "@/lib/utils";
import { getDashboardSnapshot } from "@/server/queries";

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
        eyebrow="Runs"
        title="任务运行中心"
        description="集中查看运行实例、当前状态、触发来源和所属团队，快速进入单次任务的执行空间。"
        badges={[
          { label: `${snapshot.task_runs.length} 个运行实例`, variant: "accent" },
          { label: `${activeCount} 个活跃运行`, variant: "neutral" },
        ]}
      />

      <SummaryStrip
        items={[
          {
            label: "活跃运行",
            value: activeCount,
            detail: "排队、执行与等待审批",
          },
          {
            label: "失败运行",
            value: failedCount,
            detail: "需要人工检查或重试",
          },
          {
            label: "Webhook 触发",
            value: webhookCount,
            detail: "外部事件驱动",
          },
          {
            label: "手动提交",
            value: manualCount,
            detail: "控制台即时提交",
          },
        ]}
      />

      <section className="grid gap-4 2xl:grid-cols-[1.45fr_0.55fr]">
        <Panel>
          <PanelHeader
            eyebrow="Run List"
            title="全部运行实例"
            description="按蓝图、业务团队、来源和状态浏览每次执行。"
          />
          <PanelBody className="p-0">
            <DataTable>
              <DataTableHeader>
                <DataTableRow className="hover:bg-transparent">
                  <DataTableHead>任务来源</DataTableHead>
                  <DataTableHead>业务团队 / Agent 团队</DataTableHead>
                  <DataTableHead>状态</DataTableHead>
                  <DataTableHead>蓝图</DataTableHead>
                  <DataTableHead align="right">创建时间</DataTableHead>
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
                        <div className="mt-1 text-xs text-[var(--ink-muted)]">{taskRun.idempotencyKey ?? "无幂等键"}</div>
                      </DataTableCell>
                      <DataTableCell>
                        <div className="font-medium text-[var(--ink)]">{businessTeam?.name ?? "未知业务团队"}</div>
                        <div className="mt-1 text-xs text-[var(--ink-muted)]">{team?.name ?? "未知 Agent 团队"}</div>
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
                          运行状态 {translateStatus(taskRun.runState)} · 优先级 {taskRun.priority}
                        </div>
                      </DataTableCell>
                      <DataTableCell>{blueprint?.name ?? "未绑定蓝图"}</DataTableCell>
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
              eyebrow="By Source"
              title="来源分布"
              description="帮助值班时快速判断负载从哪里来。"
            />
            <PanelBody className="p-0">
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
            </PanelBody>
          </Panel>

          <Panel>
            <PanelHeader
              eyebrow="Watch List"
              title="最近关注"
              description="优先打开这些实例查看轨迹与人工干预情况。"
            />
            <PanelBody className="p-0">
              <DataTable>
                <DataTableHeader>
                  <DataTableRow className="hover:bg-transparent">
                    <DataTableHead>实例</DataTableHead>
                    <DataTableHead>状态</DataTableHead>
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
