import { cn } from "@/lib/utils";

export function DataTable({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      aria-label="数据表格"
      className="max-w-full overflow-x-auto overscroll-x-contain focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/20"
      role="region"
      tabIndex={0}
    >
      <table className={cn("min-w-full border-separate border-spacing-0", className)}>
        {children}
      </table>
    </div>
  );
}

export function DataTableHeader({
  children,
}: {
  children: React.ReactNode;
}) {
  return <thead className="sticky top-0 z-10 bg-[var(--surface-muted)]">{children}</thead>;
}

export function DataTableBody({
  children,
}: {
  children: React.ReactNode;
}) {
  return <tbody>{children}</tbody>;
}

export function DataTableRow({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <tr className={cn("transition hover:bg-[var(--surface-muted)]/70 focus-within:bg-[var(--surface-muted)]/70", className)}>
      {children}
    </tr>
  );
}

export function DataTableHead({
  align = "left",
  className,
  children,
}: {
  align?: "left" | "right" | "center";
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <th
      className={cn(
        "border-b border-[var(--line)] px-4 py-3 text-xs font-semibold text-[var(--ink-muted)]",
        align === "right" ? "text-right" : align === "center" ? "text-center" : "text-left",
        className,
      )}
    >
      {children}
    </th>
  );
}

export function DataTableCell({
  align = "left",
  className,
  children,
}: {
  align?: "left" | "right" | "center";
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <td
      className={cn(
        "border-b border-[var(--line)] px-4 py-3 align-top text-sm text-[var(--ink-muted)]",
        align === "right" ? "text-right" : align === "center" ? "text-center" : "text-left",
        className,
      )}
    >
      {children}
    </td>
  );
}
