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
  return (
    <div className={cn("space-y-2", className)}>
      <div className="text-xs font-medium text-[var(--ink-muted)]">{label}</div>
      {children}
      {hint ? <div className="text-[11px] leading-5 text-[var(--ink-muted)]">{hint}</div> : null}
    </div>
  );
}
