import { formatPercent } from "@/lib/utils";
import { getDashboardSnapshot } from "@/server/queries";

export default function TavernPage() {
  const snapshot = getDashboardSnapshot();

  return (
    <div className="space-y-4">
      {snapshot.tavernResumes.map((listing) => (
        <section
          key={listing.id}
          className="rounded-[28px] border border-[var(--line)] bg-[var(--surface-strong)] p-6"
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-[11px] font-medium uppercase tracking-[0.22em] text-[var(--ink-muted)]">
                Tavern listing
              </div>
              <h3 className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-[var(--ink)]">
                {listing.teamName}
              </h3>
            </div>
            <div className="text-[11px] uppercase tracking-[0.18em] text-[var(--ink-muted)]">
              {listing.recruitmentMode}
            </div>
          </div>
          <div className="mt-4 grid gap-4 md:grid-cols-4">
            <div className="rounded-[24px] border border-[var(--line)] bg-[var(--surface)] p-4">
              <div className="text-sm text-[var(--ink-muted)]">Success rate</div>
              <div className="mt-2 text-xl font-semibold text-[var(--ink)]">
                {formatPercent(listing.resume.successRate ?? 0)}
              </div>
            </div>
            <div className="rounded-[24px] border border-[var(--line)] bg-[var(--surface)] p-4">
              <div className="text-sm text-[var(--ink-muted)]">Average latency</div>
              <div className="mt-2 text-xl font-semibold text-[var(--ink)]">
                {Math.round((listing.resume.avgLatencyMs ?? 0) / 1000)}s
              </div>
            </div>
            <div className="rounded-[24px] border border-[var(--line)] bg-[var(--surface)] p-4">
              <div className="text-sm text-[var(--ink-muted)]">Average cost</div>
              <div className="mt-2 text-xl font-semibold text-[var(--ink)]">
                ${listing.resume.avgCostUsd ?? 0}
              </div>
            </div>
            <div className="rounded-[24px] border border-[var(--line)] bg-[var(--surface)] p-4">
              <div className="text-sm text-[var(--ink-muted)]">Tags</div>
              <div className="mt-2 text-sm font-medium text-[var(--ink)]">
                {listing.tags.join(", ")}
              </div>
            </div>
          </div>
        </section>
      ))}
    </div>
  );
}
