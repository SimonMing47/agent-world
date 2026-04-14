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
      rationale: "这个定时模板已经停用，不会再生成新的 Quest。",
    } satisfies ScheduleAssessment;
  }

  if (template.scheduleKind === "event" || !template.nextRunAt) {
    return {
      templateId: template.id,
      name: template.name,
      state: "event_only",
      cadence: template.cadence,
      nextRunAt: template.nextRunAt,
      rationale: "这个入口只会由 webhook 这类外部事件触发。",
    } satisfies ScheduleAssessment;
  }

  if (new Date(template.nextRunAt).getTime() <= now.getTime()) {
    return {
      templateId: template.id,
      name: template.name,
      state: "due",
      cadence: template.cadence,
      nextRunAt: template.nextRunAt,
      rationale: "下一次执行窗口已经打开，调度器现在就可以认领它。",
    } satisfies ScheduleAssessment;
  }

  return {
    templateId: template.id,
    name: template.name,
    state: "scheduled",
    cadence: template.cadence,
    nextRunAt: template.nextRunAt,
    rationale: "这个定时任务是有效的，只是下一次执行时间还没到。",
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
    `基础优先级从 ${quest.priority} 开始。`,
    quest.sourceType === "contract"
      ? "跨 Kingdom 的 Contract 任务会获得 SLA 倾斜。"
      : "本地任务保持基础调度权重。",
    quest.status === "awaiting"
      ? "等待人工中的任务在恢复后会保留一小段紧急度加成。"
      : "当前没有叠加人工干预带来的额外加成。",
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
