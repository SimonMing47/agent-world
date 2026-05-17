import type React from "react";
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
  return (
    <header className={cn("space-y-3", className)}>
      {eyebrow ? (
        <div className="text-[11px] font-medium uppercase tracking-[0.18em] text-[var(--ink-muted)]">
          {eyebrow}
        </div>
      ) : null}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-3xl">
          <h1 className="text-2xl font-semibold tracking-[-0.03em] text-[var(--ink)] sm:text-3xl">
            {title}
          </h1>
          {description ? <p className="mt-2 text-sm leading-6 text-[var(--ink-muted)]">{description}</p> : null}
        </div>
        {badges?.length || action ? (
          <div className="flex flex-wrap items-center gap-2">
            {badges?.map((badge, index) => (
              <Badge key={`${badge.label}-${index}`} variant={badge.variant}>
                {badge.label}
              </Badge>
            ))}
            {action}
          </div>
        ) : null}
      </div>
    </header>
  );
}
