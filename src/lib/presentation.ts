import { uiText } from "@/lib/language-pack";

function translate(group: string, value: string) {
  return uiText(`labels.${group}.${value}`, value);
}

export function translateStatus(value: string) {
  return translate("status", value);
}

export function translateVisibility(value: string) {
  return translate("visibility", value);
}

export function translateWorkflowType(value: string) {
  return translate("workflow", value);
}

export function translateRecruitmentMode(value: string) {
  return translate("recruitmentMode", value);
}

export function translateScheduleState(value: string) {
  return translate("scheduleState", value);
}

export function translateExecutionPolicyScope(value: string) {
  return translate("executionPolicyScope", value);
}

export function translateSourceType(value: string) {
  return translate("sourceType", value);
}

export function translateRuntimeKind(value: string) {
  return translate("runtimeKind", value);
}

export function translateSessionMode(value: string) {
  return translate("sessionMode", value);
}

export function translateHumanIntervention(value: string) {
  return translate("humanIntervention", value);
}

export function translateSeverity(value: string) {
  return translate("severity", value);
}

export function translateFoldGroup(value: string) {
  return translate("foldGroup", value);
}

export function translateBoolean(value: boolean | number) {
  return uiText(value ? "ui.common.boolean.yes" : "ui.common.boolean.no");
}

export function localizeDemoCopy(value: string) {
  return uiText(`demo.${value}`, value);
}
