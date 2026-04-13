import { listHarnessProfiles } from "@/server/queries";
import { buildHarnessSummary } from "@/server/harness-core";

export default function HarnessPage() {
  const harnesses = listHarnessProfiles().map(buildHarnessSummary);

  return (
    <div className="space-y-4">
      {harnesses.map((harness) => (
        <section
          key={harness.name}
          className="rounded-[28px] border border-[var(--line)] bg-[var(--surface-strong)] p-6"
        >
          <div className="text-[11px] font-medium uppercase tracking-[0.22em] text-[var(--ink-muted)]">
            Harness profile
          </div>
          <h3 className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-[var(--ink)]">
            {harness.name}
          </h3>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--ink-muted)]">
            {harness.instruction}
          </p>
          <div className="mt-5 grid gap-4 md:grid-cols-3">
            <div className="rounded-[24px] border border-[var(--line)] bg-[var(--surface)] p-4">
              <div className="text-[11px] font-medium uppercase tracking-[0.22em] text-[var(--ink-muted)]">
                Allowed tools
              </div>
              <div className="mt-3 text-sm leading-6 text-[var(--ink)]">
                {harness.allowedTools.join(", ")}
              </div>
            </div>
            <div className="rounded-[24px] border border-[var(--line)] bg-[var(--surface)] p-4">
              <div className="text-[11px] font-medium uppercase tracking-[0.22em] text-[var(--ink-muted)]">
                Human gates
              </div>
              <div className="mt-3 text-sm leading-6 text-[var(--ink)]">
                {harness.approvalRequiredTools.join(", ") || "No approval gate"}
              </div>
            </div>
            <div className="rounded-[24px] border border-[var(--line)] bg-[var(--surface)] p-4">
              <div className="text-[11px] font-medium uppercase tracking-[0.22em] text-[var(--ink-muted)]">
                Budget
              </div>
              <div className="mt-3 text-sm leading-6 text-[var(--ink)]">
                {harness.budget.maxRuntimeMinutes} min / {harness.budget.maxSteps} steps / {harness.budget.maxToolCalls} tool calls
              </div>
            </div>
          </div>
        </section>
      ))}
    </div>
  );
}
