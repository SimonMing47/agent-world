import { type EventLog } from "@/server/db";

export function groupEventsByFoldGroup(events: EventLog[]) {
  return events.reduce<Record<string, EventLog[]>>((groups, event) => {
    groups[event.foldGroup] ??= [];
    groups[event.foldGroup].push(event);
    return groups;
  }, {});
}
