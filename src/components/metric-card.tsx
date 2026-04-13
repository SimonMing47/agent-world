export function MetricCard(props: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <section className="rounded-[26px] border border-[var(--line)] bg-[var(--surface-strong)] p-5">
      <div className="text-[11px] font-medium uppercase tracking-[0.22em] text-[var(--ink-muted)]">
        {props.label}
      </div>
      <div className="mt-3 text-4xl font-semibold tracking-[-0.05em] text-[var(--ink)]">
        {props.value}
      </div>
      <p className="mt-2 max-w-[20rem] text-sm leading-6 text-[var(--ink-muted)]">
        {props.detail}
      </p>
    </section>
  );
}
