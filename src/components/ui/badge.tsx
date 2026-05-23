"use client";

import { cva, type VariantProps } from "class-variance-authority";
import { localizeNode, useLanguageText } from "@/components/language-pack-provider";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-medium tracking-[0.01em]",
  {
    variants: {
      variant: {
        neutral: "bg-[rgba(15,23,42,0.04)] text-[var(--ink-muted)]",
        accent: "bg-[var(--accent-soft)] text-[var(--accent-strong)] shadow-[0_0_0_1px_rgba(9,199,232,0.08)_inset]",
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
  return (
    <span suppressHydrationWarning className={cn(badgeVariants({ variant }), className)}>
      {localizeNode(children, text)}
    </span>
  );
}
