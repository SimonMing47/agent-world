import { BookOpen, Database, Layers3, RefreshCcw } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Panel, PanelBody } from "@/components/ui/panel";
import { getKnowledgeManagementSnapshot } from "@/server/openviking-core";

function syncStatusLabel(status: string) {
  if (status.startsWith("remote_")) return "已同步 OpenViking";
  if (status === "local_shadow") return "本地影子库";
  return "待处理";
}

export default async function KnowledgePage() {
  const snapshot = await getKnowledgeManagementSnapshot();

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Knowledge"
        title="知识库与 Skill 空间"
        description="基于 OpenViking 管理知识层、Skill 注册表、最近知识条目和远端树。"
        badges={[
          { label: snapshot.health.ok ? "OpenViking 已连接" : "OpenViking 未连接", variant: snapshot.health.ok ? "success" : "warning" },
          { label: `${snapshot.layers.length} 个知识层`, variant: "accent" },
        ]}
      />

      <Panel>
        <PanelBody className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-xl border border-[var(--line)] bg-[var(--surface-muted)] p-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-[var(--ink)]">
              <BookOpen className="h-4 w-4" />
              OpenViking
            </div>
            <div className="mt-2 text-sm text-[var(--ink-muted)]">Base URL: {snapshot.health.baseUrl}</div>
            <div className="mt-1 text-sm text-[var(--ink-muted)]">状态: {snapshot.health.error ?? "healthy"}</div>
          </div>
          <div className="rounded-xl border border-[var(--line)] bg-[var(--surface-muted)] p-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-[var(--ink)]">
              <Layers3 className="h-4 w-4" />
              知识层
            </div>
            <div className="mt-2 text-3xl font-semibold text-[var(--ink)]">{snapshot.layers.length}</div>
          </div>
          <div className="rounded-xl border border-[var(--line)] bg-[var(--surface-muted)] p-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-[var(--ink)]">
              <Database className="h-4 w-4" />
              知识条目
            </div>
            <div className="mt-2 text-3xl font-semibold text-[var(--ink)]">{snapshot.entries.length}</div>
          </div>
          <div className="rounded-xl border border-[var(--line)] bg-[var(--surface-muted)] p-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-[var(--ink)]">
              <RefreshCcw className="h-4 w-4" />
              远端树
            </div>
            <div className="mt-2 text-3xl font-semibold text-[var(--ink)]">{snapshot.tree.length}</div>
            <div className="mt-1 text-sm text-[var(--ink-muted)]">L0 筛选 / L1 目录 / L2 原文</div>
          </div>
        </PanelBody>
      </Panel>

      <section className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <section className="space-y-3">
          <div className="text-[11px] font-medium uppercase tracking-[0.18em] text-[var(--ink-muted)]">Layer Registry</div>
          <div className="mt-4 space-y-3">
            {snapshot.layers.map((layer) => (
              <div
                key={layer.id}
                className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-4"
              >
                <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <div className="text-base font-semibold text-[var(--ink)]">{layer.name}</div>
                    <div className="mt-1 text-sm text-[var(--ink-muted)]">{layer.description}</div>
                  </div>
                  <div className="rounded-full border border-[var(--line)] px-3 py-1 text-xs uppercase tracking-[0.16em] text-[var(--ink-muted)]">
                    {layer.scope}
                  </div>
                </div>
                <div className="mt-3 break-all rounded-xl bg-[var(--surface-muted)] px-3 py-2 text-xs text-[var(--ink-muted)]">
                  {layer.vikingUri}
                </div>
              </div>
            ))}
          </div>
        </section>

        <div className="space-y-6">
          <section className="space-y-3">
            <div className="text-[11px] font-medium uppercase tracking-[0.18em] text-[var(--ink-muted)]">Skill Registry</div>
            <div className="mt-4 space-y-3">
              {snapshot.skills.map((skill) => (
                <div
                  key={skill.id}
                  className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-4"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-sm font-semibold text-[var(--ink)]">{skill.name}</div>
                    <div className="text-[11px] uppercase tracking-[0.16em] text-[var(--ink-muted)]">
                      {skill.layer}
                    </div>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-[var(--ink-muted)]">
                    {skill.description}
                  </p>
                </div>
              ))}
            </div>
          </section>

          <section className="space-y-3">
            <div className="text-[11px] font-medium uppercase tracking-[0.18em] text-[var(--ink-muted)]">Recent Knowledge</div>
            <div className="mt-4 space-y-3">
              {snapshot.entries.map((entry) => (
                <div
                  key={entry.id}
                  className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-4"
                >
                  <div className="text-sm font-semibold text-[var(--ink)]">{entry.title}</div>
                  <div className="mt-1 text-xs text-[var(--ink-muted)]">{syncStatusLabel(entry.syncStatus)}</div>
                  <div className="mt-2 break-all text-xs leading-5 text-[var(--ink-muted)]">{entry.vikingUri}</div>
                </div>
              ))}
            </div>
          </section>

          <section className="space-y-3">
            <div className="text-[11px] font-medium uppercase tracking-[0.18em] text-[var(--ink-muted)]">OpenViking Tree</div>
            <div className="mt-4 space-y-2">
              {snapshot.tree.length === 0 ? (
                <div className="text-sm text-[var(--ink-muted)]">还没有远端树数据，先启动 OpenViking 或执行一次知识同步。</div>
              ) : (
                snapshot.tree.slice(0, 12).map((node) => (
                  <div
                    key={String(node.uri)}
                    className="rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-xs"
                  >
                    <div className="break-all font-medium text-[var(--ink)]">{String(node.uri)}</div>
                    <div className="mt-1 text-[var(--ink-muted)]">{String(node.abstract ?? "")}</div>
                  </div>
                ))
              )}
            </div>
          </section>
        </div>
      </section>
    </div>
  );
}
