"use client";

import { cva, type VariantProps } from "class-variance-authority";
import { localizeNode, useLanguageText } from "@/components/language-pack-provider";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium",
  {
    variants: {
      variant: {
        neutral: "bg-[rgba(15,23,42,0.06)] text-[var(--ink-muted)]",
        accent: "bg-[var(--accent-soft)] text-[var(--accent-strong)]",
        success: "bg-[#edf8f0] text-[#166534]",
        warning: "bg-[#fff4e8] text-[var(--warning)]",
        danger: "bg-[#fff1f3] text-[var(--danger)]",
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
