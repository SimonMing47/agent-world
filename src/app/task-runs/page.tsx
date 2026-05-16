import Link from "next/link";
import { translateSourceType, translateStatus } from "@/lib/presentation";
import { formatDateTime } from "@/lib/utils";
import { getDashboardSnapshot } from "@/server/queries";

export default function TaskRunsPage() {
  const snapshot = getDashboardSnapshot();

  return (
    <div className="space-y-3">
      {snapshot.task_runs.map((taskRun) => {
        const team = snapshot.teamSummaries.find((item) => item.id === taskRun.teamId);
        const businessTeam = snapshot.businessTeamSummaries.find((item) => item.id === taskRun.businessTeamId);

        return (
          <Link
            key={taskRun.id}
            href={`/task-runs/${taskRun.id}`}
            className="block rounded-[28px] border border-[var(--line)] bg-[var(--surface-strong)] px-5 py-5 transition hover:bg-[var(--surface)]"
          >
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="text-lg font-semibold text-[var(--ink)]">
                  {taskRun.sourceRef ?? taskRun.sourceType}
                </div>
                <div className="mt-1 text-sm text-[var(--ink-muted)]">
                  {team?.name ?? "未知 Agent 团队"} · {businessTeam?.name ?? "未知业务团队"}
                </div>
              </div>
              <div className="text-[11px] uppercase tracking-[0.18em] text-[var(--ink-muted)]">
                {translateStatus(taskRun.status)}
              </div>
            </div>
            <div className="mt-4 grid gap-3 text-sm text-[var(--ink-muted)] md:grid-cols-4">
              <div>来源: {translateSourceType(taskRun.sourceType)}</div>
              <div>优先级: {taskRun.priority}</div>
              <div>预估成本: ${taskRun.costEstimate}</div>
              <div>创建时间: {formatDateTime(taskRun.createdAt)}</div>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
