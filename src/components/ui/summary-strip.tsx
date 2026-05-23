"use client";

import { localizeNode, useLanguageText } from "@/components/language-pack-provider";
import { cn } from "@/lib/utils";

export function SummaryStrip({
  items,
  className,
  gridClassName = "sm:grid-cols-2 xl:grid-cols-4",
}: {
  items: Array<{ label: React.ReactNode; value: React.ReactNode; detail?: React.ReactNode; tone?: "default" | "accent" }>;
  className?: string;
  gridClassName?: string;
}) {
  const text = useLanguageText();

  return (
    <section className={cn("overflow-hidden", className)}>
      <div className={cn("grid", gridClassName)}>
        {items.map((item, index) => (
          <div
            key={index}
            className={cn(
              "px-2 py-2 sm:px-4",
              index !== items.length - 1 && "border-b border-[var(--line)]/70 sm:border-b-0 xl:border-r xl:border-[var(--line)]/70",
            )}
            >
              <div className="aw-hero-metric">
              <div suppressHydrationWarning className="aw-hero-metric__label">
                {localizeNode(item.label, text)}
              </div>
              <div suppressHydrationWarning className="aw-hero-metric__value" data-tone={item.tone === "accent" ? "accent" : "default"}>
                {item.value}
              </div>
              {item.detail ? (
                <div suppressHydrationWarning className="aw-hero-metric__detail">
                  {localizeNode(item.detail, text)}
                </div>
              ) : null}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
