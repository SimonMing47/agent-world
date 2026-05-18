export function MetricCard(props: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <section className="rounded-lg border border-[var(--line)] bg-[var(--surface)] px-5 py-4">
      <div className="text-xs font-medium text-[var(--ink-subtle)]">
        {props.label}
      </div>
      <div className="mt-3 text-2xl font-semibold tracking-normal text-[var(--ink)] sm:text-3xl">
        {props.value}
      </div>
      <p className="mt-2 max-w-[20rem] text-sm leading-6 text-[var(--ink-muted)]">
        {props.detail}
      </p>
    </section>
  );
}
