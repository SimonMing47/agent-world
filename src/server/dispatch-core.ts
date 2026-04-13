import { type HarnessProfile, type RuntimeEndpoint, type TaskDefinition } from "@/server/db";
import { buildHarnessSummary } from "@/server/harness-core";

export type DispatchAssessment = {
  taskName: string;
  priorityScore: number;
  selectedRuntimeName: string;
  selectedRuntimeStatus: string;
  harnessName: string;
  rationale: string[];
};

function scoreRuntime(runtime: RuntimeEndpoint) {
  let score = 0;

  if (runtime.healthStatus === "healthy") score += 40;
  if (runtime.healthStatus === "degraded") score += 12;
  score += Math.max(0, runtime.concurrencyLimit - runtime.activeRunCount) * 8;
  score -= runtime.activeRunCount * 3;

  return score;
}

export function buildDispatchAssessment(args: {
  task: TaskDefinition;
  harness: HarnessProfile;
  runtimes: RuntimeEndpoint[];
}) {
  const sorted = [...args.runtimes]
    .filter((runtime) => runtime.teamSpaceId === args.task.teamSpaceId)
    .sort((left, right) => scoreRuntime(right) - scoreRuntime(left));

  const selected = sorted[0];
  const harness = buildHarnessSummary(args.harness);

  return {
    taskName: args.task.name,
    priorityScore: args.task.defaultPriority + (args.task.triggerMode === "scheduled" ? 12 : 4),
    selectedRuntimeName: selected?.name ?? "No runtime selected",
    selectedRuntimeStatus: selected?.healthStatus ?? "offline",
    harnessName: harness.name,
    rationale: [
      "Tasks are normalized before dispatch.",
      "Runtime selection respects team-space scope first.",
      "Harness compatibility is checked before final runtime choice.",
      "Healthy runtimes with more free slots rank higher.",
    ],
  } satisfies DispatchAssessment;
}
