import { getDashboardSnapshot } from "@/server/queries";
import { translateStatus } from "@/lib/presentation";

export default function KingdomsPage() {
  const snapshot = getDashboardSnapshot();

  return (
    <div className="space-y-4">
      {snapshot.kingdomSummaries.map((kingdom) => (
        <section
          key={kingdom.id}
          className="rounded-[28px] border border-[var(--line)] bg-[var(--surface-strong)] p-6"
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-[11px] font-medium uppercase tracking-[0.22em] text-[var(--ink-muted)]">
                Kingdom 团队
              </div>
              <h3 className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-[var(--ink)]">
                {kingdom.name}
              </h3>
            </div>
            <div className="text-[11px] uppercase tracking-[0.18em] text-[var(--ink-muted)]">
              {translateStatus(kingdom.status)}
            </div>
          </div>
          <div className="mt-5 grid gap-4 md:grid-cols-4">
            <div className="rounded-[24px] border border-[var(--line)] bg-[var(--surface)] p-4">
              <div className="text-sm text-[var(--ink-muted)]">余额</div>
              <div className="mt-2 text-xl font-semibold text-[var(--ink)]">${kingdom.balance}</div>
            </div>
            <div className="rounded-[24px] border border-[var(--line)] bg-[var(--surface)] p-4">
              <div className="text-sm text-[var(--ink-muted)]">信用额度</div>
              <div className="mt-2 text-xl font-semibold text-[var(--ink)]">${kingdom.creditLimit}</div>
            </div>
            <div className="rounded-[24px] border border-[var(--line)] bg-[var(--surface)] p-4">
              <div className="text-sm text-[var(--ink-muted)]">工具引用数</div>
              <div className="mt-2 text-xl font-semibold text-[var(--ink)]">{kingdom.toolRefCount}</div>
            </div>
            <div className="rounded-[24px] border border-[var(--line)] bg-[var(--surface)] p-4">
              <div className="text-sm text-[var(--ink-muted)]">私有记忆命名空间</div>
              <div className="mt-2 text-sm font-medium text-[var(--ink)]">{kingdom.privateMemoryNamespace}</div>
            </div>
          </div>
        </section>
      ))}
    </div>
  );
}
