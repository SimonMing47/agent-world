import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Panel, PanelBody, PanelHeader } from "@/components/ui/panel";
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

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          ["活跃运行", String(activeCount), "排队、执行与等待审批"],
          ["失败运行", String(failedCount), "需要人工检查或重试"],
          ["Webhook 触发", String(webhookCount), "外部事件驱动"],
          ["手动提交", String(manualCount), "控制台即时提交"],
        ].map(([label, value, detail]) => (
          <Panel key={label}>
            <PanelBody className="p-5">
              <div className="text-sm text-[var(--ink-muted)]">{label}</div>
              <div className="mt-2 text-3xl font-semibold text-[var(--ink)]">{value}</div>
              <div className="mt-1 text-sm text-[var(--ink-muted)]">{detail}</div>
            </PanelBody>
          </Panel>
        ))}
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <Panel>
          <PanelHeader
            eyebrow="Run List"
            title="全部运行实例"
            description="按任务来源、状态、业务团队和蓝图入口查看每次执行。"
          />
          <PanelBody className="space-y-3">
            {snapshot.task_runs.map((taskRun) => {
              const team = snapshot.teamSummaries.find((item) => item.id === taskRun.teamId);
              const businessTeam = snapshot.businessTeamSummaries.find((item) => item.id === taskRun.businessTeamId);
              const blueprint = snapshot.taskBlueprints.find((item) => item.id === taskRun.blueprintId);

              return (
                <Link
                  key={taskRun.id}
                  href={`/task-runs/${taskRun.id}`}
                  className="block rounded-xl border border-[var(--line)] bg-[var(--surface-muted)] px-4 py-4 transition hover:border-[var(--line-strong)] hover:bg-white"
                >
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant={taskRun.status === "failed" ? "danger" : taskRun.status === "running" ? "accent" : "neutral"}>
                          {translateStatus(taskRun.status)}
                        </Badge>
                        <Badge variant="neutral">{translateSourceType(taskRun.sourceType)}</Badge>
                        {blueprint ? <Badge variant="neutral">{blueprint.category}</Badge> : null}
                      </div>
                      <div className="mt-3 text-lg font-semibold text-[var(--ink)]">
                        {taskRun.sourceRef ?? taskRun.sourceType}
                      </div>
                      <div className="mt-1 text-sm text-[var(--ink-muted)]">
                        {team?.name ?? "未知 Agent 团队"} · {businessTeam?.name ?? "未知业务团队"}
                      </div>
                      <div className="mt-3 grid gap-2 text-sm text-[var(--ink-muted)] sm:grid-cols-2 xl:grid-cols-3">
                        <div>运行状态: {translateStatus(taskRun.runState)}</div>
                        <div>优先级: {taskRun.priority}</div>
                        <div>幂等键: {taskRun.idempotencyKey ?? "无"}</div>
                        <div>创建时间: {formatDateTime(taskRun.createdAt)}</div>
                        {blueprint ? <div>蓝图: {blueprint.name}</div> : null}
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })}
          </PanelBody>
        </Panel>

        <Panel>
          <PanelHeader
            eyebrow="By Source"
            title="来源与队列观察"
            description="帮助值班时快速判断负载从哪里来，以及哪一类任务正在堆积。"
          />
          <PanelBody className="space-y-4">
            <div className="space-y-3">
              {snapshot.taskExecutionDashboard.bySourceType.map((item) => (
                <div key={item.sourceType} className="rounded-xl border border-[var(--line)] bg-[var(--surface-muted)] p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-sm font-medium text-[var(--ink)]">{translateSourceType(item.sourceType)}</div>
                    <div className="text-sm text-[var(--ink-muted)]">{item.taskRunCount} 次</div>
                  </div>
                  <div className="mt-2 text-sm text-[var(--ink-muted)]">
                    活跃 {item.activeCount} · 其余 {Math.max(0, item.taskRunCount - item.activeCount)}
                  </div>
                </div>
              ))}
            </div>
            <div className="rounded-xl border border-[var(--line)] bg-[var(--surface-muted)] p-4">
              <div className="text-sm font-medium text-[var(--ink)]">最近关注</div>
              <div className="mt-3 space-y-2">
                {snapshot.task_runs.slice(0, 4).map((taskRun) => (
                  <div key={taskRun.id} className="flex items-start justify-between gap-3 text-sm">
                    <div className="min-w-0">
                      <div className="truncate text-[var(--ink)]">{taskRun.sourceRef ?? taskRun.sourceType}</div>
                      <div className="text-[var(--ink-muted)]">{formatDateTime(taskRun.createdAt)}</div>
                    </div>
                    <Badge variant={taskRun.status === "failed" ? "danger" : "neutral"}>
                      {translateStatus(taskRun.status)}
                    </Badge>
                  </div>
                ))}
              </div>
            </div>
          </PanelBody>
        </Panel>
      </section>
    </div>
  );
}
