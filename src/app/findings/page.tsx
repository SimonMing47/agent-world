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
import { translateSeverity, translateSourceType, translateStatus } from "@/lib/presentation";
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
        eyebrow="ui.generated.c087f7742ab"
        title="ui.generated.c3c2f7b1bc9"
        description="ui.generated.ca3a3defa78"
        badges={[
          { label: <>{findings.length} ui.common.count.findings</>, variant: "accent" },
          { label: <>{snapshot.findingDashboard.open} ui.common.count.pendingFindings</>, variant: "warning" },
        ]}
        action={<FindingForm taskRuns={taskRunOptions} />}
      />

      <SummaryStrip
        items={[
          { label: "ui.generated.c367ff5ddd2", value: snapshot.findingDashboard.total, detail: "ui.generated.c9be6127f66" },
          { label: "ui.generated.c59a9eb4e65", value: snapshot.findingDashboard.open, detail: "ui.generated.c5c87e784a7" },
          { label: "ui.generated.c50138c31ac", value: snapshot.findingDashboard.fixed, detail: "ui.generated.c6f869a13c8" },
          { label: "ui.generated.c00c1d44669", value: snapshot.findingDashboard.ignored, detail: "ui.generated.ce431fe3b99" },
        ]}
      />

      <section className="grid gap-4 xl:grid-cols-[1.25fr_0.75fr]">
        <Panel>
          <PanelHeader
            eyebrow="ui.generated.c41e5243e2d"
            title="ui.generated.c67338b8943"
            description="ui.generated.c3ffa0f5496"
          />
          <PanelBody className="p-0">
            <DataTable>
              <DataTableHeader>
                <DataTableRow className="hover:bg-transparent">
                  <DataTableHead>Finding</DataTableHead>
                  <DataTableHead>ui.generated.cc68f33b124</DataTableHead>
                  <DataTableHead>ui.generated.c9272e8abe5</DataTableHead>
                  <DataTableHead>ui.generated.c62e951a692</DataTableHead>
                  <DataTableHead align="right">ui.generated.cf3ea6d345e</DataTableHead>
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
                          ui.generated.cc63f79e636 {finding.sourceAgent} · {formatDateTime(finding.createdAt)}
                        </div>
                      </DataTableCell>
                      <DataTableCell className="min-w-[220px]">
                        {taskRun ? (
                          <Link href={`/task-runs/${taskRun.id}`} className="font-medium text-[var(--ink)] hover:underline">
                            {taskRun.sourceRef ?? translateSourceType(taskRun.sourceType)}
                          </Link>
                        ) : (
                          <span className="font-medium text-[var(--ink)]">ui.generated.cfbc9e2d0eb</span>
                        )}
                        <div className="mt-1 text-xs text-[var(--ink-muted)]">{businessTeam?.name ?? "ui.generated.c7ae513bf4d"}</div>
                        <div className="mt-1 text-xs text-[var(--ink-muted)]">{agentTeam?.name ?? "ui.generated.c603903ef14"}</div>
                      </DataTableCell>
                      <DataTableCell>
                        <Badge variant={severityVariant(finding.severity)}>
                          {translateSeverity(finding.severity)} · {finding.category}
                        </Badge>
                        <div className="mt-2 text-xs text-[var(--ink-muted)]">ui.generated.cb78c2dc2e2 {formatPercent(finding.confidence)}</div>
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
                                ui.generated.cf7acefd2d4
                              </Button>
                            </DialogTrigger>
                            <DialogContent className="w-[min(96vw,980px)]">
                              <DialogHeader>
                                <DialogTitle>{finding.title}</DialogTitle>
                                <DialogDescription>ui.generated.c7a5eec95ff</DialogDescription>
                              </DialogHeader>
                              <DialogBody className="space-y-5">
                                <DefinitionList
                                  columnsClassName="sm:grid-cols-2"
                                  items={[
                                    { label: "ID", value: finding.id },
                                    { label: "ui.generated.c0a4e01232c", value: finding.taskRunId },
                                    { label: "ui.generated.cbcd2a00caf", value: finding.sourceAgent },
                                    { label: "ui.generated.ced9f6d4d8e", value: finding.category },
                                    { label: "ui.generated.c9272e8abe5", value: translateSeverity(finding.severity) },
                                    { label: "ui.generated.c62e951a692", value: translateStatus(finding.status) },
                                    { label: "ui.generated.cb78c2dc2e2", value: formatPercent(finding.confidence) },
                                    { label: "ui.generated.c3852a0ca84", value: finding.fingerprint },
                                    { label: "ui.generated.c49deaf7da2", value: String(evidence.file_path ?? evidence.filePath ?? "ui.generated.ced5e011db4") },
                                    { label: "ui.generated.cf81e575f4c", value: String(evidence.line_start ?? evidence.lineStart ?? "ui.generated.ced5e011db4") },
                                  ]}
                                />
                                <div className="rounded-xl border border-[var(--line)] bg-[var(--surface-muted)] p-4">
                                  <div className="text-sm font-semibold text-[var(--ink)]">ui.generated.c412f54dc38</div>
                                  <div className="mt-2 text-sm leading-6 text-[var(--ink-muted)]">{finding.description}</div>
                                </div>
                                <div className="rounded-xl border border-[var(--line)] bg-[var(--surface-muted)] p-4">
                                  <div className="text-sm font-semibold text-[var(--ink)]">ui.generated.cc5134eb19c</div>
                                  <div className="mt-2 text-sm leading-6 text-[var(--ink-muted)]">{finding.recommendation || "ui.generated.c287a1d1034"}</div>
                                </div>
                              </DialogBody>
                            </DialogContent>
                          </Dialog>
                          <FindingForm finding={finding} taskRuns={taskRunOptions} triggerLabel="ui.generated.ca7f814c0a4" />
                          <DeleteResourceButton endpoint="/api/findings" id={finding.id} confirmParams={{ resource: "ui.common.resources.finding", name: finding.title }} />
                        </div>
                      </DataTableCell>
                    </DataTableRow>
                  );
                })}
                {findings.length === 0 ? (
                  <DataTableRow>
                    <DataTableCell>ui.generated.c91598b8f0c</DataTableCell>
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
            <PanelHeader eyebrow="ui.generated.c9272e8abe5" title="ui.generated.cb158049ba8" description="ui.generated.cd06fb4d9e4" />
            <PanelBody className="space-y-3">
              {snapshot.findingDashboard.bySeverity.map((item) => (
                <div key={item.severity} className="flex items-center justify-between rounded-xl border border-[var(--line)] bg-[var(--surface-muted)] px-3 py-2">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="h-4 w-4 text-[var(--ink-muted)]" />
                    <span className="text-sm font-medium text-[var(--ink)]">{translateSeverity(item.severity)}</span>
                  </div>
                  <Badge variant={severityVariant(item.severity)}>{item.count}</Badge>
                </div>
              ))}
            </PanelBody>
          </Panel>

          <Panel>
            <PanelHeader eyebrow="ui.generated.c2b90028ff3" title="ui.generated.c7468614ccd" description="ui.generated.ce0ec692321" />
            <PanelBody className="p-0">
              <DataTable>
                <DataTableHeader>
                  <DataTableRow className="hover:bg-transparent">
                    <DataTableHead>ui.generated.c21d7042ff0</DataTableHead>
                    <DataTableHead align="right">ui.generated.c367ff5ddd2</DataTableHead>
                    <DataTableHead align="right">ui.generated.ce62ee8c03e</DataTableHead>
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
