"use client";

import { useLanguageText } from "@/components/language-pack-provider";
import { cn } from "@/lib/utils";

export function DefinitionList({
  items,
  columnsClassName = "sm:grid-cols-2",
}: {
  items: Array<{ label: string; value: React.ReactNode; detail?: React.ReactNode }>;
  columnsClassName?: string;
}) {
  const text = useLanguageText();

  return (
    <dl className={cn("grid gap-x-8 gap-y-0", columnsClassName)}>
      {items.map((item, index) => (
        <div key={`${item.label}-${index}`} className="border-b border-[var(--line)] py-3 last:border-b-0">
          <dt suppressHydrationWarning className="text-xs font-medium text-[var(--ink-subtle)]">
            {text(item.label)}
          </dt>
          <dd className="mt-2 text-sm font-medium text-[var(--ink)]">
            <span suppressHydrationWarning className="contents">
              {typeof item.value === "string" ? text(item.value) : item.value}
            </span>
          </dd>
          {item.detail ? (
            <div className="mt-1 text-sm text-[var(--ink-muted)]">
              <span suppressHydrationWarning className="contents">
                {typeof item.detail === "string" ? text(item.detail) : item.detail}
              </span>
            </div>
          ) : null}
        </div>
      ))}
    </dl>
  );
}
