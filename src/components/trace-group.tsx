import { formatDateTime } from "@/lib/utils";
import { localizeDemoCopy, translateFoldGroup } from "@/lib/presentation";
import { type EventLog } from "@/server/db";

function parseMetadata(value: string) {
  try {
    const parsed = JSON.parse(value) as Record<string, unknown>;
    return Object.keys(parsed).length > 0 ? parsed : null;
  } catch {
    return null;
  }
}

export function TraceGroup({
  title,
  events,
}: {
  title: string;
  events: EventLog[];
}) {
  return (
    <details
      open
      className="rounded-lg border border-[var(--line)] bg-[var(--surface-strong)]"
    >
      <summary className="cursor-pointer list-none px-5 py-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="text-xs font-medium text-[var(--ink-muted)]">
              {translateFoldGroup(title)}
            </div>
            <div className="mt-1 text-base font-semibold tracking-normal text-[var(--ink)]">
              {events.length} 条事件
            </div>
          </div>
          <div className="text-sm text-[var(--ink-muted)]">展开/收起</div>
        </div>
      </summary>
      <div className="space-y-3 border-t border-[var(--line)] px-5 py-4">
        {events.map((event) => {
          const metadata = parseMetadata(event.metadataJson);

          return (
            <div
              key={event.id}
              className="rounded-lg border border-[var(--line)] bg-[var(--surface)] px-4 py-3"
            >
              <div className="flex items-center justify-between gap-4">
                <div className="text-sm font-medium text-[var(--ink)]">
                  {localizeDemoCopy(event.title)}
                </div>
                <div className="text-xs text-[var(--ink-muted)]">
                  {event.phase} · {formatDateTime(event.createdAt)}
                </div>
              </div>
              <p className="mt-2 text-sm leading-6 text-[var(--ink-muted)]">
                {localizeDemoCopy(event.content)}
              </p>
              {metadata ? (
                <pre className="mt-3 overflow-x-auto rounded-lg bg-[var(--surface-strong)] p-3 text-xs leading-5 text-[var(--ink-muted)]">
                  {JSON.stringify(metadata, null, 2)}
                </pre>
              ) : null}
            </div>
          );
        })}
      </div>
    </details>
  );
}
