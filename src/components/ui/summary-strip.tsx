"use client";

import { useLanguageText } from "@/components/language-pack-provider";
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
  const text = useLanguageText();

  return (
    <section className={cn("overflow-hidden rounded-lg border border-[var(--line)] bg-[var(--surface)]", className)}>
      <div className={cn("grid", gridClassName)}>
        {items.map((item, index) => (
          <div
            key={`${item.label}-${index}`}
            className={cn(
              "px-5 py-3.5",
              index !== items.length - 1 && "border-b border-[var(--line)] sm:border-b-0 xl:border-r",
            )}
          >
            <div className="text-xs font-medium text-[var(--ink-muted)]">
              {text(item.label)}
            </div>
            <div className="mt-2 text-2xl font-semibold text-[var(--ink)]">{item.value}</div>
            {item.detail ? (
              <div className="mt-1.5 text-sm text-[var(--ink-muted)]">
                {typeof item.detail === "string" ? text(item.detail) : item.detail}
              </div>
            ) : null}
          </div>
        ))}
      </div>
    </section>
  );
}
