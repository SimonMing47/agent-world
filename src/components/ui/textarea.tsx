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
        "min-h-24 w-full rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3 py-2.5 text-sm leading-6 text-[var(--ink)] outline-none transition-colors focus:border-[var(--accent)]/45 focus:ring-2 focus:ring-[var(--accent)]/12 disabled:cursor-not-allowed disabled:bg-[var(--surface-muted)] disabled:opacity-70",
        className,
      )}
      placeholder={typeof placeholder === "string" ? text(placeholder) : placeholder}
      title={typeof title === "string" ? text(title) : title}
      {...props}
    />
  );
});

Textarea.displayName = "Textarea";
