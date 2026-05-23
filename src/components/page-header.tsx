"use client";

import type React from "react";
import { localizeNode, useLanguageText } from "@/components/language-pack-provider";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export function PageHeader({
  eyebrow,
  title,
  description,
  badges,
  action,
  className,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  badges?: Array<{ label: React.ReactNode; variant?: "neutral" | "accent" | "success" | "warning" | "danger" }>;
  action?: React.ReactNode;
  className?: string;
}) {
  const text = useLanguageText();

  return (
    <header className={cn("space-y-2 pb-1", className)}>
      {eyebrow ? (
        <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--ink-subtle)]">
          {text(eyebrow)}
        </div>
      ) : null}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-3xl">
          <h1 className="text-[30px] font-semibold tracking-[-0.04em] text-[var(--ink)] sm:text-[36px]">
            {text(title)}
          </h1>
          {description ? <p className="mt-1.5 text-[12px] leading-6 text-[var(--ink-subtle)]">{text(description)}</p> : null}
        </div>
        {badges?.length || action ? (
          <div className="flex flex-wrap items-center gap-2 pt-1">
            {badges?.map((badge, index) => (
              <Badge key={`${badge.label}-${index}`} variant={badge.variant}>
                {localizeNode(badge.label, text)}
              </Badge>
            ))}
            {action}
          </div>
        ) : null}
      </div>
    </header>
  );
}
