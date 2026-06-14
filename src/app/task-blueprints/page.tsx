import Link from "next/link";
import { Eye, PencilLine, Plus } from "lucide-react";
import { DeleteResourceButton } from "@/components/delete-resource-button";
import { PageHeader } from "@/components/page-header";
import { SoftwareTeamWorkflowStarter } from "@/components/software-team-workflow-starter";
import { TaskBlueprintEditor } from "@/components/task-blueprint-editor";
import { TaskBlueprintSchedulerConsole } from "@/components/task-blueprint-scheduler-console";
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
import { translateWithPack } from "@/lib/language-pack";
import { translateStatus, translateVisibility } from "@/lib/presentation";
import { formatDateTime } from "@/lib/utils";
import { canAccessBusinessTeam, getRequestAuthContext } from "@/server/auth-core";
import { getActiveLanguagePack } from "@/server/language-pack-store";
import {
  getTaskBlueprintEditorOptions,
  getTaskBlueprintsSnapshot,
  listTaskBlueprints,
} from "@/server/queries";

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

function parsePublishers(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (typeof item === "string") return item;
      if (item && typeof item === "object" && "type" in item) {
        return String((item as { type?: unknown }).type ?? "");
      }
      return "";
    })
    .filter(Boolean);
}

function triggerLabel(
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

function defaultBlueprint() {
  return {
    id: "",
    name: "",
    category: "",
    visibility: "team",
    ownerBusinessTeamId: "",
    teamId: "",
    environmentId: null,
    providerAdapterId: "",
    version: 1,
    status: "active",
    triggerJson: JSON.stringify({ type: "webhook" }, null, 2),
    inputSchemaJson: JSON.stringify({ type: "object", properties: {}, required: [] }, null, 2),
    environmentSelectorJson: "{}",
    agentTeamRunPlanJson: "{}",
    memoryPolicyJson: JSON.stringify({ requiredSpaces: [], archiveOutputTo: [] }, null, 2),
    providerPolicyJson: "{}",
    permissionPolicyJson: JSON.stringify({ defaultMode: "ask", rules: [] }, null, 2),
    resultSchemaJson: JSON.stringify({ type: "object", properties: {} }, null, 2),
    outputPolicyJson: JSON.stringify({ publishers: [] }, null, 2),
    dashboardPolicyJson: "{}",
    executionPolicyJson: "{}",
    archivePolicyJson: "{}",
  };
}

function compactValue(value: unknown) {
  if (value === undefined || value === null || value === "") return "ui.taskBlueprints.values.none";
  if (Array.isArray(value)) return value.length ? value.map(String).join(", ") : "ui.taskBlueprints.values.none";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function readinessVariant(status: string): "neutral" | "accent" | "success" | "warning" | "danger" {
  if (status === "ready") return "success";
  if (status === "needs_attention") return "warning";
  if (status === "blocked") return "danger";
  return "neutral";
}

function codebaseScopeLabel(
  selector: Record<string, unknown>,
  codebases: Array<{ id: string; name: string }>,
  t: (key: string, fallback?: string, params?: Record<string, string | number>) => string,
) {
  const scope = selector.codebaseScope;
  if (!scope || typeof scope !== "object" || Array.isArray(scope)) return t("ui.taskBlueprintEditor.codebaseScope.all");
  const record = scope as Record<string, unknown>;
  if (record.mode !== "selected") return t("ui.taskBlueprintEditor.codebaseScope.all");
  const ids = Array.isArray(record.codebaseIds) ? record.codebaseIds.map(String).filter(Boolean) : [];
  if (ids.length === 0) return t("ui.taskBlueprintEditor.codebaseScope.emptySelected");
  const names = ids.map((id) => codebases.find((codebase) => codebase.id === id)?.name ?? id);
  return names.length <= 2
    ? names.join(", ")
    : t("ui.taskBlueprintEditor.codebaseScope.selectedCount", undefined, { count: names.length });
}

function blueprintIdFromScheduleTemplateId(templateId: string) {
  const match = templateId.match(/^blueprint:(.+):trigger$/);
  return match?.[1] ?? "";
}

export default async function TaskBlueprintsPage({
  searchParams,
}: {
  searchParams?: Promise<{ teamId?: string }>;
}) {
  const languagePack = getActiveLanguagePack();
  const t = (key: string, fallback?: string, params?: Record<string, string | number>) =>
    translateWithPack(languagePack, key, fallback, params);
  const params = await searchParams;
  const authContext = await getRequestAuthContext();
  const snapshot = getTaskBlueprintsSnapshot();
  const rawBlueprints = listTaskBlueprints().filter((blueprint) =>
    canAccessBusinessTeam(authContext, blueprint.ownerBusinessTeamId),
  );
  const rawOptions = getTaskBlueprintEditorOptions();
  const options = {
    ...rawOptions,
    businessTeams: rawOptions.businessTeams.filter((team) => canAccessBusinessTeam(authContext, team.id)),
    agentTeams: rawOptions.agentTeams.filter((team) => canAccessBusinessTeam(authContext, team.businessTeamId)),
    environments: rawOptions.environments.filter((environment) =>
      canAccessBusinessTeam(authContext, environment.businessTeamId),
    ),
    codebases: (rawOptions.codebases ?? []).filter((codebase) =>
      canAccessBusinessTeam(authContext, codebase.businessTeamId),
    ),
  };
  const selectedTeamId = params?.teamId ?? "";
  const selectedTeam = options.businessTeams.find((team) => team.id === selectedTeamId);
  const rawMap = new Map(rawBlueprints.map((item) => [item.id, item]));
  const visibleBlueprintIds = new Set(
    rawBlueprints
      .filter((blueprint) => !selectedTeam || blueprint.ownerBusinessTeamId === selectedTeam.id)
      .map((blueprint) => blueprint.id),
  );
  const visibleBlueprints = snapshot.blueprints.filter((blueprint) => visibleBlueprintIds.has(blueprint.id));
  const visibleScheduleAssessments = snapshot.scheduleAssessments.filter((assessment) =>
    visibleBlueprintIds.has(blueprintIdFromScheduleTemplateId(assessment.templateId)),
  );
  const scheduledCount = visibleScheduleAssessments.filter((assessment) =>
    assessment.state === "due" || assessment.state === "scheduled",
  ).length;
  const dueCount = visibleScheduleAssessments.filter((assessment) => assessment.state === "due").length;
  const baseDefaultBlueprint = defaultBlueprint();
  const defaultNewBlueprint = {
    ...baseDefaultBlueprint,
    ownerBusinessTeamId: selectedTeam?.id ?? baseDefaultBlueprint.ownerBusinessTeamId,
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="ui.taskBlueprints.header.eyebrow"
        title="ui.taskBlueprints.header.title"
        description="ui.taskBlueprints.header.description"
        badges={[
          { label: <>{visibleBlueprints.length} ui.common.count.taskBlueprints</>, variant: "accent" },
          { label: selectedTeam?.name ?? "ui.taskBlueprints.values.allTeams", variant: "neutral" },
        ]}
      />

      <SummaryStrip
        items={[
          {
            label: "ui.taskBlueprints.summary.total",
            value: visibleBlueprints.length,
            detail: <>{visibleBlueprints.filter((item) => item.status === "active").length} ui.common.detail.enabled</>,
          },
          {
            label: "ui.taskBlueprints.summary.automation",
            value: visibleBlueprints.filter((item) => ["webhook", "cron"].includes(String(item.trigger.type))).length,
            detail: "ui.taskBlueprints.summary.automationDetail",
          },
          {
            label: "ui.taskBlueprints.summary.boundEnvironment",
            value: visibleBlueprints.filter((item) => Boolean(rawMap.get(item.id)?.environmentId)).length,
            detail: "ui.taskBlueprints.summary.boundEnvironmentDetail",
          },
        ]}
      />

      <SoftwareTeamWorkflowStarter options={options} selectedBusinessTeamId={selectedTeam?.id} />

      <TaskBlueprintSchedulerConsole scheduledCount={scheduledCount} dueCount={dueCount} />

      <Panel>
        <PanelHeader
          eyebrow="ui.taskBlueprints.list.eyebrow"
          title="ui.taskBlueprints.list.title"
          description={
            selectedTeam
              ? t("ui.taskBlueprints.list.descriptionTeam", undefined, { teamName: selectedTeam.name })
              : "ui.taskBlueprints.list.descriptionAll"
          }
          action={
            <div className="flex flex-wrap gap-2">
              {selectedTeam ? (
                <Button asChild size="sm" variant="ghost"><Link href="/task-blueprints">ui.taskBlueprints.list.clearTeam</Link></Button>
              ) : null}
              <Dialog>
                <DialogTrigger asChild>
                  <Button size="sm" variant="secondary">
                    <Plus className="h-4 w-4" />
                    ui.taskBlueprints.list.create
                  </Button>
                </DialogTrigger>
                <DialogContent className="w-[min(96vw,1180px)]">
                  <DialogHeader>
                    <DialogTitle>ui.taskBlueprints.list.createTitle</DialogTitle>
                    <DialogDescription>ui.taskBlueprints.list.createDescription</DialogDescription>
                  </DialogHeader>
                  <DialogBody>
                    <TaskBlueprintEditor
                      embedded
                      title="ui.taskBlueprints.list.createTitle"
                      blueprint={defaultNewBlueprint}
                      options={options}
                    />
                  </DialogBody>
                </DialogContent>
              </Dialog>
            </div>
          }
        />
        <PanelBody className="p-0">
          <DataTable>
            <DataTableHeader>
              <DataTableRow className="hover:bg-transparent">
                <DataTableHead>ui.taskBlueprints.columns.blueprint</DataTableHead>
                <DataTableHead>ui.taskBlueprints.columns.team</DataTableHead>
                <DataTableHead>ui.taskBlueprints.columns.trigger</DataTableHead>
                <DataTableHead>ui.taskBlueprints.columns.environment</DataTableHead>
                <DataTableHead>ui.taskBlueprints.columns.status</DataTableHead>
                <DataTableHead>ui.taskBlueprints.columns.readiness</DataTableHead>
                <DataTableHead>ui.taskBlueprints.columns.updated</DataTableHead>
                <DataTableHead align="right">ui.taskBlueprints.columns.actions</DataTableHead>
              </DataTableRow>
            </DataTableHeader>
            <DataTableBody>
              {visibleBlueprints.map((blueprint) => {
                const raw = rawMap.get(blueprint.id);
                if (!raw) return null;
                const trigger = parseRecord(raw.triggerJson);
                const selector = parseRecord(raw.environmentSelectorJson);
                const outputPolicy = parseRecord(raw.outputPolicyJson);
                const publishers = parsePublishers(outputPolicy.publishers);
                const scopeLabel = codebaseScopeLabel(selector, options.codebases ?? [], t);

                return (
                  <DataTableRow key={blueprint.id}>
                    <DataTableCell className="min-w-[260px]">
                      <Link
                        href={`/task-blueprints/${blueprint.id}`}
                        className="font-medium text-[var(--ink)] hover:underline"
                      >
                        {blueprint.name}
                      </Link>
                      <div className="mt-1 text-xs text-[var(--ink-muted)]">{blueprint.id}</div>
                      <div className="mt-2 text-xs text-[var(--ink-muted)]">
                        {blueprint.category} · v{blueprint.version}
                      </div>
                    </DataTableCell>
                    <DataTableCell>
                      <div className="font-medium text-[var(--ink)]">{blueprint.businessTeamName}</div>
                      <div className="mt-1 text-xs text-[var(--ink-muted)]">{blueprint.agentTeamName}</div>
                    </DataTableCell>
                    <DataTableCell>
                      <div>{triggerLabel(trigger, t)}</div>
                      <div className="mt-1 text-xs text-[var(--ink-muted)]">
                        {trigger.idempotencyKey ? <>ui.common.idempotencyKeyPrefix {String(trigger.idempotencyKey)}</> : "ui.taskBlueprints.values.none"}
                      </div>
                    </DataTableCell>
                    <DataTableCell>
                      <div>{blueprint.environmentName}</div>
                      <div className="mt-1 text-xs text-[var(--ink-muted)]">
                        {selector.executionPath ? <>{t("ui.common.pathPrefix")} {String(selector.executionPath)}</> : t("ui.taskBlueprints.values.none")}
                      </div>
                      <div className="mt-1 text-xs text-[var(--ink-muted)]">
                        {t("ui.taskBlueprintEditor.fields.codebaseScope")} · {scopeLabel}
                      </div>
                    </DataTableCell>
                    <DataTableCell>
                      <div className="flex flex-wrap gap-2">
                        <span className="rounded-full bg-[var(--surface-muted)] px-2 py-1 text-xs text-[var(--ink)]">
                          {translateStatus(blueprint.status)}
                        </span>
                        <span className="rounded-full bg-[var(--surface-muted)] px-2 py-1 text-xs text-[var(--ink)]">
                          {translateVisibility(blueprint.visibility)}
                        </span>
                      </div>
                      <div className="mt-2 text-xs text-[var(--ink-muted)]">
                        {t("ui.taskBlueprints.outputPrefix")} {publishers.length ? publishers.join(", ") : t("ui.taskBlueprints.values.dashboard")}
                      </div>
                    </DataTableCell>
                    <DataTableCell className="min-w-[180px]">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant={readinessVariant(blueprint.readiness.status)}>
                          {t(`ui.taskBlueprintReadiness.status.${blueprint.readiness.status}`)}
                        </Badge>
                        <span className="text-sm font-medium text-[var(--ink)]">
                          {t("ui.taskBlueprintReadiness.score", undefined, { score: blueprint.readiness.score })}
                        </span>
                      </div>
                      <div className="mt-1 text-xs text-[var(--ink-muted)]">
                        {t("ui.taskBlueprintReadiness.issueSummary", undefined, {
                          blockers: blueprint.readiness.blockerCount,
                          warnings: blueprint.readiness.warningCount,
                        })}
                      </div>
                    </DataTableCell>
                    <DataTableCell>{formatDateTime(raw.updatedAt)}</DataTableCell>
                    <DataTableCell align="right">
                      <div className="flex items-center justify-end gap-2">
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button size="sm" variant="ghost">
                              <Eye className="h-4 w-4" />
                              ui.taskBlueprints.list.view
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="w-[min(96vw,980px)]">
                            <DialogHeader>
                              <DialogTitle>{blueprint.name}</DialogTitle>
                              <DialogDescription>ui.taskBlueprints.list.viewDescription</DialogDescription>
                            </DialogHeader>
                            <DialogBody className="space-y-5">
                              <DefinitionList
                                items={[
                                  { label: "ui.taskBlueprints.fields.id", value: blueprint.id },
                                  { label: "ui.taskBlueprints.fields.category", value: blueprint.category },
                                  { label: "ui.taskBlueprints.fields.businessTeam", value: blueprint.businessTeamName },
                                  { label: "ui.taskBlueprints.fields.agentTeam", value: blueprint.agentTeamName },
                                  { label: "ui.taskBlueprints.fields.environment", value: blueprint.environmentName },
                                  { label: "ui.taskBlueprints.columns.status", value: translateStatus(blueprint.status) },
                                  { label: "ui.taskBlueprints.fields.visibility", value: translateVisibility(blueprint.visibility) },
                                ]}
                              />

                              <DefinitionList
                                items={[
                                  { label: "ui.taskBlueprints.fields.summary", value: triggerLabel(trigger, t) },
                                  { label: "ui.taskBlueprints.fields.connector", value: compactValue(trigger.connector) },
                                  { label: "ui.taskBlueprints.fields.event", value: compactValue(trigger.event) },
                                  { label: "ui.taskBlueprints.fields.webhookPath", value: compactValue(trigger.webhookPathKey) },
                                  { label: "ui.taskBlueprints.fields.cron", value: compactValue(trigger.expression) },
                                  { label: "ui.taskBlueprints.fields.idempotencyKey", value: compactValue(trigger.idempotencyKey) },
                                ]}
                              />

                              <DefinitionList
                                items={[
                                  { label: "ui.taskBlueprints.fields.repoBinding", value: compactValue(selector.repoBinding) },
                                  { label: "ui.taskBlueprintEditor.fields.codebaseScope", value: scopeLabel },
                                  { label: "ui.taskBlueprints.fields.checkoutMode", value: compactValue(selector.checkoutMode) },
                                  { label: "ui.taskBlueprints.fields.executionPath", value: compactValue(selector.executionPath) },
                                  { label: "ui.taskBlueprints.fields.sandboxMode", value: compactValue(selector.sandboxMode) },
                                  { label: "ui.taskBlueprints.fields.sandboxRef", value: compactValue(selector.sandboxRef) },
                                  { label: "ui.taskBlueprints.fields.publishers", value: publishers.length ? publishers.join(", ") : "ui.taskBlueprints.values.dashboard" },
                                ]}
                              />
                            </DialogBody>
                          </DialogContent>
                        </Dialog>

                        <Dialog>
                          <DialogTrigger asChild>
                            <Button size="sm" variant="ghost">
                              <PencilLine className="h-4 w-4" />
                              ui.taskBlueprints.list.edit
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="w-[min(96vw,1180px)]">
                            <DialogHeader>
                              <DialogTitle>{t("ui.taskBlueprints.list.editTitle", undefined, { name: blueprint.name })}</DialogTitle>
                              <DialogDescription>ui.taskBlueprints.list.editDescription</DialogDescription>
                            </DialogHeader>
                            <DialogBody>
                              <TaskBlueprintEditor
                                embedded
                                title="ui.taskBlueprints.list.edit"
                                blueprint={raw}
                                options={options}
                              />
                            </DialogBody>
                          </DialogContent>
                        </Dialog>
                        <DeleteResourceButton endpoint="/api/task-blueprints" id={blueprint.id} confirmParams={{ resource: "ui.common.resources.taskBlueprint", name: blueprint.name }} />
                      </div>
                    </DataTableCell>
                  </DataTableRow>
                );
              })}
            </DataTableBody>
          </DataTable>
        </PanelBody>
      </Panel>
    </div>
  );
}
