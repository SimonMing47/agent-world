import Link from "next/link";
import { formatDateTime } from "@/lib/utils";
import { getDashboardSnapshot } from "@/server/queries";

export default function QuestsPage() {
  const snapshot = getDashboardSnapshot();

  return (
    <div className="space-y-3">
      {snapshot.quests.map((quest) => {
        const team = snapshot.teamSummaries.find((item) => item.id === quest.teamId);
        const kingdom = snapshot.kingdomSummaries.find((item) => item.id === quest.kingdomId);

        return (
          <Link
            key={quest.id}
            href={`/quests/${quest.id}`}
            className="block rounded-[28px] border border-[var(--line)] bg-[var(--surface-strong)] px-5 py-5 transition hover:bg-[var(--surface)]"
          >
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="text-lg font-semibold text-[var(--ink)]">
                  {quest.sourceRef ?? quest.sourceType}
                </div>
                <div className="mt-1 text-sm text-[var(--ink-muted)]">
                  {team?.name ?? "Unknown team"} · {kingdom?.name ?? "Unknown kingdom"}
                </div>
              </div>
              <div className="text-[11px] uppercase tracking-[0.18em] text-[var(--ink-muted)]">
                {quest.status}
              </div>
            </div>
            <div className="mt-4 grid gap-3 text-sm text-[var(--ink-muted)] md:grid-cols-4">
              <div>Source: {quest.sourceType}</div>
              <div>Priority: {quest.priority}</div>
              <div>Estimate: ${quest.costEstimate}</div>
              <div>Created: {formatDateTime(quest.createdAt)}</div>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
