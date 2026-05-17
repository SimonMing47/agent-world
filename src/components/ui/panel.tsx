"use client";

import { useLanguageText } from "@/components/language-pack-provider";
import { cn } from "@/lib/utils";

export function Panel({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLElement> & {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section
      className={cn(
        "rounded-lg border border-[var(--line)] bg-[var(--surface)] shadow-[0_1px_2px_rgba(16,24,40,0.02)]",
        className,
      )}
      {...props}
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
  const text = useLanguageText();

  return (
    <div className="flex flex-col gap-4 border-b border-[var(--line)] px-5 py-4 sm:flex-row sm:items-start sm:justify-between">
      <div>
        {eyebrow ? (
          <div className="text-xs font-medium text-[var(--ink-muted)]">
            {text(eyebrow)}
          </div>
        ) : null}
        <h3 className="mt-1 text-base font-semibold text-[var(--ink)]">{text(title)}</h3>
        {description ? <p className="mt-1 text-sm leading-6 text-[var(--ink-muted)]">{text(description)}</p> : null}
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
