import { notFound } from "next/navigation";
import { TraceGroup } from "@/components/trace-group";
import { getRunDetail } from "@/server/queries";

export default async function RunDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const resolved = await params;
  const detail = getRunDetail(resolved.id);

  if (!detail) {
    notFound();
  }

  const groupEntries = Object.entries(detail.groupedEvents);

  return (
    <div className="grid gap-6 xl:grid-cols-[0.88fr_1.12fr]">
      <section className="rounded-[28px] border border-[var(--line)] bg-[var(--surface-strong)] p-6">
        <div className="text-[11px] font-medium uppercase tracking-[0.22em] text-[var(--ink-muted)]">
          Run summary
        </div>
        <h3 className="mt-3 text-2xl font-semibold tracking-[-0.04em] text-[var(--ink)]">
          {detail.run.summary}
        </h3>
        <div className="mt-6 space-y-3 text-sm text-[var(--ink-muted)]">
          <div>Dispatch state: {detail.run.dispatchState}</div>
          <div>Invocation state: {detail.run.invocationState}</div>
          <div>Result: {detail.run.resultStatus}</div>
          <div>Runtime: {detail.runtime?.name ?? "Unknown runtime"}</div>
          <div>Task: {detail.task?.name ?? "Unknown task"}</div>
        </div>

        {detail.harness ? (
          <div className="mt-6 rounded-[24px] border border-[var(--line)] bg-[var(--surface)] p-4">
            <div className="text-[11px] font-medium uppercase tracking-[0.22em] text-[var(--ink-muted)]">
              Harness profile
            </div>
            <div className="mt-2 text-lg font-semibold text-[var(--ink)]">
              {detail.harness.name}
            </div>
            <p className="mt-2 text-sm leading-6 text-[var(--ink-muted)]">
              {detail.harness.instruction}
            </p>
            <div className="mt-4 grid gap-3 text-sm text-[var(--ink-muted)]">
              <div>Allowed tools: {detail.harness.allowedTools.join(", ")}</div>
              <div>
                Approval required:{" "}
                {detail.harness.approvalRequiredTools.join(", ") || "None"}
              </div>
              <div>Blocked tools: {detail.harness.blockedTools.join(", ") || "None"}</div>
              <div>
                Budget: {detail.harness.budget.maxRuntimeMinutes} min / {detail.harness.budget.maxSteps} steps / {detail.harness.budget.maxToolCalls} tool calls
              </div>
            </div>
          </div>
        ) : null}
      </section>

      <section className="space-y-4">
        {groupEntries.map(([group, events]) => (
          <TraceGroup key={group} title={group} events={events} />
        ))}
      </section>
    </div>
  );
}
