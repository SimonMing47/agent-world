import { getDashboardSnapshot } from "@/server/queries";
import { translateStatus } from "@/lib/presentation";

export default function ContractsPage() {
  const snapshot = getDashboardSnapshot();

  return (
    <div className="space-y-4">
      {snapshot.contracts.map((contract) => (
        <section
          key={contract.id}
          className="rounded-[28px] border border-[var(--line)] bg-[var(--surface-strong)] p-6"
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-[11px] font-medium uppercase tracking-[0.22em] text-[var(--ink-muted)]">
                Contract 合约
              </div>
              <h3 className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-[var(--ink)]">
                {contract.providerTeamName} {"->"} {contract.consumerKingdomName}
              </h3>
            </div>
            <div className="text-[11px] uppercase tracking-[0.18em] text-[var(--ink-muted)]">
              {translateStatus(contract.status)}
            </div>
          </div>
          <div className="mt-5 grid gap-4 md:grid-cols-4">
            <div className="rounded-[24px] border border-[var(--line)] bg-[var(--surface)] p-4">
              <div className="text-sm text-[var(--ink-muted)]">服务账号</div>
              <div className="mt-2 text-sm font-medium text-[var(--ink)]">{contract.serviceAccountRef}</div>
            </div>
            <div className="rounded-[24px] border border-[var(--line)] bg-[var(--surface)] p-4">
              <div className="text-sm text-[var(--ink-muted)]">基础价格</div>
              <div className="mt-2 text-xl font-semibold text-[var(--ink)]">
                ${contract.pricing.baseUsd ?? 0}
              </div>
            </div>
            <div className="rounded-[24px] border border-[var(--line)] bg-[var(--surface)] p-4">
              <div className="text-sm text-[var(--ink-muted)]">Token 倍率</div>
              <div className="mt-2 text-xl font-semibold text-[var(--ink)]">
                {contract.pricing.tokenMultiplier ?? 0}
              </div>
            </div>
            <div className="rounded-[24px] border border-[var(--line)] bg-[var(--surface)] p-4">
              <div className="text-sm text-[var(--ink-muted)]">SLA</div>
              <div className="mt-2 text-sm font-medium text-[var(--ink)]">
                {contract.sla.responseSeconds ?? 0}s / {Math.round((contract.sla.successRateFloor ?? 0) * 100)}%
              </div>
            </div>
          </div>
        </section>
      ))}
    </div>
  );
}
