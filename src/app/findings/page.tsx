import Link from "next/link";
import { Eye, ShieldCheck } from "lucide-react";
import { DeleteResourceButton } from "@/components/delete-resource-button";
import { FindingForm } from "@/components/finding-form";
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
import { DefinitionList } from "@/components/ui/definition-list";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Panel, PanelBody, PanelHeader } from "@/components/ui/panel";
import { SummaryStrip } from "@/components/ui/summary-strip";
import { translateSourceType, translateStatus } from "@/lib/presentation";
import { formatDateTime, formatPercent } from "@/lib/utils";
import { getDashboardSnapshot, listFindings } from "@/server/queries";

function severityVariant(severity: string): "neutral" | "accent" | "success" | "warning" | "danger" {
  if (severity === "critical" || severity === "high") return "danger";
  if (severity === "medium") return "warning";
  if (severity === "low") return "accent";
  return "neutral";
}

function statusVariant(status: string): "neutral" | "accent" | "success" | "warning" | "danger" {
  if (status === "open") return "warning";
  if (status === "fixed") return "success";
  if (status === "false_positive" || status === "ignored") return "neutral";
  if (status === "published") return "accent";
  return "neutral";
}

function parseRecord(value: string) {
  try {
    const parsed = JSON.parse(value) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

export default function FindingsPage() {
  const snapshot = getDashboardSnapshot();
  const findings = listFindings();
  const taskRunOptions = snapshot.task_runs.map((taskRun) => ({
    id: taskRun.id,
    label: `${taskRun.sourceRef ?? taskRun.sourceType} · ${formatDateTime(taskRun.createdAt)}`,
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="风险发现"
        title="Finding 治理"
        description="统一治理代码检视、安全检视和其他任务产出的标准化 Finding，支持误报、忽略、修复和发布状态跟踪。"
        badges={[
          { label: `${findings.length} 条 Finding`, variant: "accent" },
          { label: `${snapshot.findingDashboard.open} 条待处理`, variant: "warning" },
        ]}
        action={<FindingForm taskRuns={taskRunOptions} />}
      />

      <SummaryStrip
        items={[
          { label: "总数", value: snapshot.findingDashboard.total, detail: "全局可见标准化产出" },
          { label: "待处理", value: snapshot.findingDashboard.open, detail: "需要团队确认或修复" },
          { label: "已修复", value: snapshot.findingDashboard.fixed, detail: "已完成闭环" },
          { label: "误报 / 忽略", value: snapshot.findingDashboard.ignored, detail: "已完成治理标记" },
        ]}
      />

      <section className="grid gap-4 xl:grid-cols-[1.25fr_0.75fr]">
        <Panel>
          <PanelHeader
            eyebrow="目录"
            title="Finding 列表"
            description="按任务、团队、严重度和状态跟踪每条问题输出。"
          />
          <PanelBody className="p-0">
            <DataTable>
              <DataTableHeader>
                <DataTableRow className="hover:bg-transparent">
                  <DataTableHead>Finding</DataTableHead>
                  <DataTableHead>任务 / 团队</DataTableHead>
                  <DataTableHead>严重度</DataTableHead>
                  <DataTableHead>状态</DataTableHead>
                  <DataTableHead align="right">操作</DataTableHead>
                </DataTableRow>
              </DataTableHeader>
              <DataTableBody>
                {findings.map((finding) => {
                  const taskRun = snapshot.task_runs.find((item) => item.id === finding.taskRunId);
                  const businessTeam = snapshot.businessTeamSummaries.find((item) => item.id === taskRun?.businessTeamId);
                  const agentTeam = snapshot.teamSummaries.find((item) => item.id === taskRun?.teamId);
                  const evidence = parseRecord(finding.evidenceJson);

                  return (
                    <DataTableRow key={finding.id}>
                      <DataTableCell className="min-w-[320px] max-w-[560px]">
                        <div className="font-semibold text-[var(--ink)]">{finding.title}</div>
                        <div className="mt-1 text-sm leading-6 text-[var(--ink-muted)]">{finding.description}</div>
                        <div className="mt-2 text-xs text-[var(--ink-muted)]">
                          来源 {finding.sourceAgent} · {formatDateTime(finding.createdAt)}
                        </div>
                      </DataTableCell>
                      <DataTableCell className="min-w-[220px]">
                        {taskRun ? (
                          <Link href={`/task-runs/${taskRun.id}`} className="font-medium text-[var(--ink)] hover:underline">
                            {taskRun.sourceRef ?? translateSourceType(taskRun.sourceType)}
                          </Link>
                        ) : (
                          <span className="font-medium text-[var(--ink)]">未知任务</span>
                        )}
                        <div className="mt-1 text-xs text-[var(--ink-muted)]">{businessTeam?.name ?? "未知业务团队"}</div>
                        <div className="mt-1 text-xs text-[var(--ink-muted)]">{agentTeam?.name ?? "未知 Agent 团队"}</div>
                      </DataTableCell>
                      <DataTableCell>
                        <Badge variant={severityVariant(finding.severity)}>
                          {finding.severity} · {finding.category}
                        </Badge>
                        <div className="mt-2 text-xs text-[var(--ink-muted)]">置信度 {formatPercent(finding.confidence)}</div>
                      </DataTableCell>
                      <DataTableCell>
                        <Badge variant={statusVariant(finding.status)}>{translateStatus(finding.status)}</Badge>
                      </DataTableCell>
                      <DataTableCell align="right">
                        <div className="flex justify-end gap-2">
                          <Dialog>
                            <DialogTrigger asChild>
                              <Button size="sm" variant="ghost">
                                <Eye className="h-4 w-4" />
                                查看
                              </Button>
                            </DialogTrigger>
                            <DialogContent className="w-[min(96vw,980px)]">
                              <DialogHeader>
                                <DialogTitle>{finding.title}</DialogTitle>
                                <DialogDescription>Finding 证据、建议、指纹和发布状态。</DialogDescription>
                              </DialogHeader>
                              <DialogBody className="space-y-5">
                                <DefinitionList
                                  columnsClassName="sm:grid-cols-2"
                                  items={[
                                    { label: "ID", value: finding.id },
                                    { label: "任务运行", value: finding.taskRunId },
                                    { label: "来源 Agent", value: finding.sourceAgent },
                                    { label: "类别", value: finding.category },
                                    { label: "严重度", value: finding.severity },
                                    { label: "状态", value: translateStatus(finding.status) },
                                    { label: "置信度", value: formatPercent(finding.confidence) },
                                    { label: "指纹", value: finding.fingerprint },
                                    { label: "文件", value: String(evidence.file_path ?? evidence.filePath ?? "未关联") },
                                    { label: "行号", value: String(evidence.line_start ?? evidence.lineStart ?? "未关联") },
                                  ]}
                                />
                                <div className="rounded-xl border border-[var(--line)] bg-[var(--surface-muted)] p-4">
                                  <div className="text-sm font-semibold text-[var(--ink)]">描述</div>
                                  <div className="mt-2 text-sm leading-6 text-[var(--ink-muted)]">{finding.description}</div>
                                </div>
                                <div className="rounded-xl border border-[var(--line)] bg-[var(--surface-muted)] p-4">
                                  <div className="text-sm font-semibold text-[var(--ink)]">建议</div>
                                  <div className="mt-2 text-sm leading-6 text-[var(--ink-muted)]">{finding.recommendation || "未填写"}</div>
                                </div>
                              </DialogBody>
                            </DialogContent>
                          </Dialog>
                          <FindingForm finding={finding} taskRuns={taskRunOptions} triggerLabel="编辑" />
                          <DeleteResourceButton endpoint="/api/findings" id={finding.id} confirmText={`确认删除 Finding「${finding.title}」？`} />
                        </div>
                      </DataTableCell>
                    </DataTableRow>
                  );
                })}
                {findings.length === 0 ? (
                  <DataTableRow>
                    <DataTableCell>暂无 Finding。</DataTableCell>
                    <DataTableCell>{" "}</DataTableCell>
                    <DataTableCell>{" "}</DataTableCell>
                    <DataTableCell>{" "}</DataTableCell>
                    <DataTableCell>{" "}</DataTableCell>
                  </DataTableRow>
                ) : null}
              </DataTableBody>
            </DataTable>
          </PanelBody>
        </Panel>

        <div className="space-y-4">
          <Panel>
            <PanelHeader eyebrow="严重度" title="严重度分布" description="用于看板聚合和团队风险排序。" />
            <PanelBody className="space-y-3">
              {snapshot.findingDashboard.bySeverity.map((item) => (
                <div key={item.severity} className="flex items-center justify-between rounded-xl border border-[var(--line)] bg-[var(--surface-muted)] px-3 py-2">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="h-4 w-4 text-[var(--ink-muted)]" />
                    <span className="text-sm font-medium text-[var(--ink)]">{item.severity}</span>
                  </div>
                  <Badge variant={severityVariant(item.severity)}>{item.count}</Badge>
                </div>
              ))}
            </PanelBody>
          </Panel>

          <Panel>
            <PanelHeader eyebrow="业务团队" title="团队分布" description="按业务团队聚合待治理问题。" />
            <PanelBody className="p-0">
              <DataTable>
                <DataTableHeader>
                  <DataTableRow className="hover:bg-transparent">
                    <DataTableHead>团队</DataTableHead>
                    <DataTableHead align="right">总数</DataTableHead>
                    <DataTableHead align="right">高危</DataTableHead>
                  </DataTableRow>
                </DataTableHeader>
                <DataTableBody>
                  {snapshot.findingDashboard.byBusinessTeam.map((item) => (
                    <DataTableRow key={item.businessTeamId}>
                      <DataTableCell className="font-medium text-[var(--ink)]">{item.businessTeamName}</DataTableCell>
                      <DataTableCell align="right">{item.count}</DataTableCell>
                      <DataTableCell align="right">{item.criticalOrHigh}</DataTableCell>
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
