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
import { translateWithPack } from "@/lib/language-pack";
import { translateStatus, translateVisibility } from "@/lib/presentation";
import { formatDateTime } from "@/lib/utils";
import { getActiveLanguagePack } from "@/server/language-pack-store";
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

function readinessVariant(status: string): BadgeVariant {
  if (status === "ready") return "success";
  if (status === "needs_attention") return "warning";
  if (status === "blocked") return "danger";
  return "neutral";
}

function readinessCheckVariant(status: string): BadgeVariant {
  if (status === "ok") return "success";
  if (status === "warning") return "warning";
  if (status === "blocker") return "danger";
  return "neutral";
}

function formatTrigger(
  trigger: Record<string, unknown>,
  t: (key: string, fallback?: string, params?: Record<string, string | number>) => string,
) {
  if (trigger.type === "webhook") {
    const value = String(trigger.event ?? trigger.webhookPathKey ?? t("ui.taskBlueprints.trigger.empty"));
    return t("ui.taskBlueprints.trigger.webhook", undefined, { value });
  }
  if (trigger.type === "cron") {
    const value = String(trigger.expression ?? t("ui.taskBlueprints.trigger.empty"));
    return t("ui.taskBlueprints.trigger.cron", undefined, { value });
  }
  if (trigger.type === "access_grant") return t("ui.taskBlueprints.trigger.accessGrant");
  return t("ui.taskBlueprints.trigger.manual");
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
  if (value === undefined || value === null || value === "") return "ui.taskBlueprints.values.none";
  if (Array.isArray(value)) return value.length ? value.map(String).join(", ") : "ui.taskBlueprints.values.none";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function codebaseScopeDetail(
  selector: Record<string, unknown>,
  codebases: Array<{ id: string; name: string }>,
) {
  const scope = selector.codebaseScope;
  if (!scope || typeof scope !== "object" || Array.isArray(scope)) return "ui.taskBlueprintEditor.codebaseScope.all";
  const record = scope as Record<string, unknown>;
  if (record.mode !== "selected") return "ui.taskBlueprintEditor.codebaseScope.all";
  const ids = Array.isArray(record.codebaseIds) ? record.codebaseIds.map(String).filter(Boolean) : [];
  if (ids.length === 0) return "ui.taskBlueprintEditor.codebaseScope.emptySelected";
  return ids.map((id) => codebases.find((codebase) => codebase.id === id)?.name ?? id).join(", ");
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

  const languagePack = getActiveLanguagePack();
  const t = (key: string, fallback?: string, params?: Record<string, string | number>) =>
    translateWithPack(languagePack, key, fallback, params);
  const inputSchemaRows = getSchemaRows(detail.inputSchema);
  const codebaseScope = codebaseScopeDetail(detail.environmentSelector, detail.options.codebases ?? []);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="ui.taskBlueprintDetail.eyebrow"
        title={detail.blueprint.name}
        description="ui.taskBlueprintDetail.description"
        badges={[
          { label: translateStatus(detail.blueprint.status), variant: statusVariant(detail.blueprint.status) },
          { label: translateVisibility(detail.blueprint.visibility), variant: "neutral" },
          { label: detail.blueprint.category, variant: "accent" },
          { label: `v${detail.blueprint.version}`, variant: "neutral" },
        ]}
      />

      <SummaryStrip
        items={[
          { label: "ui.taskBlueprintDetail.summary.recentRuns", value: detail.recentRuns.length, detail: "ui.taskBlueprintDetail.summary.recentRunsDetail" },
          {
            label: "ui.taskBlueprintDetail.summary.permissions",
            value: detail.permissionPreview.rules.length,
            detail: t("ui.taskBlueprintDetail.summary.defaultMode", undefined, { mode: detail.permissionPreview.defaultMode }),
          },
          { label: "ui.taskBlueprintDetail.summary.runPlan", value: detail.runPlan.nodeCount, detail: detail.runPlan.strategy },
          {
            label: "ui.taskBlueprintReadiness.summary.label",
            value: `${detail.readiness.score}%`,
            detail: `ui.taskBlueprintReadiness.status.${detail.readiness.status}`,
            tone: detail.readiness.status === "ready" ? "accent" : "default",
          },
        ]}
      />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_460px]">
        <section className="space-y-4">
          <Panel>
            <PanelHeader
              eyebrow="ui.taskBlueprintReadiness.eyebrow"
              title="ui.taskBlueprintReadiness.title"
              description="ui.taskBlueprintReadiness.description"
              action={
                <Badge variant={readinessVariant(detail.readiness.status)}>
                  {`ui.taskBlueprintReadiness.status.${detail.readiness.status}`}
                </Badge>
              }
            />
            <PanelBody className="p-0">
              <DataTable>
                <DataTableHeader>
                  <DataTableRow className="hover:bg-transparent">
                    <DataTableHead>ui.taskBlueprintReadiness.columns.check</DataTableHead>
                    <DataTableHead>ui.taskBlueprintReadiness.columns.status</DataTableHead>
                    <DataTableHead>ui.taskBlueprintReadiness.columns.detail</DataTableHead>
                  </DataTableRow>
                </DataTableHeader>
                <DataTableBody>
                  {detail.readiness.checks.map((check) => (
                    <DataTableRow key={check.id}>
                      <DataTableCell className="font-medium text-[var(--ink)]">{check.labelKey}</DataTableCell>
                      <DataTableCell>
                        <Badge variant={readinessCheckVariant(check.status)}>
                          {`ui.taskBlueprintReadiness.checkStatus.${check.status}`}
                        </Badge>
                      </DataTableCell>
                      <DataTableCell>{check.detailKey}</DataTableCell>
                    </DataTableRow>
                  ))}
                </DataTableBody>
              </DataTable>
            </PanelBody>
          </Panel>

          <Panel>
            <PanelHeader
              eyebrow="ui.taskBlueprintDetail.sections.overviewEyebrow"
              title="ui.taskBlueprintDetail.sections.overviewTitle"
              description="ui.taskBlueprintDetail.sections.overviewDescription"
            />
            <PanelBody>
              <DefinitionList
                columnsClassName="md:grid-cols-2"
                items={[
                  { label: "ui.taskBlueprintDetail.fields.id", value: detail.blueprint.id },
                  { label: "ui.taskBlueprintDetail.fields.category", value: detail.blueprint.category },
                  { label: "ui.taskBlueprintDetail.fields.businessTeam", value: detail.businessTeamName },
                  { label: "ui.taskBlueprintDetail.fields.agentTeam", value: detail.agentTeamName },
                  { label: "ui.taskBlueprintDetail.fields.environment", value: detail.environmentName },
                  { label: "ui.taskBlueprintEditor.fields.codebaseScope", value: codebaseScope },
                  { label: "ui.taskBlueprintDetail.fields.provider", value: detail.providerName },
                  { label: "ui.taskBlueprintDetail.fields.createdAt", value: formatDateTime(detail.blueprint.createdAt) },
                  { label: "ui.taskBlueprintDetail.fields.updatedAt", value: formatDateTime(detail.blueprint.updatedAt) },
                ]}
              />
            </PanelBody>
          </Panel>

          <Panel>
            <PanelHeader
              eyebrow="ui.taskBlueprintDetail.sections.triggerEyebrow"
              title="ui.taskBlueprintDetail.sections.triggerTitle"
              description="ui.taskBlueprintDetail.sections.triggerDescription"
            />
            <PanelBody className="space-y-5">
              <DefinitionList
                columnsClassName="md:grid-cols-3"
                items={[
                  { label: "ui.taskBlueprintDetail.fields.triggerSummary", value: formatTrigger(detail.trigger, t) },
                  { label: "ui.taskBlueprintDetail.fields.triggerType", value: String(detail.trigger.type ?? "manual") },
                  { label: "ui.taskBlueprintDetail.fields.connector", value: String(detail.trigger.connector ?? "ui.taskBlueprints.values.none") },
                  { label: "ui.taskBlueprintDetail.fields.event", value: String(detail.trigger.event ?? "ui.taskBlueprints.values.none") },
                  { label: "ui.taskBlueprintDetail.fields.webhookPath", value: String(detail.trigger.webhookPathKey ?? "ui.taskBlueprints.values.none") },
                  { label: "ui.taskBlueprintDetail.fields.idempotencyKey", value: String(detail.trigger.idempotencyKey ?? "ui.taskBlueprints.values.none") },
                ]}
              />

              {inputSchemaRows.length === 0 ? (
                <EmptyState>{t("ui.taskBlueprintDetail.empty.inputSchema")}</EmptyState>
              ) : (
                <DataTable>
                  <DataTableHeader>
                    <DataTableRow>
                      <DataTableHead>ui.taskBlueprintDetail.columns.name</DataTableHead>
                      <DataTableHead>ui.taskBlueprintDetail.columns.type</DataTableHead>
                      <DataTableHead>ui.taskBlueprintDetail.columns.required</DataTableHead>
                      <DataTableHead>ui.taskBlueprintDetail.columns.defaultValue</DataTableHead>
                      <DataTableHead>ui.taskBlueprintDetail.columns.description</DataTableHead>
                    </DataTableRow>
                  </DataTableHeader>
                  <DataTableBody>
                    {inputSchemaRows.map((field) => (
                      <DataTableRow key={field.name}>
                        <DataTableCell className="font-medium text-[var(--ink)]">{field.name}</DataTableCell>
                        <DataTableCell>{field.type}</DataTableCell>
                        <DataTableCell>
                          <Badge variant={field.required ? "warning" : "neutral"}>
                            {field.required ? "ui.common.boolean.yes" : "ui.common.boolean.no"}
                          </Badge>
                        </DataTableCell>
                        <DataTableCell>
                          {field.enumValues.length > 0 ? field.enumValues.join(", ") : compactJson(field.defaultValue)}
                        </DataTableCell>
                        <DataTableCell>{field.description || "ui.taskBlueprints.values.none"}</DataTableCell>
                      </DataTableRow>
                    ))}
                  </DataTableBody>
                </DataTable>
              )}
            </PanelBody>
          </Panel>

          <Panel>
            <PanelHeader
              eyebrow="ui.taskBlueprintDetail.sections.permissionsEyebrow"
              title="ui.taskBlueprintDetail.sections.permissionsTitle"
              description="ui.taskBlueprintDetail.sections.permissionsDescription"
            />
            <PanelBody className="space-y-4">
              <SummaryStrip
                gridClassName="grid-cols-3"
                items={[
                  { label: "ui.taskBlueprintDetail.permissions.allow", value: detail.permissionPreview.counts.allow },
                  { label: "ui.taskBlueprintDetail.permissions.ask", value: detail.permissionPreview.counts.ask },
                  { label: "ui.taskBlueprintDetail.permissions.deny", value: detail.permissionPreview.counts.deny },
                ]}
              />
              {detail.permissionPreview.rules.length === 0 ? (
                <EmptyState>{t("ui.taskBlueprintDetail.empty.permissions")}</EmptyState>
              ) : (
                <DataTable>
                  <DataTableHeader>
                    <DataTableRow>
                      <DataTableHead>ui.taskBlueprintDetail.columns.effect</DataTableHead>
                      <DataTableHead>ui.taskBlueprintDetail.columns.resource</DataTableHead>
                      <DataTableHead>ui.taskBlueprintDetail.columns.scope</DataTableHead>
                      <DataTableHead>ui.taskBlueprintDetail.columns.reason</DataTableHead>
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
                        <DataTableCell>{rule.reason ?? "ui.taskBlueprints.values.none"}</DataTableCell>
                      </DataTableRow>
                    ))}
                  </DataTableBody>
                </DataTable>
              )}
            </PanelBody>
          </Panel>

          <Panel>
            <PanelHeader
              eyebrow="ui.taskBlueprintDetail.sections.runPlanEyebrow"
              title="ui.taskBlueprintDetail.sections.runPlanTitle"
              description="ui.taskBlueprintDetail.sections.runPlanDescription"
            />
            <PanelBody className="space-y-5">
              <DefinitionList
                columnsClassName="md:grid-cols-2"
                items={[
                  {
                    label: "ui.taskBlueprintDetail.fields.leader",
                    value: detail.runPlan.leader.agentName,
                    detail: detail.runPlan.leader.role,
                  },
                  { label: "ui.taskBlueprintDetail.fields.strategy", value: detail.runPlan.strategy },
                  { label: "ui.taskBlueprintDetail.fields.splitStrategy", value: detail.runPlan.splitStrategy ?? "ui.taskBlueprints.values.none" },
                  { label: "ui.taskBlueprintDetail.fields.conflictResolution", value: detail.runPlan.conflictResolution.method },
                  {
                    label: "ui.taskBlueprintDetail.fields.aggregation",
                    value: detail.runPlan.aggregation?.agentName ?? "ui.taskBlueprints.values.none",
                    detail: detail.runPlan.aggregation?.method ?? null,
                  },
                  { label: "ui.taskBlueprintDetail.fields.nodeCount", value: detail.runPlan.nodeCount },
                ]}
              />

              {detail.runPlan.workers.length === 0 ? (
                <EmptyState>{t("ui.taskBlueprintDetail.empty.workers")}</EmptyState>
              ) : (
                <DataTable>
                  <DataTableHeader>
                    <DataTableRow>
                      <DataTableHead>ui.taskBlueprintDetail.columns.agent</DataTableHead>
                      <DataTableHead>ui.taskBlueprintDetail.columns.agentId</DataTableHead>
                      <DataTableHead>ui.taskBlueprintDetail.columns.blockType</DataTableHead>
                      <DataTableHead>ui.taskBlueprintDetail.columns.tool</DataTableHead>
                      <DataTableHead>ui.taskBlueprintDetail.columns.task</DataTableHead>
                    </DataTableRow>
                  </DataTableHeader>
                  <DataTableBody>
                    {detail.runPlan.workers.map((worker) => (
                      <DataTableRow key={`${worker.agent}-${worker.task}`}>
                        <DataTableCell className="font-medium text-[var(--ink)]">{worker.agentName}</DataTableCell>
                        <DataTableCell>{worker.agent}</DataTableCell>
                        <DataTableCell>{worker.blockType ?? "agent"}</DataTableCell>
                        <DataTableCell>{worker.tool ?? "agent.execute"}</DataTableCell>
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
              eyebrow="ui.taskBlueprintDetail.sections.recentRunsEyebrow"
              title="ui.taskBlueprintDetail.sections.recentRunsTitle"
              description="ui.taskBlueprintDetail.sections.recentRunsDescription"
            />
            <PanelBody>
              {detail.recentRuns.length === 0 ? (
                <EmptyState>{t("ui.taskBlueprintDetail.empty.recentRuns")}</EmptyState>
              ) : (
                <DataTable>
                  <DataTableHeader>
                    <DataTableRow>
                      <DataTableHead>ui.taskBlueprintDetail.columns.run</DataTableHead>
                      <DataTableHead>ui.taskBlueprintDetail.columns.sourceType</DataTableHead>
                      <DataTableHead>ui.taskBlueprintDetail.columns.status</DataTableHead>
                      <DataTableHead>ui.taskBlueprintDetail.columns.requestedBy</DataTableHead>
                      <DataTableHead>ui.taskBlueprintDetail.columns.createdAt</DataTableHead>
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
              eyebrow="ui.taskBlueprintDetail.sections.policiesEyebrow"
              title="ui.taskBlueprintDetail.sections.policiesTitle"
              description="ui.taskBlueprintDetail.sections.policiesDescription"
            />
            <PanelBody className="grid gap-4 lg:grid-cols-2">
              <div className="space-y-2">
                <div className="text-sm font-medium text-[var(--ink)]">{t("ui.taskBlueprintDetail.policies.environmentSelector")}</div>
                <JsonBlock value={detail.environmentSelector} />
              </div>
              <div className="space-y-2">
                <div className="text-sm font-medium text-[var(--ink)]">{t("ui.taskBlueprintDetail.policies.memoryPolicy")}</div>
                <JsonBlock value={detail.memoryPolicy} />
              </div>
              <div className="space-y-2">
                <div className="text-sm font-medium text-[var(--ink)]">{t("ui.taskBlueprintDetail.policies.outputPolicy")}</div>
                <JsonBlock value={detail.outputPolicy} />
              </div>
              <div className="space-y-2">
                <div className="text-sm font-medium text-[var(--ink)]">{t("ui.taskBlueprintDetail.policies.dashboardPolicy")}</div>
                <JsonBlock value={detail.dashboardPolicy} />
              </div>
              <div className="space-y-2">
                <div className="text-sm font-medium text-[var(--ink)]">{t("ui.taskBlueprintDetail.policies.executionPolicy")}</div>
                <JsonBlock value={detail.executionPolicy} />
              </div>
              <div className="space-y-2">
                <div className="text-sm font-medium text-[var(--ink)]">{t("ui.taskBlueprintDetail.policies.archivePolicy")}</div>
                <JsonBlock value={detail.archivePolicy} />
              </div>
              <div className="space-y-2 lg:col-span-2">
                <div className="text-sm font-medium text-[var(--ink)]">{t("ui.taskBlueprintDetail.policies.resultSchema")}</div>
                <JsonBlock value={detail.resultSchema} />
              </div>
            </PanelBody>
          </Panel>
        </section>

        <aside className="space-y-4 xl:sticky xl:top-6 xl:self-start">
          <BlueprintSubmitConsole
            blueprintId={detail.blueprint.id}
            initialPayload={buildInputDraft(detail.inputSchema)}
            codebases={detail.options.codebases}
            readiness={detail.readiness}
          />
          <TaskBlueprintEditor blueprint={detail.blueprint} options={detail.options} />
        </aside>
      </div>
    </div>
  );
}
