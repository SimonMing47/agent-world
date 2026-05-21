"use client";

import { localizeNode, useLanguageText } from "@/components/language-pack-provider";
import { cn } from "@/lib/utils";

export function SummaryStrip({
  items,
  className,
  gridClassName = "sm:grid-cols-2 xl:grid-cols-4",
}: {
  items: Array<{ label: React.ReactNode; value: React.ReactNode; detail?: React.ReactNode }>;
  className?: string;
  gridClassName?: string;
}) {
  const text = useLanguageText();

  return (
    <section className={cn("overflow-hidden rounded-[20px] border border-white/70 bg-[var(--surface)] shadow-[var(--shadow-soft)]", className)}>
      <div className={cn("grid", gridClassName)}>
        {items.map((item, index) => (
          <div
            key={index}
            className={cn(
              "px-6 py-5",
              index !== items.length - 1 && "border-b border-[var(--line)] sm:border-b-0 xl:border-r xl:border-[var(--line)]",
            )}
          >
            <div className="text-[11px] font-medium uppercase tracking-[0.08em] text-[var(--ink-subtle)]">
              {localizeNode(item.label, text)}
            </div>
            <div className="mt-2 text-[clamp(2rem,3vw,3rem)] font-light leading-none text-[var(--ink)]">{item.value}</div>
            {item.detail ? (
              <div className="mt-2 text-sm text-[var(--ink-muted)]">
                {localizeNode(item.detail, text)}
              </div>
            ) : null}
          </div>
        ))}
      </div>
    </section>
  );
}
