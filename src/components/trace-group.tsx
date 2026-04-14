import { formatDateTime } from "@/lib/utils";
import { localizeDemoCopy, translateFoldGroup } from "@/lib/presentation";
import { type EventLog } from "@/server/db";

export function TraceGroup({
  title,
  events,
}: {
  title: string;
  events: EventLog[];
}) {
  return (
    <details
      open={title === "Human Actions" || title === "人工操作"}
      className="rounded-[24px] border border-[var(--line)] bg-[var(--surface-strong)]"
    >
      <summary className="cursor-pointer list-none px-5 py-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="text-[11px] font-medium uppercase tracking-[0.22em] text-[var(--ink-muted)]">
              {translateFoldGroup(title)}
            </div>
            <div className="mt-1 text-lg font-semibold tracking-[-0.03em] text-[var(--ink)]">
              {events.length} 条事件
            </div>
          </div>
          <div className="text-sm text-[var(--ink-muted)]">展开/收起</div>
        </div>
      </summary>
      <div className="space-y-3 border-t border-[var(--line)] px-5 py-4">
        {events.map((event) => (
          <div
            key={event.id}
            className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] px-4 py-3"
          >
            <div className="flex items-center justify-between gap-4">
              <div className="text-sm font-medium text-[var(--ink)]">
                {localizeDemoCopy(event.title)}
              </div>
              <div className="text-xs uppercase tracking-[0.18em] text-[var(--ink-muted)]">
                {formatDateTime(event.createdAt)}
              </div>
            </div>
            <p className="mt-2 text-sm leading-6 text-[var(--ink-muted)]">
              {localizeDemoCopy(event.content)}
            </p>
          </div>
        ))}
      </div>
    </details>
  );
}
