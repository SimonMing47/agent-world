"use client";

import * as React from "react";
import { useLanguageText } from "@/components/language-pack-provider";
import { cn } from "@/lib/utils";

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, placeholder, "aria-label": ariaLabel, title, ...props }, ref) => {
    const text = useLanguageText();
    return (
      <input
        ref={ref}
        aria-label={typeof ariaLabel === "string" ? text(ariaLabel) : ariaLabel}
        className={cn(
          "h-11 w-full rounded-xl border border-[rgba(15,23,42,0.06)] bg-[rgba(255,255,255,0.92)] px-4 text-sm text-[var(--ink)] shadow-[0_1px_2px_rgba(15,23,42,0.02)] outline-none transition-colors focus:border-[var(--accent)]/22 focus:ring-2 focus:ring-[var(--accent)]/10 disabled:cursor-not-allowed disabled:bg-[var(--surface-muted)] disabled:opacity-70",
          className,
        )}
        placeholder={typeof placeholder === "string" ? text(placeholder) : placeholder}
        title={typeof title === "string" ? text(title) : title}
        {...props}
      />
    );
  },
);

Input.displayName = "Input";
