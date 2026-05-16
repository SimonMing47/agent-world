import { getDashboardSnapshot } from "@/server/queries";
import { translateStatus } from "@/lib/presentation";

export default function AccessGrantsPage() {
  const snapshot = getDashboardSnapshot();

  return (
    <div className="space-y-4">
      {snapshot.access_grants.map((accessGrant) => (
        <section
          key={accessGrant.id}
          className="rounded-[28px] border border-[var(--line)] bg-[var(--surface-strong)] p-6"
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-[11px] font-medium uppercase tracking-[0.22em] text-[var(--ink-muted)]">
                跨团队授权
              </div>
              <h3 className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-[var(--ink)]">
                {accessGrant.providerTeamName} {"->"} {accessGrant.consumerBusinessTeamName}
              </h3>
            </div>
            <div className="text-[11px] uppercase tracking-[0.18em] text-[var(--ink-muted)]">
              {translateStatus(accessGrant.status)}
            </div>
          </div>
          <div className="mt-5 grid gap-4 md:grid-cols-4">
            <div className="rounded-[24px] border border-[var(--line)] bg-[var(--surface)] p-4">
              <div className="text-sm text-[var(--ink-muted)]">服务账号</div>
              <div className="mt-2 text-sm font-medium text-[var(--ink)]">{accessGrant.serviceAccountRef}</div>
            </div>
            <div className="rounded-[24px] border border-[var(--line)] bg-[var(--surface)] p-4">
              <div className="text-sm text-[var(--ink-muted)]">基础价格</div>
              <div className="mt-2 text-xl font-semibold text-[var(--ink)]">
                ${accessGrant.pricing.baseUsd ?? 0}
              </div>
            </div>
            <div className="rounded-[24px] border border-[var(--line)] bg-[var(--surface)] p-4">
              <div className="text-sm text-[var(--ink-muted)]">Token 倍率</div>
              <div className="mt-2 text-xl font-semibold text-[var(--ink)]">
                {accessGrant.pricing.tokenMultiplier ?? 0}
              </div>
            </div>
            <div className="rounded-[24px] border border-[var(--line)] bg-[var(--surface)] p-4">
              <div className="text-sm text-[var(--ink-muted)]">SLA</div>
              <div className="mt-2 text-sm font-medium text-[var(--ink)]">
                {accessGrant.sla.responseSeconds ?? 0}s / {Math.round((accessGrant.sla.successRateFloor ?? 0) * 100)}%
              </div>
            </div>
          </div>
        </section>
      ))}
    </div>
  );
}
