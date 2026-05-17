"use client";

import { cva, type VariantProps } from "class-variance-authority";
import { localizeNode, useLanguageText } from "@/components/language-pack-provider";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center whitespace-nowrap rounded-full border px-2.5 py-1 text-xs font-medium",
  {
    variants: {
      variant: {
        neutral: "border-[var(--line)] bg-[var(--surface)] text-[var(--ink-muted)]",
        accent: "border-[#cfe4ff] bg-[var(--accent-soft)] text-[var(--accent-strong)]",
        success: "border-[#cdebd7] bg-[#f0faf4] text-[#146c2e]",
        warning: "border-[#ffe0b3] bg-[#fff7ed] text-[var(--warning)]",
        danger: "border-[#ffc9d0] bg-[#fff1f3] text-[var(--danger)]",
      },
    },
    defaultVariants: {
      variant: "neutral",
    },
  },
);

export function Badge({
  className,
  variant,
  children,
}: React.HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badgeVariants>) {
  const text = useLanguageText();
  return <span className={cn(badgeVariants({ variant }), className)}>{localizeNode(children, text)}</span>;
}
