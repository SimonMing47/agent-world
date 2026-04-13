import { notFound } from "next/navigation";
import { TraceGroup } from "@/components/trace-group";
import { getQuestDetail } from "@/server/queries";

export default async function QuestDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const resolved = await params;
  const detail = getQuestDetail(resolved.id);

  if (!detail) {
    notFound();
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[0.86fr_1.14fr]">
      <section className="space-y-4">
        <div className="rounded-[28px] border border-[var(--line)] bg-[var(--surface-strong)] p-6">
          <div className="text-[11px] font-medium uppercase tracking-[0.22em] text-[var(--ink-muted)]">
            Quest summary
          </div>
          <h3 className="mt-3 text-2xl font-semibold tracking-[-0.04em] text-[var(--ink)]">
            {detail.quest.sourceRef ?? detail.quest.sourceType}
          </h3>
          <div className="mt-5 space-y-2 text-sm text-[var(--ink-muted)]">
            <div>Status: {detail.quest.status}</div>
            <div>World: {detail.world?.name ?? "Unknown world"}</div>
            <div>Kingdom: {detail.kingdom?.name ?? "Unknown kingdom"}</div>
            <div>Team: {detail.team?.name ?? "Unknown team"}</div>
            <div>Requested by: {detail.quest.requestedBy}</div>
            <div>Estimated cost: ${detail.quest.costEstimate}</div>
            <div>Actual cost: ${detail.quest.costActual}</div>
          </div>
        </div>

        {detail.contract ? (
          <div className="rounded-[28px] border border-[var(--line)] bg-[var(--surface-strong)] p-6">
            <div className="text-[11px] font-medium uppercase tracking-[0.22em] text-[var(--ink-muted)]">
              Contract
            </div>
            <div className="mt-3 text-lg font-semibold text-[var(--ink)]">
              {detail.contract.serviceAccountRef}
            </div>
            <div className="mt-3 space-y-2 text-sm text-[var(--ink-muted)]">
              <div>Status: {detail.contract.status}</div>
              <div>
                Scope: {(detail.contract.scope.actions ?? []).join(", ") || "No actions"}
              </div>
              <div>
                Tools: {(detail.contract.scope.tools ?? []).join(", ") || "No tools"}
              </div>
              <div>
                SLA: {detail.contract.sla.responseSeconds ?? 0}s / {Math.round((detail.contract.sla.successRateFloor ?? 0) * 100)}%
              </div>
            </div>
          </div>
        ) : null}

        {detail.harness ? (
          <div className="rounded-[28px] border border-[var(--line)] bg-[var(--surface-strong)] p-6">
            <div className="text-[11px] font-medium uppercase tracking-[0.22em] text-[var(--ink-muted)]">
              Harness
            </div>
            <div className="mt-3 text-lg font-semibold text-[var(--ink)]">{detail.harness.name}</div>
            <p className="mt-2 text-sm leading-6 text-[var(--ink-muted)]">
              {detail.harness.instruction}
            </p>
            <div className="mt-4 space-y-2 text-sm text-[var(--ink-muted)]">
              <div>Allowed tools: {detail.harness.allowedTools.join(", ")}</div>
              <div>Approval required: {detail.harness.approvalRequiredTools.join(", ") || "None"}</div>
              <div>Blocked tools: {detail.harness.blockedTools.join(", ") || "None"}</div>
              <div>
                Budget: {detail.harness.budget.maxRuntimeMinutes}m / {detail.harness.budget.maxSteps} steps / {detail.harness.budget.maxToolCalls} tool calls
              </div>
            </div>
          </div>
        ) : null}

        <div className="rounded-[28px] border border-[var(--line)] bg-[var(--surface-strong)] p-6">
          <div className="text-[11px] font-medium uppercase tracking-[0.22em] text-[var(--ink-muted)]">
            Plan and nodes
          </div>
          <div className="mt-3 text-sm text-[var(--ink-muted)]">
            {detail.plan?.summary ?? "No plan summary"}
          </div>
          <div className="mt-4 space-y-3">
            {detail.nodes.map((node) => (
              <div
                key={node.id}
                className="rounded-[24px] border border-[var(--line)] bg-[var(--surface)] px-4 py-4"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="text-base font-semibold text-[var(--ink)]">
                    {node.nodeKey} · {node.agentName}
                  </div>
                  <div className="text-[11px] uppercase tracking-[0.18em] text-[var(--ink-muted)]">
                    {node.status}
                  </div>
                </div>
                <div className="mt-2 grid gap-2 text-sm text-[var(--ink-muted)] md:grid-cols-2">
                  <div>Attempts: {node.attemptLabel}</div>
                  <div>Dependencies: {node.dependencyCount}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {detail.interventions.length > 0 ? (
          <div className="rounded-[28px] border border-[var(--line)] bg-[var(--surface-strong)] p-6">
            <div className="text-[11px] font-medium uppercase tracking-[0.22em] text-[var(--ink-muted)]">
              Human intervention
            </div>
            <div className="mt-4 space-y-3">
              {detail.interventions.map((intervention) => (
                <div
                  key={intervention.id}
                  className="rounded-[24px] border border-[var(--line)] bg-[var(--surface)] px-4 py-4"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-base font-semibold text-[var(--ink)]">
                      {intervention.requestedAction}
                    </div>
                    <div className="text-[11px] uppercase tracking-[0.18em] text-[var(--ink-muted)]">
                      {intervention.status}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </section>

      <section className="space-y-4">
        <div className="rounded-[28px] border border-[var(--line)] bg-[var(--surface-strong)] p-6">
          <div className="text-[11px] font-medium uppercase tracking-[0.22em] text-[var(--ink-muted)]">
            Invocation stages
          </div>
          <div className="mt-4 space-y-3">
            {detail.invocationStages.map((stage, index) => (
              <div
                key={stage.key}
                className="grid gap-3 rounded-[24px] border border-[var(--line)] bg-[var(--surface)] px-4 py-4 md:grid-cols-[auto_1fr]"
              >
                <div className="flex h-9 w-9 items-center justify-center rounded-full border border-[var(--line)] bg-[var(--canvas)] text-sm font-semibold text-[var(--ink)]">
                  {index + 1}
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="text-base font-semibold text-[var(--ink)]">{stage.label}</div>
                    <div className="text-[11px] uppercase tracking-[0.18em] text-[var(--ink-muted)]">
                      {stage.owner}
                    </div>
                  </div>
                  <p className="mt-1 text-sm leading-6 text-[var(--ink-muted)]">
                    {stage.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-4 rounded-[24px] border border-[var(--line)] bg-[var(--surface)] p-4">
            <div className="text-[11px] font-medium uppercase tracking-[0.22em] text-[var(--ink-muted)]">
              Provider rationale
            </div>
            <div className="mt-2 space-y-1 text-sm text-[var(--ink-muted)]">
              {detail.providerRationale.map((line) => (
                <div key={line}>{line}</div>
              ))}
            </div>
          </div>
        </div>

        {Object.entries(detail.groupedEvents).map(([group, events]) => (
          <TraceGroup key={group} title={group} events={events} />
        ))}
      </section>
    </div>
  );
}
