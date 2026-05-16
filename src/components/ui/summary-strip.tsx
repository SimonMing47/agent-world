import { cn } from "@/lib/utils";

export function SummaryStrip({
  items,
  className,
  gridClassName = "sm:grid-cols-2 xl:grid-cols-4",
}: {
  items: Array<{ label: string; value: React.ReactNode; detail?: React.ReactNode }>;
  className?: string;
  gridClassName?: string;
}) {
  return (
    <section className={cn("overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--surface)]", className)}>
      <div className={cn("grid", gridClassName)}>
        {items.map((item, index) => (
          <div
            key={`${item.label}-${index}`}
            className={cn(
              "px-5 py-4",
              index !== items.length - 1 && "border-b border-[var(--line)] sm:border-b-0 xl:border-r",
            )}
          >
            <div className="text-[11px] font-medium uppercase tracking-[0.14em] text-[var(--ink-muted)]">
              {item.label}
            </div>
            <div className="mt-2 text-2xl font-semibold text-[var(--ink)] sm:text-3xl">{item.value}</div>
            {item.detail ? <div className="mt-2 text-sm text-[var(--ink-muted)]">{item.detail}</div> : null}
          </div>
        ))}
      </div>
    </section>
  );
}
