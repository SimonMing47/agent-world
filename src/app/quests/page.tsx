import Link from "next/link";
import { translateSourceType, translateStatus } from "@/lib/presentation";
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
                  {team?.name ?? "未知团队"} · {kingdom?.name ?? "未知 Kingdom"}
                </div>
              </div>
              <div className="text-[11px] uppercase tracking-[0.18em] text-[var(--ink-muted)]">
                {translateStatus(quest.status)}
              </div>
            </div>
            <div className="mt-4 grid gap-3 text-sm text-[var(--ink-muted)] md:grid-cols-4">
              <div>来源: {translateSourceType(quest.sourceType)}</div>
              <div>优先级: {quest.priority}</div>
              <div>预估成本: ${quest.costEstimate}</div>
              <div>创建时间: {formatDateTime(quest.createdAt)}</div>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
