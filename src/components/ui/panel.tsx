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
        "overflow-hidden rounded-[26px] border border-white/54 bg-[var(--surface)] shadow-none backdrop-blur-xl",
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
    <div className="flex flex-col gap-4 border-b border-[var(--line)] bg-transparent px-6 py-5 sm:flex-row sm:items-start sm:justify-between">
      <div>
        {eyebrow ? (
          <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--ink-subtle)]">
            {text(eyebrow)}
          </div>
        ) : null}
        <h3 className="mt-1 text-[18px] font-semibold tracking-[-0.03em] text-[var(--ink)]">{text(title)}</h3>
        {description ? <p className="mt-1 max-w-3xl text-[12px] leading-6 text-[var(--ink-subtle)]">{localizeNode(description, text)}</p> : null}
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
