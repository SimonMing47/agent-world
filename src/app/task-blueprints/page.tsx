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
import { translateStatus, translateVisibility } from "@/lib/presentation";
import { formatDateTime } from "@/lib/utils";
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
  if (trigger.type === "access_grant") return "跨团队授权";
  return "手动触发";
}

function defaultBlueprint(options: ReturnType<typeof getTaskBlueprintEditorOptions>) {
  return {
    id: "",
    name: "New Task Definition",
    category: "general_task",
    visibility: "team",
    ownerBusinessTeamId: options.businessTeams[0]?.id ?? "",
    teamId: options.agentTeams[0]?.id ?? "",
    environmentId: options.environments[0]?.id ?? null,
    providerAdapterId: options.providerAdapters[0]?.id ?? "",
    version: 1,
    status: "draft",
    triggerJson: JSON.stringify({ type: "manual" }, null, 2),
    inputSchemaJson: JSON.stringify({ type: "object", properties: {}, required: [] }, null, 2),
    environmentSelectorJson: JSON.stringify(
      {
        type: "repository_workspace",
        repoBinding: "${repo_id}",
        checkoutMode: "full_clone",
        executionPath: options.environments[0]?.workingDirectory ?? ".",
        sandboxMode: "inherit",
      },
      null,
      2,
    ),
    agentTeamRunPlanJson: "{}",
    memoryPolicyJson: JSON.stringify({ requiredSpaces: [], archiveOutputTo: [] }, null, 2),
    providerPolicyJson: "{}",
    permissionPolicyJson: JSON.stringify({ defaultMode: "ask", rules: [] }, null, 2),
    resultSchemaJson: JSON.stringify({ type: "object", properties: {} }, null, 2),
    outputPolicyJson: JSON.stringify({ publishers: [{ type: "dashboard" }] }, null, 2),
    dashboardPolicyJson: JSON.stringify({ groupBy: ["business_team", "category", "trigger_type"] }, null, 2),
    executionPolicyJson: JSON.stringify({ timeoutMinutes: 30, retry: 1 }, null, 2),
    archivePolicyJson: JSON.stringify({ enabled: true }, null, 2),
  };
}

function compactValue(value: unknown) {
  if (value === undefined || value === null || value === "") return "无";
  if (Array.isArray(value)) return value.length ? value.map(String).join(", ") : "无";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

export default async function TaskBlueprintsPage({
  searchParams,
}: {
  searchParams?: Promise<{ teamId?: string }>;
}) {
  const params = await searchParams;
  const snapshot = getTaskBlueprintsSnapshot();
  const rawBlueprints = listTaskBlueprints();
  const options = getTaskBlueprintEditorOptions();
  const selectedTeamId = params?.teamId ?? "";
  const selectedTeam = options.businessTeams.find((team) => team.id === selectedTeamId);
  const rawMap = new Map(rawBlueprints.map((item) => [item.id, item]));
  const visibleBlueprintIds = new Set(
    rawBlueprints
      .filter((blueprint) => !selectedTeam || blueprint.ownerBusinessTeamId === selectedTeam.id)
      .map((blueprint) => blueprint.id),
  );
  const visibleBlueprints = snapshot.blueprints.filter((blueprint) => visibleBlueprintIds.has(blueprint.id));
  const baseDefaultBlueprint = defaultBlueprint(options);
  const defaultNewBlueprint = {
    ...baseDefaultBlueprint,
    ownerBusinessTeamId: selectedTeam?.id ?? baseDefaultBlueprint.ownerBusinessTeamId,
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="任务治理"
        title="任务定义"
        description="维护任务、触发方式、执行环境和编排块。"
        badges={[
          { label: `${visibleBlueprints.length} 个任务定义`, variant: "accent" },
          { label: selectedTeam?.name ?? "团队视角治理", variant: "neutral" },
        ]}
      />

      <SummaryStrip
        items={[
          {
            label: "任务定义",
            value: visibleBlueprints.length,
            detail: `${visibleBlueprints.filter((item) => item.status === "active").length} 个启用中`,
          },
          {
            label: "Webhook / Cron",
            value: visibleBlueprints.filter((item) => ["webhook", "cron"].includes(String(item.trigger.type))).length,
            detail: "事件与定时触发",
          },
          {
            label: "绑定环境",
            value: visibleBlueprints.filter((item) => item.environmentName !== "未绑定环境").length,
            detail: "已关联执行环境",
          },
          {
            label: "Finding 总数",
            value: snapshot.findingDashboard.total,
            detail: "任务累计产出",
          },
        ]}
      />

      <Panel>
        <PanelHeader
          eyebrow="目录"
          title="任务定义目录"
          description={selectedTeam ? `当前仅展示 ${selectedTeam.name} 的任务定义。` : "查看团队、触发方式、环境和状态。"}
          action={
            <div className="flex flex-wrap gap-2">
              {selectedTeam ? (
                <Button asChild size="sm" variant="ghost"><Link href="/task-blueprints">查看全部</Link></Button>
              ) : null}
              <Dialog>
                <DialogTrigger asChild>
                  <Button size="sm" variant="secondary">
                    <Plus className="h-4 w-4" />
                    新增任务
                  </Button>
                </DialogTrigger>
                <DialogContent className="w-[min(96vw,1180px)]">
                  <DialogHeader>
                    <DialogTitle>新增任务定义</DialogTitle>
                    <DialogDescription>选择 Agent 团队、执行环境和触发方式，建立一个新的任务配置。</DialogDescription>
                  </DialogHeader>
                  <DialogBody>
                    <TaskBlueprintEditor
                      embedded
                      title="新增任务定义"
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
                <DataTableHead>任务定义</DataTableHead>
                <DataTableHead>业务团队 / Agent 团队</DataTableHead>
                <DataTableHead>触发方式</DataTableHead>
                <DataTableHead>执行环境</DataTableHead>
                <DataTableHead>状态 / 可见性</DataTableHead>
                <DataTableHead>更新时间</DataTableHead>
                <DataTableHead align="right">操作</DataTableHead>
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
                        {trigger.idempotencyKey ? `幂等键 ${String(trigger.idempotencyKey)}` : "无幂等键模板"}
                      </div>
                    </DataTableCell>
                    <DataTableCell>
                      <div>{blueprint.environmentName}</div>
                      <div className="mt-1 text-xs text-[var(--ink-muted)]">
                        {selector.executionPath ? `路径 ${String(selector.executionPath)}` : "继承环境默认路径"}
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
                        发布 {publishers.length ? publishers.join(", ") : "dashboard"}
                      </div>
                    </DataTableCell>
                    <DataTableCell>{formatDateTime(raw.updatedAt)}</DataTableCell>
                    <DataTableCell align="right">
                      <div className="flex items-center justify-end gap-2">
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button size="sm" variant="ghost">
                              <Eye className="h-4 w-4" />
                              查看
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="w-[min(96vw,980px)]">
                            <DialogHeader>
                              <DialogTitle>{blueprint.name}</DialogTitle>
                              <DialogDescription>查看任务与 Agent 团队、环境、触发方式和发布策略的绑定关系。</DialogDescription>
                            </DialogHeader>
                            <DialogBody className="space-y-5">
                              <DefinitionList
                                items={[
                                  { label: "任务 Key", value: blueprint.id },
                                  { label: "任务类别", value: blueprint.category },
                                  { label: "业务团队", value: blueprint.businessTeamName },
                                  { label: "Agent 团队", value: blueprint.agentTeamName },
                                  { label: "执行环境", value: blueprint.environmentName },
                                  { label: "执行底座", value: "系统内置" },
                                  { label: "状态", value: translateStatus(blueprint.status) },
                                  { label: "可见性", value: translateVisibility(blueprint.visibility) },
                                ]}
                              />

                              <DefinitionList
                                items={[
                                  { label: "触发方式", value: triggerLabel(trigger) },
                                  { label: "连接器", value: compactValue(trigger.connector) },
                                  { label: "事件", value: compactValue(trigger.event) },
                                  { label: "Webhook 路径", value: compactValue(trigger.webhookPathKey) },
                                  { label: "Cron", value: compactValue(trigger.expression) },
                                  { label: "幂等键模板", value: compactValue(trigger.idempotencyKey) },
                                ]}
                              />

                              <DefinitionList
                                items={[
                                  { label: "仓库绑定", value: compactValue(selector.repoBinding) },
                                  { label: "Checkout 模式", value: compactValue(selector.checkoutMode) },
                                  { label: "运行路径", value: compactValue(selector.executionPath) },
                                  { label: "沙箱模式", value: compactValue(selector.sandboxMode) },
                                  { label: "沙箱引用", value: compactValue(selector.sandboxRef) },
                                  { label: "发布通道", value: publishers.length ? publishers.join(", ") : "dashboard" },
                                ]}
                              />
                            </DialogBody>
                          </DialogContent>
                        </Dialog>

                        <Dialog>
                          <DialogTrigger asChild>
                            <Button size="sm" variant="ghost">
                              <PencilLine className="h-4 w-4" />
                              编辑
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="w-[min(96vw,1180px)]">
                            <DialogHeader>
                              <DialogTitle>编辑 {blueprint.name}</DialogTitle>
                              <DialogDescription>调整任务关联的 Agent 团队、执行环境和触发方式。</DialogDescription>
                            </DialogHeader>
                            <DialogBody>
                              <TaskBlueprintEditor
                                embedded
                                title={`编辑 ${blueprint.name}`}
                                blueprint={raw}
                                options={options}
                              />
                            </DialogBody>
                          </DialogContent>
                        </Dialog>
                        <DeleteResourceButton endpoint="/api/task-blueprints" id={blueprint.id} confirmText={`确认删除任务定义「${blueprint.name}」？`} />
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
