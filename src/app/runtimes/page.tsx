import { RuntimeDiscoveryButton } from "@/components/runtime-discovery-button";
import { listRuntimeEndpoints } from "@/server/queries";

export default function RuntimesPage() {
  const runtimes = listRuntimeEndpoints();

  return (
    <div className="space-y-6">
      <section className="flex flex-col justify-between gap-4 rounded-[28px] border border-[var(--line)] bg-[var(--surface-strong)] p-6 lg:flex-row lg:items-end">
        <div>
          <div className="text-[11px] font-medium uppercase tracking-[0.22em] text-[var(--ink-muted)]">
            Runtime discovery
          </div>
          <h3 className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-[var(--ink)]">
            Probe OpenCode runtimes and refresh the health catalog.
          </h3>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--ink-muted)]">
            Discovery runs through the OpenCode SDK. The platform keeps runtime health visible before work is dispatched.
          </p>
        </div>
        <RuntimeDiscoveryButton />
      </section>

      <section className="space-y-3">
        {runtimes.map((runtime) => (
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
                {runtime.healthStatus}
              </div>
            </div>
            <div className="mt-4 grid gap-3 text-sm text-[var(--ink-muted)] md:grid-cols-3">
              <div>Kind: {runtime.runtimeKind}</div>
              <div>
                Concurrency: {runtime.activeRunCount} / {runtime.concurrencyLimit}
              </div>
              <div>Agents: {JSON.parse(runtime.agentCatalogJson).join(", ")}</div>
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}
