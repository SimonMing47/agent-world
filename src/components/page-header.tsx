"use client";

import type React from "react";
import { useLanguageText } from "@/components/language-pack-provider";
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
  badges?: Array<{ label: string; variant?: "neutral" | "accent" | "success" | "warning" | "danger" }>;
  action?: React.ReactNode;
  className?: string;
}) {
  const text = useLanguageText();

  return (
    <header className={cn("space-y-2", className)}>
      {eyebrow ? (
        <div className="text-xs font-medium text-[var(--ink-muted)]">
          {text(eyebrow)}
        </div>
      ) : null}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-3xl">
          <h1 className="text-2xl font-semibold tracking-normal text-[var(--ink)]">
            {text(title)}
          </h1>
          {description ? <p className="mt-2 text-sm leading-6 text-[var(--ink-muted)]">{text(description)}</p> : null}
        </div>
        {badges?.length || action ? (
          <div className="flex flex-wrap items-center gap-2">
            {badges?.map((badge, index) => (
              <Badge key={`${badge.label}-${index}`} variant={badge.variant}>
                {text(badge.label)}
              </Badge>
            ))}
            {action}
          </div>
        ) : null}
      </div>
    </header>
  );
}
