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
          "h-10 w-full rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3 text-sm text-[var(--ink)] outline-none transition-colors focus:border-[var(--accent)]/45 focus:ring-2 focus:ring-[var(--accent)]/12 disabled:cursor-not-allowed disabled:bg-[var(--surface-muted)] disabled:opacity-70",
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
