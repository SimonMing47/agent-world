import { buildHarnessSummary } from "@/server/harness-core";
import { listHarnessProfiles } from "@/server/queries";

export default function HarnessPage() {
  const harnesses = listHarnessProfiles();

  return (
    <div className="space-y-4">
      {harnesses.map((profile) => {
        const harness = buildHarnessSummary(profile);
        const scope =
          profile.teamId
            ? "AgentTeam"
            : profile.kingdomId
              ? "Kingdom"
              : profile.worldId
                ? "World"
                : "Global";

        return (
          <section
            key={profile.id}
            className="rounded-[28px] border border-[var(--line)] bg-[var(--surface-strong)] p-6"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-[11px] font-medium uppercase tracking-[0.22em] text-[var(--ink-muted)]">
                  {scope} harness
                </div>
                <h3 className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-[var(--ink)]">
                  {harness.name}
                </h3>
              </div>
              <div className="text-[11px] uppercase tracking-[0.18em] text-[var(--ink-muted)]">
                {scope}
              </div>
            </div>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-[var(--ink-muted)]">
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
                  Approval gates
                </div>
                <div className="mt-3 text-sm leading-6 text-[var(--ink)]">
                  {harness.approvalRequiredTools.join(", ") || "No human gate"}
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
        );
      })}
    </div>
  );
}
