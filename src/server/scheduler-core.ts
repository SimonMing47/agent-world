import { type TaskDefinition } from "@/server/db";

export type ScheduleAssessment = {
  taskId: string;
  taskName: string;
  state: "manual_only" | "scheduled" | "due";
  nextRunAt: string | null;
  rationale: string;
};

export function assessTaskSchedule(task: TaskDefinition, now = new Date()) {
  if (task.triggerMode !== "scheduled" || !task.nextRunAt) {
    return {
      taskId: task.id,
      taskName: task.name,
      state: "manual_only",
      nextRunAt: task.nextRunAt,
      rationale: "This task only runs from a person or an external trigger.",
    } satisfies ScheduleAssessment;
  }

  const nextRunAt = new Date(task.nextRunAt);

  if (nextRunAt.getTime() <= now.getTime()) {
    return {
      taskId: task.id,
      taskName: task.name,
      state: "due",
      nextRunAt: task.nextRunAt,
      rationale: "The next schedule window has arrived and can be dispatched now.",
    } satisfies ScheduleAssessment;
  }

  return {
    taskId: task.id,
    taskName: task.name,
    state: "scheduled",
    nextRunAt: task.nextRunAt,
    rationale: "The task is scheduled, but its next dispatch window is still in the future.",
  } satisfies ScheduleAssessment;
}

export function listScheduleAssessments(tasks: TaskDefinition[], now = new Date()) {
  return tasks.map((task) => assessTaskSchedule(task, now));
}

export function listDispatchableTasks(tasks: TaskDefinition[], now = new Date()) {
  return listScheduleAssessments(tasks, now)
    .filter((assessment) => assessment.state === "due")
    .sort((left, right) => left.taskName.localeCompare(right.taskName));
}
