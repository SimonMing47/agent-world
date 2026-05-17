import { type TaskRun, type ScheduleTemplate } from "@/server/db";
import { uiText } from "@/lib/language-pack";

export type ScheduleAssessment = {
  templateId: string;
  name: string;
  state: "due" | "scheduled" | "event_only" | "paused";
  cadence: string;
  nextRunAt: string | null;
  rationale: string;
};

export type TaskRunPriorityAssessment = {
  taskRunId: string;
  effectivePriority: number;
  rationale: string[];
};

export function assessScheduleTemplate(template: ScheduleTemplate, now = new Date()) {
  if (!template.isEnabled) {
    return {
      templateId: template.id,
      name: template.name,
      state: "paused",
      cadence: template.cadence,
      nextRunAt: template.nextRunAt,
      rationale: uiText("ui.generated.c131a3dec6a"),
    } satisfies ScheduleAssessment;
  }

  if (template.scheduleKind === "event" || !template.nextRunAt) {
    return {
      templateId: template.id,
      name: template.name,
      state: "event_only",
      cadence: template.cadence,
      nextRunAt: template.nextRunAt,
      rationale: uiText("ui.generated.c42e34c7f3c"),
    } satisfies ScheduleAssessment;
  }

  if (new Date(template.nextRunAt).getTime() <= now.getTime()) {
    return {
      templateId: template.id,
      name: template.name,
      state: "due",
      cadence: template.cadence,
      nextRunAt: template.nextRunAt,
      rationale: uiText("ui.generated.c45ec8613bd"),
    } satisfies ScheduleAssessment;
  }

  return {
    templateId: template.id,
    name: template.name,
    state: "scheduled",
    cadence: template.cadence,
    nextRunAt: template.nextRunAt,
    rationale: uiText("ui.generated.c15e331ac1a"),
  } satisfies ScheduleAssessment;
}

export function listScheduleAssessments(templates: ScheduleTemplate[], now = new Date()) {
  return templates.map((template) => assessScheduleTemplate(template, now));
}

export function listDueSchedules(templates: ScheduleTemplate[], now = new Date()) {
  return listScheduleAssessments(templates, now).filter((assessment) => assessment.state === "due");
}

export function buildTaskRunPriorityAssessment(taskRun: TaskRun) {
  const rationale = [
    uiText("ui.server.scheduler.basePriority", undefined, { priority: taskRun.priority }),
    taskRun.sourceType === "access_grant"
      ? uiText("ui.generated.c4c337e9461")
      : uiText("ui.generated.c5c1ff79ec7"),
    taskRun.status === "awaiting"
      ? uiText("ui.generated.c70d330b8f6")
      : uiText("ui.generated.c35232e51a8"),
  ];

  const effectivePriority =
    taskRun.priority +
    (taskRun.sourceType === "access_grant" ? 8 : 3) +
    (taskRun.status === "awaiting" ? 5 : 0);

  return {
    taskRunId: taskRun.id,
    effectivePriority,
    rationale,
  } satisfies TaskRunPriorityAssessment;
}
