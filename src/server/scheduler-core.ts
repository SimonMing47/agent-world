import { type Quest, type ScheduleTemplate } from "@/server/db";

export type ScheduleAssessment = {
  templateId: string;
  name: string;
  state: "due" | "scheduled" | "event_only" | "paused";
  cadence: string;
  nextRunAt: string | null;
  rationale: string;
};

export type QuestPriorityAssessment = {
  questId: string;
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
      rationale: "This schedule template is disabled and will not produce a Quest.",
    } satisfies ScheduleAssessment;
  }

  if (template.scheduleKind === "event" || !template.nextRunAt) {
    return {
      templateId: template.id,
      name: template.name,
      state: "event_only",
      cadence: template.cadence,
      nextRunAt: template.nextRunAt,
      rationale: "This entry is only triggered by incoming events such as a webhook.",
    } satisfies ScheduleAssessment;
  }

  if (new Date(template.nextRunAt).getTime() <= now.getTime()) {
    return {
      templateId: template.id,
      name: template.name,
      state: "due",
      cadence: template.cadence,
      nextRunAt: template.nextRunAt,
      rationale: "The next run window is already open and the scheduler can claim it now.",
    } satisfies ScheduleAssessment;
  }

  return {
    templateId: template.id,
    name: template.name,
    state: "scheduled",
    cadence: template.cadence,
    nextRunAt: template.nextRunAt,
    rationale: "The schedule is valid, but its next run window is still in the future.",
  } satisfies ScheduleAssessment;
}

export function listScheduleAssessments(templates: ScheduleTemplate[], now = new Date()) {
  return templates.map((template) => assessScheduleTemplate(template, now));
}

export function listDueSchedules(templates: ScheduleTemplate[], now = new Date()) {
  return listScheduleAssessments(templates, now).filter((assessment) => assessment.state === "due");
}

export function buildQuestPriorityAssessment(quest: Quest) {
  const rationale = [
    `Base priority starts at ${quest.priority}.`,
    quest.sourceType === "contract"
      ? "Cross-kingdom contract work gets an SLA bias."
      : "Local work keeps its base scheduling weight.",
    quest.status === "awaiting"
      ? "Awaiting human input keeps a small urgency boost after approval."
      : "No intervention carry-over boost is applied yet.",
  ];

  const effectivePriority =
    quest.priority +
    (quest.sourceType === "contract" ? 8 : 3) +
    (quest.status === "awaiting" ? 5 : 0);

  return {
    questId: quest.id,
    effectivePriority,
    rationale,
  } satisfies QuestPriorityAssessment;
}
