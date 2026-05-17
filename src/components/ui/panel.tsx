import { cn } from "@/lib/utils";

export function Panel({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section
      className={cn(
        "rounded-lg border border-[var(--line)] bg-[var(--surface)] shadow-[0_1px_2px_rgba(16,24,40,0.02)]",
        className,
      )}
    >
      {children}
    </section>
  );
}

export function PanelHeader({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4 border-b border-[var(--line)] px-5 py-4 sm:flex-row sm:items-start sm:justify-between">
      <div>
        {eyebrow ? (
          <div className="text-[11px] font-medium uppercase tracking-[0.18em] text-[var(--ink-muted)]">
            {eyebrow}
          </div>
        ) : null}
        <h3 className="mt-1 text-lg font-semibold text-[var(--ink)]">{title}</h3>
        {description ? <p className="mt-1 text-sm leading-6 text-[var(--ink-muted)]">{description}</p> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

export function PanelBody({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return <div className={cn("px-5 py-4", className)}>{children}</div>;
}
