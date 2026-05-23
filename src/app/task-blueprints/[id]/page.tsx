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
  if (value === undefined || value === null || value === "") return "ui.generated.c72077749f7";
  if (Array.isArray(value)) return value.length ? value.map(String).join(", ") : "ui.generated.c72077749f7";
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
        eyebrow="ui.generated.cb19fb2fe5d"
        title={detail.blueprint.name}
        description="ui.generated.c975fcc7143"
        badges={[
          { label: translateStatus(detail.blueprint.status), variant: statusVariant(detail.blueprint.status) },
          { label: translateVisibility(detail.blueprint.visibility), variant: "neutral" },
          { label: detail.blueprint.category, variant: "accent" },
          { label: `v${detail.blueprint.version}`, variant: "neutral" },
        ]}
      />

      <SummaryStrip
        items={[
          { label: "ui.generated.c648c5a6b11", value: detail.recentRuns.length, detail: "ui.generated.cdef121b0f4" },
          { label: "ui.generated.c95f4519aab", value: detail.permissionPreview.rules.length, detail: <>ui.common.detail.defaultModePrefix {detail.permissionPreview.defaultMode}</> },
          { label: "ui.generated.c6fcb629b38", value: detail.runPlan.nodeCount, detail: detail.runPlan.strategy },
        ]}
      />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_460px]">
        <section className="space-y-4">
          <Panel>
            <PanelHeader
              eyebrow="ui.generated.c46d4c1b4e4"
              title="ui.generated.c09b13c70a6"
              description="ui.generated.c954ecfe6e5"
            />
            <PanelBody>
              <DefinitionList
                columnsClassName="md:grid-cols-2"
                items={[
                  { label: "ui.generated.c02446dfb0d", value: detail.blueprint.id },
                  { label: "ui.generated.ced9f6d4d8e", value: detail.blueprint.category },
                  { label: "ui.generated.c2b90028ff3", value: detail.businessTeamName },
                  { label: "ui.generated.c70f970c1fc", value: detail.agentTeamName },
                  { label: "ui.generated.c059d73c843", value: detail.environmentName },
                  { label: "ui.generated.cbc56f948bb", value: detail.providerName },
                  { label: "ui.generated.c84e3802f60", value: formatDateTime(detail.blueprint.createdAt) },
                  { label: "ui.generated.c093dea88c9", value: formatDateTime(detail.blueprint.updatedAt) },
                ]}
              />
            </PanelBody>
          </Panel>

          <Panel>
            <PanelHeader
              eyebrow="ui.generated.cabaf6289a8"
              title="ui.generated.c1b1da04ec5"
              description="ui.generated.cf296ff6359"
            />
            <PanelBody className="space-y-5">
              <DefinitionList
                columnsClassName="md:grid-cols-3"
                items={[
                  { label: "ui.generated.c2d189a3f46", value: formatTrigger(detail.trigger) },
                  { label: "ui.generated.ce4e46c7235", value: String(detail.trigger.type ?? "manual") },
                  { label: "ui.generated.cc2dd028659", value: String(detail.trigger.connector ?? "ui.generated.c72077749f7") },
                  { label: "ui.generated.c550e328062", value: String(detail.trigger.event ?? "ui.generated.c72077749f7") },
                  { label: "Webhook", value: String(detail.trigger.webhookPathKey ?? "ui.generated.c72077749f7") },
                  { label: "ui.generated.c11118f711c", value: String(detail.trigger.idempotencyKey ?? "ui.generated.c72077749f7") },
                ]}
              />

              {inputSchemaRows.length === 0 ? (
                <EmptyState>ui.generated.c2d19bb69e3</EmptyState>
              ) : (
                <DataTable>
                  <DataTableHeader>
                    <DataTableRow>
                      <DataTableHead>ui.generated.c77a49f2c38</DataTableHead>
                      <DataTableHead>ui.generated.ce4e46c7235</DataTableHead>
                      <DataTableHead>ui.generated.c32945d3e36</DataTableHead>
                      <DataTableHead>ui.generated.cf094cc6ebb</DataTableHead>
                      <DataTableHead>ui.generated.c26670dda42</DataTableHead>
                    </DataTableRow>
                  </DataTableHeader>
                  <DataTableBody>
                    {inputSchemaRows.map((field) => (
                      <DataTableRow key={field.name}>
                        <DataTableCell className="font-medium text-[var(--ink)]">{field.name}</DataTableCell>
                        <DataTableCell>{field.type}</DataTableCell>
                        <DataTableCell>
                          <Badge variant={field.required ? "warning" : "neutral"}>
                            {field.required ? "ui.generated.c32945d3e36" : "ui.generated.c53e32830a5"}
                          </Badge>
                        </DataTableCell>
                        <DataTableCell>
                          {field.enumValues.length > 0 ? field.enumValues.join(", ") : compactJson(field.defaultValue)}
                        </DataTableCell>
                        <DataTableCell>{field.description || "ui.generated.c72077749f7"}</DataTableCell>
                      </DataTableRow>
                    ))}
                  </DataTableBody>
                </DataTable>
              )}
            </PanelBody>
          </Panel>

          <Panel>
            <PanelHeader
              eyebrow="ui.generated.c560165a6d7"
              title="ui.generated.cb6ffb455c5"
              description="ui.generated.c8591732f43"
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
                <EmptyState>ui.generated.c7ead357861</EmptyState>
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
                        <DataTableCell>{rule.reason ?? "ui.generated.c72077749f7"}</DataTableCell>
                      </DataTableRow>
                    ))}
                  </DataTableBody>
                </DataTable>
              )}
            </PanelBody>
          </Panel>

          <Panel>
            <PanelHeader
              eyebrow="ui.generated.c63881557e3"
              title="ui.generated.c9687f854a8"
              description="ui.generated.cd0e415794d"
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
                  { label: "ui.generated.cf3c49831c6", value: detail.runPlan.strategy },
                  { label: "ui.generated.c815a1c560d", value: detail.runPlan.splitStrategy ?? "ui.generated.c72077749f7" },
                  { label: "ui.generated.c4aeeacc808", value: detail.runPlan.conflictResolution.method },
                  {
                    label: "ui.generated.c8a5ab059f8",
                    value: detail.runPlan.aggregation?.agentName ?? "ui.generated.c72077749f7",
                    detail: detail.runPlan.aggregation?.method ?? null,
                  },
                  { label: "ui.generated.cc4fdaf4d2a", value: detail.runPlan.nodeCount },
                ]}
              />

              {detail.runPlan.workers.length === 0 ? (
                <EmptyState>ui.generated.cb0aae34499</EmptyState>
              ) : (
                <DataTable>
                  <DataTableHeader>
                    <DataTableRow>
                      <DataTableHead>Agent</DataTableHead>
                      <DataTableHead>Agent ID</DataTableHead>
                      <DataTableHead>ui.generated.ca5a837ff34</DataTableHead>
                      <DataTableHead>ui.generated.c57d167c53b</DataTableHead>
                      <DataTableHead>ui.generated.c6756e283cb</DataTableHead>
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
              eyebrow="ui.generated.c648c5a6b11"
              title="ui.generated.c648c5a6b11"
              description="ui.generated.cc6d5a9f590"
            />
            <PanelBody>
              {detail.recentRuns.length === 0 ? (
                <EmptyState>ui.generated.c66fe97fb5a</EmptyState>
              ) : (
                <DataTable>
                  <DataTableHeader>
                    <DataTableRow>
                      <DataTableHead>ui.generated.c0c3acd446f</DataTableHead>
                      <DataTableHead>ui.generated.cc63f79e636</DataTableHead>
                      <DataTableHead>ui.generated.c62e951a692</DataTableHead>
                      <DataTableHead>ui.generated.c3c75f3646a</DataTableHead>
                      <DataTableHead align="right">ui.generated.c5354b098e2</DataTableHead>
                      <DataTableHead>ui.generated.c84e3802f60</DataTableHead>
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
              eyebrow="ui.generated.cf3c49831c6"
              title="ui.generated.cb4a207d28b"
              description="ui.generated.ccd09569127"
            />
            <PanelBody className="grid gap-4 lg:grid-cols-2">
              <div className="space-y-2">
                <div className="text-sm font-medium text-[var(--ink)]">ui.generated.cfd7af3df33</div>
                <JsonBlock value={detail.environmentSelector} />
              </div>
              <div className="space-y-2">
                <div className="text-sm font-medium text-[var(--ink)]">ui.generated.cf47d3b9380</div>
                <JsonBlock value={detail.memoryPolicy} />
              </div>
              <div className="space-y-2">
                <div className="text-sm font-medium text-[var(--ink)]">ui.generated.c084415a1ec</div>
                <JsonBlock value={detail.outputPolicy} />
              </div>
              <div className="space-y-2">
                <div className="text-sm font-medium text-[var(--ink)]">ui.generated.c3ce9649be0</div>
                <JsonBlock value={detail.dashboardPolicy} />
              </div>
              <div className="space-y-2">
                <div className="text-sm font-medium text-[var(--ink)]">ui.generated.c6408e9f93d</div>
                <JsonBlock value={detail.executionPolicy} />
              </div>
              <div className="space-y-2">
                <div className="text-sm font-medium text-[var(--ink)]">ui.generated.c47610c27f3</div>
                <JsonBlock value={detail.archivePolicy} />
              </div>
              <div className="space-y-2 lg:col-span-2">
                <div className="text-sm font-medium text-[var(--ink)]">ui.generated.cd8cce53c0b</div>
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
