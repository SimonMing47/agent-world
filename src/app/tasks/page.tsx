import { getDashboardSnapshot } from "@/server/queries";

export default function TasksPage() {
  const snapshot = getDashboardSnapshot();
  const scheduleByTask = new Map(
    snapshot.scheduleAssessments.map((assessment) => [assessment.taskId, assessment]),
  );

  return (
    <div className="rounded-[28px] border border-[var(--line)] bg-[var(--surface-strong)] p-6">
      <div className="text-[11px] font-medium uppercase tracking-[0.22em] text-[var(--ink-muted)]">
        Task definitions
      </div>
      <div className="mt-4 space-y-3">
        {snapshot.tasks.map((task) => {
          const schedule = scheduleByTask.get(task.id);

          return (
            <div
              key={task.id}
              className="grid gap-4 rounded-[24px] border border-[var(--line)] bg-[var(--surface)] px-4 py-4 md:grid-cols-[1.4fr_0.8fr_0.8fr]"
            >
              <div>
                <div className="text-lg font-semibold text-[var(--ink)]">{task.name}</div>
                <p className="mt-1 text-sm leading-6 text-[var(--ink-muted)]">
                  {task.instruction}
                </p>
              </div>
              <div className="text-sm text-[var(--ink-muted)]">
                <div>Trigger mode: {task.triggerMode}</div>
                <div>Runtime policy: {task.runtimePolicy}</div>
              </div>
              <div className="text-sm text-[var(--ink-muted)]">
                <div>Priority: {task.defaultPriority}</div>
                <div>Next run: {task.nextRunAt ?? "Manual only"}</div>
                <div>Schedule state: {schedule?.state ?? "manual_only"}</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
