import Link from "next/link";
import { Eye, PencilLine, Plus } from "lucide-react";
import { DeleteResourceButton } from "@/components/delete-resource-button";
import { PageHeader } from "@/components/page-header";
import { TaskBlueprintEditor } from "@/components/task-blueprint-editor";
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

function triggerLabel(trigger: Record<string, unknown>) {
  if (trigger.type === "webhook") return `Webhook · ${String(trigger.event ?? trigger.webhookPathKey ?? "")}`;
  if (trigger.type === "cron") return `Cron · ${String(trigger.expression ?? "")}`;
  if (trigger.type === "access_grant") return "ui.generated.c2c4520c3e3";
  return "ui.generated.c044f207b47";
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
  if (value === undefined || value === null || value === "") return "ui.generated.c72077749f7";
  if (Array.isArray(value)) return value.length ? value.map(String).join(", ") : "ui.generated.c72077749f7";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
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
  const baseDefaultBlueprint = defaultBlueprint();
  const defaultNewBlueprint = {
    ...baseDefaultBlueprint,
    ownerBusinessTeamId: selectedTeam?.id ?? baseDefaultBlueprint.ownerBusinessTeamId,
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="ui.generated.c4b2b8be8a2"
        title="ui.generated.c971c6e5190"
        description="ui.generated.c8fc234d252"
        badges={[
          { label: <>{visibleBlueprints.length} ui.common.count.taskBlueprints</>, variant: "accent" },
          { label: selectedTeam?.name ?? "ui.generated.ce3bcba3752", variant: "neutral" },
        ]}
      />

      <SummaryStrip
        items={[
          {
            label: "ui.generated.c971c6e5190",
            value: visibleBlueprints.length,
            detail: <>{visibleBlueprints.filter((item) => item.status === "active").length} ui.common.detail.enabled</>,
          },
          {
            label: "Webhook / Cron",
            value: visibleBlueprints.filter((item) => ["webhook", "cron"].includes(String(item.trigger.type))).length,
            detail: "ui.generated.c59abb92a56",
          },
          {
            label: "ui.generated.c549d54135d",
            value: visibleBlueprints.filter((item) => item.environmentName !== "ui.generated.c304b35fa0b").length,
            detail: "ui.generated.c3fd83f822a",
          },
        ]}
      />

      <Panel>
        <PanelHeader
          eyebrow="ui.generated.c41e5243e2d"
          title="ui.generated.c1d43bcb9b7"
          description={selectedTeam ? <>ui.common.detail.currentOnlyShows {selectedTeam.name} ui.common.detail.blueprintsOnly</> : "ui.generated.c22951a6db9"}
          action={
            <div className="flex flex-wrap gap-2">
              {selectedTeam ? (
                <Button asChild size="sm" variant="ghost"><Link href="/task-blueprints">ui.generated.ced2172fd78</Link></Button>
              ) : null}
              <Dialog>
                <DialogTrigger asChild>
                  <Button size="sm" variant="secondary">
                    <Plus className="h-4 w-4" />
                    ui.generated.ca503a0712c
                  </Button>
                </DialogTrigger>
                <DialogContent className="w-[min(96vw,1180px)]">
                  <DialogHeader>
                    <DialogTitle>ui.generated.c776ad11882</DialogTitle>
                    <DialogDescription>ui.generated.c4ab4516d37</DialogDescription>
                  </DialogHeader>
                  <DialogBody>
                    <TaskBlueprintEditor
                      embedded
                      title="ui.generated.c776ad11882"
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
                <DataTableHead>ui.generated.c971c6e5190</DataTableHead>
                <DataTableHead>ui.generated.c97fa784b22</DataTableHead>
                <DataTableHead>ui.generated.cf67f1852d8</DataTableHead>
                <DataTableHead>ui.generated.c059d73c843</DataTableHead>
                <DataTableHead>ui.generated.cdcb82b8701</DataTableHead>
                <DataTableHead>ui.generated.c093dea88c9</DataTableHead>
                <DataTableHead align="right">ui.generated.cf3ea6d345e</DataTableHead>
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
                      <div>{triggerLabel(trigger)}</div>
                      <div className="mt-1 text-xs text-[var(--ink-muted)]">
                        {trigger.idempotencyKey ? <>ui.common.idempotencyKeyPrefix {String(trigger.idempotencyKey)}</> : "ui.generated.cb2b6bde95b"}
                      </div>
                    </DataTableCell>
                    <DataTableCell>
                      <div>{blueprint.environmentName}</div>
                      <div className="mt-1 text-xs text-[var(--ink-muted)]">
                        {selector.executionPath ? <>{t("ui.common.pathPrefix", "路径")} {String(selector.executionPath)}</> : "ui.generated.c4202f60d95"}
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
                        {t("ui.generated.c94f172d02f", "发布")} {publishers.length ? publishers.join(", ") : "dashboard"}
                      </div>
                    </DataTableCell>
                    <DataTableCell>{formatDateTime(raw.updatedAt)}</DataTableCell>
                    <DataTableCell align="right">
                      <div className="flex items-center justify-end gap-2">
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button size="sm" variant="ghost">
                              <Eye className="h-4 w-4" />
                              ui.generated.cf7acefd2d4
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="w-[min(96vw,980px)]">
                            <DialogHeader>
                              <DialogTitle>{blueprint.name}</DialogTitle>
                              <DialogDescription>ui.generated.c70a5b469a0</DialogDescription>
                            </DialogHeader>
                            <DialogBody className="space-y-5">
                              <DefinitionList
                                items={[
                                  { label: "ui.generated.c617a5f9a25", value: blueprint.id },
                                  { label: "ui.generated.c3c943b28b2", value: blueprint.category },
                                  { label: "ui.generated.c2b90028ff3", value: blueprint.businessTeamName },
                                  { label: "ui.generated.c70f970c1fc", value: blueprint.agentTeamName },
                                  { label: "ui.generated.c059d73c843", value: blueprint.environmentName },
                                  { label: "ui.generated.c130e6348e4", value: "ui.generated.c130e6348e4" },
                                  { label: "ui.generated.c62e951a692", value: translateStatus(blueprint.status) },
                                  { label: "ui.generated.c747b74cec9", value: translateVisibility(blueprint.visibility) },
                                ]}
                              />

                              <DefinitionList
                                items={[
                                  { label: "ui.generated.cf67f1852d8", value: triggerLabel(trigger) },
                                  { label: "ui.generated.cc2dd028659", value: compactValue(trigger.connector) },
                                  { label: "ui.generated.c550e328062", value: compactValue(trigger.event) },
                                  { label: "ui.generated.cb2b35cae7f", value: compactValue(trigger.webhookPathKey) },
                                  { label: "Cron", value: compactValue(trigger.expression) },
                                  { label: "ui.generated.cbec9421d1b", value: compactValue(trigger.idempotencyKey) },
                                ]}
                              />

                              <DefinitionList
                                items={[
                                  { label: "ui.generated.c2e570732c1", value: compactValue(selector.repoBinding) },
                                  { label: "ui.generated.cba5d810d8e", value: compactValue(selector.checkoutMode) },
                                  { label: "ui.generated.c9ff2c99ee4", value: compactValue(selector.executionPath) },
                                  { label: "ui.generated.c5b587a4e31", value: compactValue(selector.sandboxMode) },
                                  { label: "ui.generated.c945fc763f7", value: compactValue(selector.sandboxRef) },
                                  { label: "ui.generated.c305d5f7578", value: publishers.length ? publishers.join(", ") : "dashboard" },
                                ]}
                              />
                            </DialogBody>
                          </DialogContent>
                        </Dialog>

                        <Dialog>
                          <DialogTrigger asChild>
                            <Button size="sm" variant="ghost">
                              <PencilLine className="h-4 w-4" />
                              ui.generated.ca7f814c0a4
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="w-[min(96vw,1180px)]">
                            <DialogHeader>
                              <DialogTitle>ui.generated.ca7f814c0a4 {blueprint.name}</DialogTitle>
                              <DialogDescription>ui.generated.cec4658d09a</DialogDescription>
                            </DialogHeader>
                            <DialogBody>
                              <TaskBlueprintEditor
                                embedded
                                title="actions.edit"
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
