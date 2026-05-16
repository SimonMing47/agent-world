import Link from "next/link";
import { notFound } from "next/navigation";
import { BlueprintSubmitConsole } from "@/components/blueprint-submit-console";
import { PageHeader } from "@/components/page-header";
import { TaskBlueprintEditor } from "@/components/task-blueprint-editor";
import { Badge } from "@/components/ui/badge";
import { Panel, PanelBody, PanelHeader } from "@/components/ui/panel";
import { translateStatus, translateVisibility } from "@/lib/presentation";
import { formatDateTime } from "@/lib/utils";
import { getTaskBlueprintDetail } from "@/server/queries";

function JsonBlock({ value }: { value: unknown }) {
  return (
    <pre className="overflow-auto rounded-xl border border-[var(--line)] bg-[var(--surface-muted)] p-4 text-xs leading-5 text-[var(--ink-muted)]">
      {JSON.stringify(value, null, 2)}
    </pre>
  );
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

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Blueprint Detail"
        title={detail.blueprint.name}
        description="从同一页面完成蓝图编辑、输入调试、权限预览和最近运行追踪。"
        badges={[
          { label: translateStatus(detail.blueprint.status), variant: detail.blueprint.status === "active" ? "success" : "neutral" },
          { label: translateVisibility(detail.blueprint.visibility), variant: "neutral" },
          { label: detail.blueprint.category, variant: "accent" },
        ]}
      />

      <div className="grid gap-4 xl:grid-cols-[0.92fr_1.08fr]">
        <div className="space-y-4">
          <BlueprintSubmitConsole
            blueprintId={detail.blueprint.id}
            initialPayload={buildInputDraft(detail.inputSchema)}
          />

          <Panel>
            <PanelHeader eyebrow="Summary" title="蓝图概览" description="查看任务蓝图当前绑定的核心对象和启用状态。" />
            <PanelBody className="grid gap-3 text-sm text-[var(--ink-muted)] sm:grid-cols-2">
              <div>ID: {detail.blueprint.id}</div>
              <div>类别: {detail.blueprint.category}</div>
              <div>状态: {translateStatus(detail.blueprint.status)}</div>
              <div>可见性: {translateVisibility(detail.blueprint.visibility)}</div>
              <div>业务团队: {detail.businessTeamName}</div>
              <div>Agent 团队: {detail.agentTeamName}</div>
              <div>环境: {detail.environmentName}</div>
              <div>Provider: {detail.providerName}</div>
            </PanelBody>
          </Panel>

          <Panel>
            <PanelHeader eyebrow="Permissions" title="权限预览" description="按 allow / ask / deny 查看蓝图最终生效的工具与输出权限。" />
            <PanelBody className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-xl border border-[var(--line)] bg-[var(--surface-muted)] p-4">
                  <div className="text-sm text-[var(--ink-muted)]">Allow</div>
                  <div className="mt-2 text-2xl font-semibold text-[var(--ink)]">{detail.permissionPreview.counts.allow}</div>
                </div>
                <div className="rounded-xl border border-[var(--line)] bg-[var(--surface-muted)] p-4">
                  <div className="text-sm text-[var(--ink-muted)]">Ask</div>
                  <div className="mt-2 text-2xl font-semibold text-[var(--ink)]">{detail.permissionPreview.counts.ask}</div>
                </div>
                <div className="rounded-xl border border-[var(--line)] bg-[var(--surface-muted)] p-4">
                  <div className="text-sm text-[var(--ink-muted)]">Deny</div>
                  <div className="mt-2 text-2xl font-semibold text-[var(--ink)]">{detail.permissionPreview.counts.deny}</div>
                </div>
              </div>
              <div className="space-y-2">
                {detail.permissionPreview.rules.map((rule) => (
                  <div
                    key={`${rule.effect}-${rule.resource}-${rule.scope}`}
                    className="rounded-xl border border-[var(--line)] bg-[var(--surface-muted)] px-4 py-3 text-sm text-[var(--ink-muted)]"
                  >
                    <span className="font-medium text-[var(--ink)]">{rule.effect}</span> · {rule.resource} · {rule.scope}
                  </div>
                ))}
              </div>
            </PanelBody>
          </Panel>

          <Panel>
            <PanelHeader eyebrow="Recent Runs" title="最近运行" description="从蓝图直接跳转到最近一次或历史运行实例。" />
            <PanelBody className="space-y-3">
              {detail.recentRuns.length === 0 ? (
                <div className="rounded-xl border border-dashed border-[var(--line)] px-4 py-6 text-sm text-[var(--ink-muted)]">
                  暂无运行实例
                </div>
              ) : (
                detail.recentRuns.map((run) => (
                  <Link
                    key={run.id}
                    href={`/task-runs/${run.id}`}
                    className="block rounded-xl border border-[var(--line)] bg-[var(--surface-muted)] px-4 py-4 transition hover:border-[var(--line-strong)] hover:bg-white"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-sm font-medium text-[var(--ink)]">{run.sourceRef ?? run.sourceType}</div>
                      <Badge variant={run.status === "running" ? "accent" : run.status === "failed" ? "danger" : "neutral"}>
                        {translateStatus(run.status)}
                      </Badge>
                    </div>
                    <div className="mt-2 text-sm text-[var(--ink-muted)]">{formatDateTime(run.createdAt)}</div>
                  </Link>
                ))
              )}
            </PanelBody>
          </Panel>
        </div>

        <div className="space-y-4">
          <TaskBlueprintEditor blueprint={detail.blueprint} options={detail.options} />

          <Panel>
            <PanelHeader eyebrow="Trigger" title="触发器与输入" description="显示当前蓝图用于接收输入和匹配触发的结构。" />
            <PanelBody>
              <JsonBlock value={{ trigger: detail.trigger, inputSchema: detail.inputSchema }} />
            </PanelBody>
          </Panel>

          <Panel>
            <PanelHeader eyebrow="Environment" title="执行环境与记忆" description="蓝图绑定的环境选择器、记忆空间和归档策略。" />
            <PanelBody>
              <JsonBlock
                value={{
                  environmentSelector: detail.environmentSelector,
                  memoryPolicy: detail.memoryPolicy,
                  archivePolicy: detail.archivePolicy,
                }}
              />
            </PanelBody>
          </Panel>

          <Panel>
            <PanelHeader eyebrow="Orchestration" title="Agent 团队编排" description="展示 Leader、Worker 与任务分工。" />
            <PanelBody className="space-y-3">
              <div className="text-sm font-medium text-[var(--ink)]">
                {detail.runPlan.strategy} · Leader {detail.runPlan.leader.agentName}
              </div>
              {detail.runPlan.workers.map((worker) => (
                <div key={`${worker.agent}-${worker.task}`} className="rounded-xl border border-[var(--line)] bg-[var(--surface-muted)] px-4 py-3">
                  <div className="text-sm font-medium text-[var(--ink)]">{worker.agentName}</div>
                  <div className="mt-1 text-sm leading-6 text-[var(--ink-muted)]">{worker.task}</div>
                </div>
              ))}
            </PanelBody>
          </Panel>

          <Panel>
            <PanelHeader eyebrow="Output" title="输出与看板" description="查看发布器、结果 Schema 与看板配置。" />
            <PanelBody>
              <JsonBlock
                value={{
                  outputPolicy: detail.outputPolicy,
                  dashboardPolicy: detail.dashboardPolicy,
                  resultSchema: detail.resultSchema,
                }}
              />
            </PanelBody>
          </Panel>

          <Panel>
            <PanelHeader eyebrow="Reliability" title="可靠性策略" description="包括超时、重试、并发键和幂等策略。" />
            <PanelBody>
              <JsonBlock value={detail.executionPolicy} />
            </PanelBody>
          </Panel>
        </div>
      </div>
    </div>
  );
}
