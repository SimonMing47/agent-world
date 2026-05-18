"use client";

import { useLanguageText } from "@/components/language-pack-provider";
import { cn } from "@/lib/utils";

export function FieldGroup({
  label,
  hint,
  className,
  children,
}: {
  label: string;
  hint?: string;
  className?: string;
  children: React.ReactNode;
}) {
  const text = useLanguageText();

  return (
    <div className={cn("space-y-2", className)}>
      <div className="text-xs font-medium text-[var(--ink-subtle)]">{text(label)}</div>
      {children}
      {hint ? <div className="text-[11px] leading-5 text-[var(--ink-muted)]">{text(hint)}</div> : null}
    </div>
  );
}
