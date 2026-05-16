import Link from "next/link";
import { notFound } from "next/navigation";
import { BlueprintSubmitConsole } from "@/components/blueprint-submit-console";
import { TaskBlueprintEditor } from "@/components/task-blueprint-editor";
import { translateStatus, translateVisibility } from "@/lib/presentation";
import { formatDateTime } from "@/lib/utils";
import { getTaskBlueprintDetail } from "@/server/queries";

function JsonBlock({ value }: { value: unknown }) {
  return (
    <pre className="mt-3 max-h-[360px] overflow-auto rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-4 text-xs leading-5 text-[var(--ink-muted)]">
      {JSON.stringify(value, null, 2)}
    </pre>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-[28px] border border-[var(--line)] bg-[var(--surface-strong)] p-6">
      <div className="text-[11px] font-medium uppercase tracking-[0.22em] text-[var(--ink-muted)]">
        {title}
      </div>
      {children}
    </section>
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
    <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
      <div className="space-y-4">
        <BlueprintSubmitConsole
          blueprintId={detail.blueprint.id}
          initialPayload={buildInputDraft(detail.inputSchema)}
        />

        <Section title="任务蓝图">
          <h3 className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-[var(--ink)]">
            {detail.blueprint.name}
          </h3>
          <div className="mt-4 grid gap-2 text-sm text-[var(--ink-muted)] md:grid-cols-2">
            <div>ID: {detail.blueprint.id}</div>
            <div>类别: {detail.blueprint.category}</div>
            <div>状态: {translateStatus(detail.blueprint.status)}</div>
            <div>可见性: {translateVisibility(detail.blueprint.visibility)}</div>
            <div>业务团队: {detail.businessTeamName}</div>
            <div>Agent 团队: {detail.agentTeamName}</div>
            <div>环境: {detail.environmentName}</div>
            <div>Provider: {detail.providerName}</div>
          </div>
        </Section>

        <Section title="权限预览">
          <div className="mt-3 grid gap-3 md:grid-cols-3">
            <div className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-4">
              <div className="text-sm text-[var(--ink-muted)]">Allow</div>
              <div className="mt-2 text-2xl font-semibold text-[var(--ink)]">{detail.permissionPreview.counts.allow}</div>
            </div>
            <div className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-4">
              <div className="text-sm text-[var(--ink-muted)]">Ask</div>
              <div className="mt-2 text-2xl font-semibold text-[var(--ink)]">{detail.permissionPreview.counts.ask}</div>
            </div>
            <div className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-4">
              <div className="text-sm text-[var(--ink-muted)]">Deny</div>
              <div className="mt-2 text-2xl font-semibold text-[var(--ink)]">{detail.permissionPreview.counts.deny}</div>
            </div>
          </div>
          <div className="mt-4 space-y-2">
            {detail.permissionPreview.rules.map((rule) => (
              <div key={`${rule.effect}-${rule.resource}-${rule.scope}`} className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] px-4 py-3 text-sm text-[var(--ink-muted)]">
                <span className="font-semibold text-[var(--ink)]">{rule.effect}</span> · {rule.resource} · {rule.scope}
              </div>
            ))}
          </div>
        </Section>

        <Section title="最近运行">
          <div className="mt-4 space-y-3">
            {detail.recentRuns.length === 0 ? (
              <div className="text-sm text-[var(--ink-muted)]">暂无运行实例</div>
            ) : (
              detail.recentRuns.map((run) => (
                <Link
                  key={run.id}
                  href={`/task-runs/${run.id}`}
                  className="block rounded-2xl border border-[var(--line)] bg-[var(--surface)] px-4 py-3 text-sm text-[var(--ink-muted)] transition hover:text-[var(--ink)]"
                >
                  <div className="font-semibold text-[var(--ink)]">{run.sourceRef ?? run.sourceType}</div>
                  <div className="mt-1">
                    {translateStatus(run.status)} · {formatDateTime(run.createdAt)}
                  </div>
                </Link>
              ))
            )}
          </div>
        </Section>
      </div>

      <div className="space-y-4">
        <TaskBlueprintEditor blueprint={detail.blueprint} options={detail.options} />

        <Section title="触发器与输入">
          <JsonBlock value={{ trigger: detail.trigger, inputSchema: detail.inputSchema }} />
        </Section>

        <Section title="执行环境与记忆">
          <JsonBlock
            value={{
              environmentSelector: detail.environmentSelector,
              memoryPolicy: detail.memoryPolicy,
              archivePolicy: detail.archivePolicy,
            }}
          />
        </Section>

        <Section title="Agent 团队编排">
          <div className="mt-3 text-lg font-semibold text-[var(--ink)]">
            {detail.runPlan.strategy} · Leader {detail.runPlan.leader.agentName}
          </div>
          <div className="mt-4 space-y-3">
            {detail.runPlan.workers.map((worker) => (
              <div key={`${worker.agent}-${worker.task}`} className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] px-4 py-3">
                <div className="text-sm font-semibold text-[var(--ink)]">{worker.agentName}</div>
                <div className="mt-1 text-sm leading-6 text-[var(--ink-muted)]">{worker.task}</div>
              </div>
            ))}
          </div>
        </Section>

        <Section title="输出与看板">
          <JsonBlock
            value={{
              outputPolicy: detail.outputPolicy,
              dashboardPolicy: detail.dashboardPolicy,
              resultSchema: detail.resultSchema,
            }}
          />
        </Section>

        <Section title="可靠性策略">
          <JsonBlock value={detail.executionPolicy} />
        </Section>
      </div>
    </div>
  );
}
