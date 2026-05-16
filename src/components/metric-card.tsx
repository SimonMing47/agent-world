export function MetricCard(props: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <section className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] px-5 py-4 shadow-[0_1px_2px_rgba(16,24,40,0.03)]">
      <div className="text-[11px] font-medium uppercase tracking-[0.16em] text-[var(--ink-muted)]">
        {props.label}
      </div>
      <div className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-[var(--ink)] sm:text-4xl">
        {props.value}
      </div>
      <p className="mt-2 max-w-[20rem] text-sm leading-6 text-[var(--ink-muted)]">
        {props.detail}
      </p>
    </section>
  );
}
