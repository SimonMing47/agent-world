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
        "min-h-24 w-full rounded-lg border border-[var(--line)] bg-white px-3 py-2.5 text-sm leading-6 text-[var(--ink)] shadow-sm outline-none transition focus:border-[var(--accent)]/35 focus:ring-2 focus:ring-[var(--accent)]/15 disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      placeholder={typeof placeholder === "string" ? text(placeholder) : placeholder}
      title={typeof title === "string" ? text(title) : title}
      {...props}
    />
  );
});

Textarea.displayName = "Textarea";
