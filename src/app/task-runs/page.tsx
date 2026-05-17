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
        eyebrow="ui.generated.c0a4e01232c"
        title="ui.generated.c95a3020ca1"
        description="ui.generated.c849e36c6f6"
        badges={[
          { label: <>{snapshot.task_runs.length} ui.common.count.runs</>, variant: "accent" },
          { label: <>{activeCount} ui.common.count.activeRuns</>, variant: "neutral" },
        ]}
      />

      <SummaryStrip
        items={[
          {
            label: "ui.generated.c87fd4f5a2c",
            value: activeCount,
            detail: "ui.generated.ca80b58dee8",
          },
          {
            label: "ui.generated.c0d0790ac20",
            value: failedCount,
            detail: "ui.generated.c8da6092a1e",
          },
          {
            label: "ui.generated.cbae9dc4399",
            value: webhookCount,
            detail: "ui.generated.c91ab3c018c",
          },
          {
            label: "ui.generated.ce873245925",
            value: manualCount,
            detail: "ui.generated.c28db4f1237",
          },
        ]}
      />

      <section className="grid gap-4 2xl:grid-cols-[1.45fr_0.55fr]">
        <Panel>
          <PanelHeader
            eyebrow="ui.generated.c471e1f2820"
            title="ui.generated.ca53a0bf86d"
            description="ui.generated.cbdb2b6fe32"
          />
          <PanelBody className="p-0">
            <DataTable>
              <DataTableHeader>
                <DataTableRow className="hover:bg-transparent">
                  <DataTableHead>ui.generated.c7526ca012d</DataTableHead>
                  <DataTableHead>ui.generated.c97fa784b22</DataTableHead>
                  <DataTableHead>ui.generated.c62e951a692</DataTableHead>
                  <DataTableHead>ui.generated.c6c72663ddb</DataTableHead>
                  <DataTableHead align="right">ui.generated.c84e3802f60</DataTableHead>
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
                        <div className="mt-1 text-xs text-[var(--ink-muted)]">{taskRun.idempotencyKey ?? "ui.generated.c2874ba6f1c"}</div>
                      </DataTableCell>
                      <DataTableCell>
                        <div className="font-medium text-[var(--ink)]">{businessTeam?.name ?? "ui.generated.c7ae513bf4d"}</div>
                        <div className="mt-1 text-xs text-[var(--ink-muted)]">{team?.name ?? "ui.generated.c603903ef14"}</div>
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
                          ui.generated.c2a4080ad9f {translateStatus(taskRun.runState)} ui.generated.c7338a0689f {taskRun.priority}
                        </div>
                      </DataTableCell>
                      <DataTableCell>{blueprint?.name ?? "ui.generated.c4d86b98a37"}</DataTableCell>
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
              eyebrow="ui.generated.c2c3ece162f"
              title="ui.generated.c5958ac66a5"
              description="ui.generated.c7918948f96"
            />
            <PanelBody className="p-0">
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
            </PanelBody>
          </Panel>

          <Panel>
            <PanelHeader
              eyebrow="ui.generated.ceb321b2c43"
              title="ui.generated.c8068ee8e7c"
              description="ui.generated.c1dceb6c2b4"
            />
            <PanelBody className="p-0">
              <DataTable>
                <DataTableHeader>
                  <DataTableRow className="hover:bg-transparent">
                    <DataTableHead>ui.generated.c69fffaf196</DataTableHead>
                    <DataTableHead>ui.generated.c62e951a692</DataTableHead>
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
