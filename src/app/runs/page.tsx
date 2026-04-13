import Link from "next/link";
import { formatDateTime } from "@/lib/utils";
import { listTaskRuns } from "@/server/queries";

export default function RunsPage() {
  const runs = listTaskRuns();

  return (
    <div className="rounded-[28px] border border-[var(--line)] bg-[var(--surface-strong)] p-6">
      <div className="text-[11px] font-medium uppercase tracking-[0.22em] text-[var(--ink-muted)]">
        Task runs
      </div>
      <div className="mt-4 space-y-3">
        {runs.map((run) => (
          <Link
            key={run.id}
            href={`/runs/${run.id}`}
            className="grid gap-3 rounded-[24px] border border-[var(--line)] bg-[var(--surface)] px-4 py-4 transition hover:border-[var(--line-strong)]"
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="text-lg font-semibold text-[var(--ink)]">{run.summary}</div>
              <div className="text-xs uppercase tracking-[0.18em] text-[var(--ink-muted)]">
                {run.dispatchState} / {run.invocationState}
              </div>
            </div>
            <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-[var(--ink-muted)]">
              <div>Requested by: {run.requestedBy}</div>
              <div>Started: {formatDateTime(run.startedAt)}</div>
              <div>Result: {run.resultStatus}</div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
