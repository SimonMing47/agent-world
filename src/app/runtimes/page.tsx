import { RuntimeDiscoveryButton } from "@/components/runtime-discovery-button";
import { translateRuntimeKind, translateStatus } from "@/lib/presentation";
import { getDashboardSnapshot } from "@/server/queries";

export default function RuntimesPage() {
  const snapshot = getDashboardSnapshot();

  return (
    <div className="space-y-6">
      <section className="flex flex-col justify-between gap-4 rounded-[28px] border border-[var(--line)] bg-[var(--surface-strong)] p-6 lg:flex-row lg:items-end">
        <div>
          <div className="text-[11px] font-medium uppercase tracking-[0.22em] text-[var(--ink-muted)]">
            Runtime 发现
          </div>
          <h3 className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-[var(--ink)]">
            探测 OpenCode runtime，并刷新能力目录。
          </h3>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--ink-muted)]">
            AgentWorld 本身保持单体部署，但在任务分发前，仍然可以发现并探活外部 runtime。
          </p>
        </div>
        <RuntimeDiscoveryButton />
      </section>

      <section className="space-y-3">
        {snapshot.runtimes.map((runtime) => (
          <div
            key={runtime.id}
            className="rounded-[24px] border border-[var(--line)] bg-[var(--surface-strong)] px-5 py-5"
          >
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="text-lg font-semibold text-[var(--ink)]">{runtime.name}</div>
                <div className="mt-1 text-sm text-[var(--ink-muted)]">{runtime.baseUrl}</div>
              </div>
              <div className="text-xs uppercase tracking-[0.18em] text-[var(--ink-muted)]">
                {translateStatus(runtime.healthStatus)}
              </div>
            </div>
            <div className="mt-4 grid gap-3 text-sm text-[var(--ink-muted)] md:grid-cols-4">
              <div>类型: {translateRuntimeKind(runtime.runtimeKind)}</div>
              <div>
                并发占用: {runtime.activeRunCount} / {runtime.concurrencyLimit}
              </div>
              <div>Agent 目录: {runtime.agents.join(", ") || "未发现 Agent"}</div>
              <div>Provider 目录: {runtime.providers.join(", ") || "未发现 Provider"}</div>
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}
