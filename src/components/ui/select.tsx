"use client";

import * as React from "react";
import { ChevronDown } from "lucide-react";
import { localizeNode, useLanguageText } from "@/components/language-pack-provider";
import { cn } from "@/lib/utils";

export const Select = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className, children, "aria-label": ariaLabel, title, ...props }, ref) => {
    const text = useLanguageText();
    return (
      <div className="relative">
        <select
          ref={ref}
          aria-label={typeof ariaLabel === "string" ? text(ariaLabel) : ariaLabel}
          className={cn(
            "h-11 w-full appearance-none rounded-xl border border-[rgba(15,23,42,0.06)] bg-[rgba(255,255,255,0.92)] px-4 pr-10 text-sm text-[var(--ink)] shadow-[0_1px_2px_rgba(15,23,42,0.02)] outline-none transition-colors focus:border-[var(--accent)]/22 focus:ring-2 focus:ring-[var(--accent)]/10 disabled:cursor-not-allowed disabled:bg-[var(--surface-muted)] disabled:opacity-70",
            className,
          )}
          title={typeof title === "string" ? text(title) : title}
          {...props}
        >
          {localizeNode(children, text)}
        </select>
        <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--ink-muted)]" />
      </div>
    );
  },
);

Select.displayName = "Select";
