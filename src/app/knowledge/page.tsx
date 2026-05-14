import { BookOpen, Database, Layers3, RadioTower, RefreshCcw } from "lucide-react";
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
      <section className="rounded-[32px] border border-[var(--line)] bg-[linear-gradient(135deg,#fffaf0_0%,#eef5ec_55%,#f6efe4_100%)] p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.22em] text-[var(--ink-muted)]">
              <BookOpen className="h-4 w-4" />
              OpenViking Knowledge
            </div>
            <h1 className="mt-3 max-w-3xl text-4xl font-semibold tracking-[-0.05em] text-[var(--ink)]">
              分层知识管理系统
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-[var(--ink-muted)]">
              AgentWorld 会把 MR 上下文、检视技能、检视意见和人工反馈写入真实 OpenViking，同时保留本地影子索引。平台读取时按 L0 摘要、L1 目录概览、L2 原文三层使用知识。
            </p>
          </div>
          <div className="grid gap-2 rounded-[24px] border border-[var(--line)] bg-[rgba(255,252,246,0.76)] px-5 py-4 text-sm text-[var(--ink-muted)]">
            <div className="flex items-center gap-2 font-semibold text-[var(--ink)]">
              <RadioTower className="h-4 w-4" />
              {snapshot.health.ok ? "OpenViking 已连接" : "OpenViking 未连接"}
            </div>
            <div>Base URL: {snapshot.health.baseUrl}</div>
            <div>状态: {snapshot.health.error ?? "healthy"}</div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-4">
        <div className="rounded-[28px] border border-[var(--line)] bg-[var(--surface-strong)] p-5">
          <div className="flex items-center gap-2 text-sm font-semibold text-[var(--ink)]">
            <Layers3 className="h-4 w-4" />
            知识层
          </div>
          <div className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-[var(--ink)]">
            {snapshot.layers.length}
          </div>
          <div className="mt-1 text-sm text-[var(--ink-muted)]">已启用的 OpenViking 层</div>
        </div>
        <div className="rounded-[28px] border border-[var(--line)] bg-[var(--surface-strong)] p-5">
          <div className="flex items-center gap-2 text-sm font-semibold text-[var(--ink)]">
            <Database className="h-4 w-4" />
            知识条目
          </div>
          <div className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-[var(--ink)]">
            {snapshot.entries.length}
          </div>
          <div className="mt-1 text-sm text-[var(--ink-muted)]">最近索引条目</div>
        </div>
        <div className="rounded-[28px] border border-[var(--line)] bg-[var(--surface-strong)] p-5">
          <div className="flex items-center gap-2 text-sm font-semibold text-[var(--ink)]">
            <RefreshCcw className="h-4 w-4" />
            远端树
          </div>
          <div className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-[var(--ink)]">
            {snapshot.tree.length}
          </div>
          <div className="mt-1 text-sm text-[var(--ink-muted)]">OpenViking 返回节点</div>
        </div>
        <div className="rounded-[28px] border border-[var(--line)] bg-[var(--surface-strong)] p-5">
          <div className="text-sm font-semibold text-[var(--ink)]">读取策略</div>
          <div className="mt-3 text-sm leading-7 text-[var(--ink-muted)]">
            L0 用于快速筛选，L1 用于选择目录，L2 用于生成有证据的检视意见。
          </div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <div className="rounded-[28px] border border-[var(--line)] bg-[var(--surface-strong)] p-6">
          <div className="text-[11px] font-medium uppercase tracking-[0.22em] text-[var(--ink-muted)]">
            Layer Registry
          </div>
          <div className="mt-4 space-y-3">
            {snapshot.layers.map((layer) => (
              <div
                key={layer.id}
                className="rounded-[24px] border border-[var(--line)] bg-[var(--surface)] p-4"
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
                <div className="mt-3 break-all rounded-2xl bg-[var(--surface-strong)] px-3 py-2 text-xs text-[var(--ink-muted)]">
                  {layer.vikingUri}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-6">
          <section className="rounded-[28px] border border-[var(--line)] bg-[var(--surface-strong)] p-6">
            <div className="text-[11px] font-medium uppercase tracking-[0.22em] text-[var(--ink-muted)]">
              Recent Knowledge
            </div>
            <div className="mt-4 space-y-3">
              {snapshot.entries.map((entry) => (
                <div
                  key={entry.id}
                  className="rounded-[22px] border border-[var(--line)] bg-[var(--surface)] p-4"
                >
                  <div className="text-sm font-semibold text-[var(--ink)]">{entry.title}</div>
                  <div className="mt-1 text-xs text-[var(--ink-muted)]">{syncStatusLabel(entry.syncStatus)}</div>
                  <div className="mt-2 break-all text-xs leading-5 text-[var(--ink-muted)]">{entry.vikingUri}</div>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-[28px] border border-[var(--line)] bg-[var(--surface-strong)] p-6">
            <div className="text-[11px] font-medium uppercase tracking-[0.22em] text-[var(--ink-muted)]">
              OpenViking Tree
            </div>
            <div className="mt-4 space-y-2">
              {snapshot.tree.length === 0 ? (
                <div className="text-sm text-[var(--ink-muted)]">还没有远端树数据，先启动 OpenViking 或执行一次知识同步。</div>
              ) : (
                snapshot.tree.slice(0, 12).map((node) => (
                  <div
                    key={String(node.uri)}
                    className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-xs"
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

