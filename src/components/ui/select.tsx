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
            "h-10 w-full appearance-none rounded-lg border border-[var(--line)] bg-white px-3 pr-10 text-sm text-[var(--ink)] shadow-sm outline-none transition focus:border-[var(--accent)]/35 focus:ring-2 focus:ring-[var(--accent)]/15 disabled:cursor-not-allowed disabled:opacity-50",
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
