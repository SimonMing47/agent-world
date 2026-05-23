"use client";

import * as React from "react";
import { useLanguageText } from "@/components/language-pack-provider";
import { cn } from "@/lib/utils";

export const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, placeholder, "aria-label": ariaLabel, title, ...props }, ref) => {
  const text = useLanguageText();
  return (
    <textarea
      ref={ref}
      aria-label={typeof ariaLabel === "string" ? text(ariaLabel) : ariaLabel}
      className={cn(
        "min-h-24 w-full rounded-xl border border-[rgba(15,23,42,0.06)] bg-[rgba(255,255,255,0.92)] px-4 py-3 text-sm leading-7 text-[var(--ink)] shadow-[0_1px_2px_rgba(15,23,42,0.02)] outline-none transition-colors focus:border-[var(--accent)]/22 focus:ring-2 focus:ring-[var(--accent)]/10 disabled:cursor-not-allowed disabled:bg-[var(--surface-muted)] disabled:opacity-70",
        className,
      )}
      placeholder={typeof placeholder === "string" ? text(placeholder) : placeholder}
      title={typeof title === "string" ? text(title) : title}
      {...props}
    />
  );
});

Textarea.displayName = "Textarea";
