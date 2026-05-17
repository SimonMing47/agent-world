import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { BlueprintSubmitConsole } from "@/components/blueprint-submit-console";
import { PageHeader } from "@/components/page-header";
import { TaskBlueprintEditor } from "@/components/task-blueprint-editor";
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
import { translateStatus, translateVisibility } from "@/lib/presentation";
import { formatDateTime } from "@/lib/utils";
import { getTaskBlueprintDetail } from "@/server/queries";

type BadgeVariant = "neutral" | "accent" | "success" | "warning" | "danger";

function JsonBlock({ value }: { value: unknown }) {
  return (
    <pre className="max-h-[360px] overflow-auto rounded-xl border border-[var(--line)] bg-[var(--surface-muted)] p-4 text-xs leading-5 text-[var(--ink-muted)]">
      {JSON.stringify(value, null, 2)}
    </pre>
  );
}

function EmptyState({ children }: { children: ReactNode }) {
  return (
    <div className="border border-dashed border-[var(--line)] px-4 py-6 text-sm text-[var(--ink-muted)]">
      {children}
    </div>
  );
}

function statusVariant(status: string): BadgeVariant {
  if (["failed", "rejected", "blocked"].includes(status)) return "danger";
  if (["active", "completed", "succeeded", "approved", "healthy"].includes(status)) return "success";
  if (["running", "queued", "awaiting", "draft", "paused"].includes(status)) return "accent";
  return "neutral";
}

function effectVariant(effect: string): BadgeVariant {
  if (effect === "deny") return "danger";
  if (effect === "ask") return "warning";
  if (effect === "allow") return "success";
  return "neutral";
}

function severityVariant(severity: string): BadgeVariant {
  if (["critical", "high"].includes(severity)) return "danger";
  if (severity === "medium") return "warning";
  return "neutral";
}

function formatTrigger(trigger: Record<string, unknown>) {
  if (trigger.type === "webhook") return `Webhook · ${String(trigger.event ?? trigger.webhookPathKey ?? "")}`;
  if (trigger.type === "cron") return `Cron · ${String(trigger.expression ?? "")}`;
  return String(trigger.type ?? "manual");
}

function buildInputDraft(schema: Record<string, unknown>) {
  const properties =
    schema.properties && typeof schema.properties === "object" && !Array.isArray(schema.properties)
      ? (schema.properties as Record<string, Record<string, unknown>>)
      : {};
  const required =
    Array.isArray(schema.required) ? new Set(schema.required.map(String)) : new Set<string>();

  return Object.fromEntries(
    Object.entries(properties).map(([key, definition]) => {
      if (definition.default !== undefined) return [key, definition.default];
      if (definition.enum && Array.isArray(definition.enum) && definition.enum.length > 0) {
        return [key, definition.enum[0]];
      }
      if (!required.has(key)) return [key, null];
      const type = definition.type;
      if (type === "number" || type === "integer") return [key, 0];
      if (type === "boolean") return [key, false];
      if (type === "array") return [key, []];
      if (type === "object") return [key, {}];
      return [key, ""];
    }),
  );
}

function getSchemaRows(schema: Record<string, unknown>) {
  const properties =
    schema.properties && typeof schema.properties === "object" && !Array.isArray(schema.properties)
      ? (schema.properties as Record<string, Record<string, unknown>>)
      : {};
  const required =
    Array.isArray(schema.required) ? new Set(schema.required.map(String)) : new Set<string>();

  return Object.entries(properties).map(([name, definition]) => ({
    name,
    type: Array.isArray(definition.type) ? definition.type.join(" | ") : String(definition.type ?? "any"),
    required: required.has(name),
    description: String(definition.description ?? ""),
    defaultValue: definition.default,
    enumValues: Array.isArray(definition.enum) ? definition.enum.map(String) : [],
  }));
}

function compactJson(value: unknown) {
  if (value === undefined || value === null || value === "") return "无";
  if (Array.isArray(value)) return value.length ? value.map(String).join(", ") : "无";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

export default async function TaskBlueprintDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const resolved = await params;
  const detail = getTaskBlueprintDetail(resolved.id);

  if (!detail) {
    notFound();
  }

  const inputSchemaRows = getSchemaRows(detail.inputSchema);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="任务详情"
        title={detail.blueprint.name}
        description="从同一工作台维护任务定义、提交调试输入、预览权限和追踪最近运行。"
        badges={[
          { label: translateStatus(detail.blueprint.status), variant: statusVariant(detail.blueprint.status) },
          { label: translateVisibility(detail.blueprint.visibility), variant: "neutral" },
          { label: detail.blueprint.category, variant: "accent" },
          { label: `v${detail.blueprint.version}`, variant: "neutral" },
        ]}
      />

      <SummaryStrip
        items={[
          { label: "最近运行", value: detail.recentRuns.length, detail: "最近 8 个实例" },
          { label: "Finding", value: detail.findings.length, detail: "最近 8 条问题" },
          { label: "权限规则", value: detail.permissionPreview.rules.length, detail: `默认 ${detail.permissionPreview.defaultMode}` },
          { label: "编排节点", value: detail.runPlan.nodeCount, detail: detail.runPlan.strategy },
        ]}
      />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_460px]">
        <section className="space-y-4">
          <Panel>
            <PanelHeader
              eyebrow="摘要"
              title="蓝图定义"
              description="稳定字段用定义列表展示，围绕任务、Agent 团队、环境和触发方式组织。"
            />
            <PanelBody>
              <DefinitionList
                columnsClassName="md:grid-cols-2"
                items={[
                  { label: "蓝图 ID", value: detail.blueprint.id },
                  { label: "类别", value: detail.blueprint.category },
                  { label: "业务团队", value: detail.businessTeamName },
                  { label: "Agent 团队", value: detail.agentTeamName },
                  { label: "执行环境", value: detail.environmentName },
                  { label: "模型服务", value: detail.providerName },
                  { label: "创建时间", value: formatDateTime(detail.blueprint.createdAt) },
                  { label: "更新时间", value: formatDateTime(detail.blueprint.updatedAt) },
                ]}
              />
            </PanelBody>
          </Panel>

          <Panel>
            <PanelHeader
              eyebrow="触发与输入"
              title="触发器与输入 Schema"
              description="触发器用定义列表，Schema 字段用表格便于横向比对。"
            />
            <PanelBody className="space-y-5">
              <DefinitionList
                columnsClassName="md:grid-cols-3"
                items={[
                  { label: "触发器", value: formatTrigger(detail.trigger) },
                  { label: "类型", value: String(detail.trigger.type ?? "manual") },
                  { label: "连接器", value: String(detail.trigger.connector ?? "无") },
                  { label: "事件", value: String(detail.trigger.event ?? "无") },
                  { label: "Webhook", value: String(detail.trigger.webhookPathKey ?? "无") },
                  { label: "幂等键", value: String(detail.trigger.idempotencyKey ?? "无") },
                ]}
              />

              {inputSchemaRows.length === 0 ? (
                <EmptyState>当前输入 Schema 没有声明 properties。</EmptyState>
              ) : (
                <DataTable>
                  <DataTableHeader>
                    <DataTableRow>
                      <DataTableHead>字段</DataTableHead>
                      <DataTableHead>类型</DataTableHead>
                      <DataTableHead>必填</DataTableHead>
                      <DataTableHead>默认 / 枚举</DataTableHead>
                      <DataTableHead>说明</DataTableHead>
                    </DataTableRow>
                  </DataTableHeader>
                  <DataTableBody>
                    {inputSchemaRows.map((field) => (
                      <DataTableRow key={field.name}>
                        <DataTableCell className="font-medium text-[var(--ink)]">{field.name}</DataTableCell>
                        <DataTableCell>{field.type}</DataTableCell>
                        <DataTableCell>
                          <Badge variant={field.required ? "warning" : "neutral"}>
                            {field.required ? "必填" : "可选"}
                          </Badge>
                        </DataTableCell>
                        <DataTableCell>
                          {field.enumValues.length > 0 ? field.enumValues.join(", ") : compactJson(field.defaultValue)}
                        </DataTableCell>
                        <DataTableCell>{field.description || "无"}</DataTableCell>
                      </DataTableRow>
                    ))}
                  </DataTableBody>
                </DataTable>
              )}
            </PanelBody>
          </Panel>

          <Panel>
            <PanelHeader
              eyebrow="权限"
              title="权限预览"
              description="按最终优先级展示 allow / ask / deny 规则。"
            />
            <PanelBody className="space-y-4">
              <SummaryStrip
                gridClassName="grid-cols-3"
                items={[
                  { label: "Allow", value: detail.permissionPreview.counts.allow },
                  { label: "Ask", value: detail.permissionPreview.counts.ask },
                  { label: "Deny", value: detail.permissionPreview.counts.deny },
                ]}
              />
              {detail.permissionPreview.rules.length === 0 ? (
                <EmptyState>没有显式权限规则，将使用默认模式。</EmptyState>
              ) : (
                <DataTable>
                  <DataTableHeader>
                    <DataTableRow>
                      <DataTableHead>Effect</DataTableHead>
                      <DataTableHead>Resource</DataTableHead>
                      <DataTableHead>Scope</DataTableHead>
                      <DataTableHead>Reason</DataTableHead>
                    </DataTableRow>
                  </DataTableHeader>
                  <DataTableBody>
                    {detail.permissionPreview.rules.map((rule) => (
                      <DataTableRow key={`${rule.effect}-${rule.resource}-${rule.scope}`}>
                        <DataTableCell>
                          <Badge variant={effectVariant(rule.effect)}>{rule.effect}</Badge>
                        </DataTableCell>
                        <DataTableCell className="font-medium text-[var(--ink)]">{rule.resource}</DataTableCell>
                        <DataTableCell>{rule.scope}</DataTableCell>
                        <DataTableCell>{rule.reason ?? "无"}</DataTableCell>
                      </DataTableRow>
                    ))}
                  </DataTableBody>
                </DataTable>
              )}
            </PanelBody>
          </Panel>

          <Panel>
            <PanelHeader
              eyebrow="编排"
              title="Agent 团队编排"
              description="Leader、Worker、聚合和冲突策略按工作台视图拆开展示。"
            />
            <PanelBody className="space-y-5">
              <DefinitionList
                columnsClassName="md:grid-cols-2"
                items={[
                  {
                    label: "Leader",
                    value: detail.runPlan.leader.agentName,
                    detail: detail.runPlan.leader.role,
                  },
                  { label: "策略", value: detail.runPlan.strategy },
                  { label: "拆分策略", value: detail.runPlan.splitStrategy ?? "无" },
                  { label: "冲突处理", value: detail.runPlan.conflictResolution.method },
                  {
                    label: "聚合 Agent",
                    value: detail.runPlan.aggregation?.agentName ?? "无",
                    detail: detail.runPlan.aggregation?.method ?? null,
                  },
                  { label: "节点数", value: detail.runPlan.nodeCount },
                ]}
              />

              {detail.runPlan.workers.length === 0 ? (
                <EmptyState>当前编排没有 Worker 节点。</EmptyState>
              ) : (
                <DataTable>
                  <DataTableHeader>
                    <DataTableRow>
                      <DataTableHead>Agent</DataTableHead>
                      <DataTableHead>Agent ID</DataTableHead>
                      <DataTableHead>任务分工</DataTableHead>
                    </DataTableRow>
                  </DataTableHeader>
                  <DataTableBody>
                    {detail.runPlan.workers.map((worker) => (
                      <DataTableRow key={`${worker.agent}-${worker.task}`}>
                        <DataTableCell className="font-medium text-[var(--ink)]">{worker.agentName}</DataTableCell>
                        <DataTableCell>{worker.agent}</DataTableCell>
                        <DataTableCell>{worker.task}</DataTableCell>
                      </DataTableRow>
                    ))}
                  </DataTableBody>
                </DataTable>
              )}
            </PanelBody>
          </Panel>

          <Panel>
            <PanelHeader
              eyebrow="最近运行"
              title="最近运行"
              description="运行实例用表格展示，便于查找状态、来源和时间。"
            />
            <PanelBody>
              {detail.recentRuns.length === 0 ? (
                <EmptyState>暂无运行实例。</EmptyState>
              ) : (
                <DataTable>
                  <DataTableHeader>
                    <DataTableRow>
                      <DataTableHead>运行</DataTableHead>
                      <DataTableHead>来源</DataTableHead>
                      <DataTableHead>状态</DataTableHead>
                      <DataTableHead>提交人</DataTableHead>
                      <DataTableHead align="right">成本</DataTableHead>
                      <DataTableHead>创建时间</DataTableHead>
                    </DataTableRow>
                  </DataTableHeader>
                  <DataTableBody>
                    {detail.recentRuns.map((run) => (
                      <DataTableRow key={run.id}>
                        <DataTableCell>
                          <Link href={`/task-runs/${run.id}`} className="font-medium text-[var(--ink)] hover:underline">
                            {run.sourceRef ?? run.id}
                          </Link>
                        </DataTableCell>
                        <DataTableCell>{run.sourceType}</DataTableCell>
                        <DataTableCell>
                          <Badge variant={statusVariant(run.status)}>{translateStatus(run.status)}</Badge>
                        </DataTableCell>
                        <DataTableCell>{run.requestedBy}</DataTableCell>
                        <DataTableCell align="right">${run.costActual}</DataTableCell>
                        <DataTableCell>{formatDateTime(run.createdAt)}</DataTableCell>
                      </DataTableRow>
                    ))}
                  </DataTableBody>
                </DataTable>
              )}
            </PanelBody>
          </Panel>

          <Panel>
            <PanelHeader
              eyebrow="问题输出"
              title="最近 Finding"
              description="问题产出按严重度、类别、置信度和状态排序查看。"
            />
            <PanelBody>
              {detail.findings.length === 0 ? (
                <EmptyState>最近没有 Finding。</EmptyState>
              ) : (
                <DataTable>
                  <DataTableHeader>
                    <DataTableRow>
                      <DataTableHead>问题</DataTableHead>
                      <DataTableHead>严重度</DataTableHead>
                      <DataTableHead>类别</DataTableHead>
                      <DataTableHead>来源 Agent</DataTableHead>
                      <DataTableHead align="right">置信度</DataTableHead>
                      <DataTableHead>状态</DataTableHead>
                    </DataTableRow>
                  </DataTableHeader>
                  <DataTableBody>
                    {detail.findings.map((finding) => (
                      <DataTableRow key={finding.id}>
                        <DataTableCell className="max-w-[360px]">
                          <div className="font-medium text-[var(--ink)]">{finding.title}</div>
                          <div className="mt-1 line-clamp-2 text-sm leading-5 text-[var(--ink-muted)]">
                            {finding.description}
                          </div>
                        </DataTableCell>
                        <DataTableCell>
                          <Badge variant={severityVariant(finding.severity)}>{finding.severity}</Badge>
                        </DataTableCell>
                        <DataTableCell>{finding.category}</DataTableCell>
                        <DataTableCell>{finding.sourceAgent}</DataTableCell>
                        <DataTableCell align="right">{Math.round(finding.confidence * 100)}%</DataTableCell>
                        <DataTableCell>{finding.status}</DataTableCell>
                      </DataTableRow>
                    ))}
                  </DataTableBody>
                </DataTable>
              )}
            </PanelBody>
          </Panel>

          <Panel>
            <PanelHeader
              eyebrow="策略"
              title="环境、记忆和输出策略"
              description="复杂结构保留 JSON 审计视图，避免把策略细节压扁。"
            />
            <PanelBody className="grid gap-4 lg:grid-cols-2">
              <div className="space-y-2">
                <div className="text-sm font-medium text-[var(--ink)]">环境选择器</div>
                <JsonBlock value={detail.environmentSelector} />
              </div>
              <div className="space-y-2">
                <div className="text-sm font-medium text-[var(--ink)]">记忆策略</div>
                <JsonBlock value={detail.memoryPolicy} />
              </div>
              <div className="space-y-2">
                <div className="text-sm font-medium text-[var(--ink)]">输出策略</div>
                <JsonBlock value={detail.outputPolicy} />
              </div>
              <div className="space-y-2">
                <div className="text-sm font-medium text-[var(--ink)]">看板策略</div>
                <JsonBlock value={detail.dashboardPolicy} />
              </div>
              <div className="space-y-2">
                <div className="text-sm font-medium text-[var(--ink)]">执行策略</div>
                <JsonBlock value={detail.executionPolicy} />
              </div>
              <div className="space-y-2">
                <div className="text-sm font-medium text-[var(--ink)]">归档策略</div>
                <JsonBlock value={detail.archivePolicy} />
              </div>
              <div className="space-y-2 lg:col-span-2">
                <div className="text-sm font-medium text-[var(--ink)]">结果 Schema</div>
                <JsonBlock value={detail.resultSchema} />
              </div>
            </PanelBody>
          </Panel>
        </section>

        <aside className="space-y-4 xl:sticky xl:top-6 xl:self-start">
          <BlueprintSubmitConsole
            blueprintId={detail.blueprint.id}
            initialPayload={buildInputDraft(detail.inputSchema)}
          />
          <TaskBlueprintEditor blueprint={detail.blueprint} options={detail.options} />
        </aside>
      </div>
    </div>
  );
}
