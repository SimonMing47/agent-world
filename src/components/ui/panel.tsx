"use client";

import { localizeNode, useLanguageText } from "@/components/language-pack-provider";
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
        "overflow-hidden rounded-[20px] border border-white/70 bg-[var(--surface)] shadow-[var(--shadow-soft)]",
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
  description?: React.ReactNode;
  action?: React.ReactNode;
}) {
  const text = useLanguageText();

  return (
    <div className="flex flex-col gap-4 border-b border-[var(--line)] bg-[var(--surface-subtle)]/92 px-6 py-5 sm:flex-row sm:items-start sm:justify-between">
      <div>
        {eyebrow ? (
          <div className="text-[11px] font-medium uppercase tracking-[0.08em] text-[var(--ink-subtle)]">
            {text(eyebrow)}
          </div>
        ) : null}
        <h3 className="mt-1.5 text-[18px] font-semibold text-[var(--ink)]">{text(title)}</h3>
        {description ? <p className="mt-1.5 max-w-3xl text-sm leading-7 text-[var(--ink-muted)]">{localizeNode(description, text)}</p> : null}
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
  return <div className={cn("px-6 py-5", className)}>{children}</div>;
}
