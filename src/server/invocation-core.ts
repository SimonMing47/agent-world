import { buildHarnessSummary } from "@/server/harness-core";
import { type HarnessProfile, type RuntimeEndpoint, type TaskDefinition } from "@/server/db";

export type InvocationStage = {
  key: string;
  label: string;
  owner: string;
  description: string;
};

export function buildInvocationPlan(args: {
  task: TaskDefinition;
  harness: HarnessProfile;
  runtime: RuntimeEndpoint | null;
}) {
  const harness = buildHarnessSummary(args.harness);
  const runtimeName = args.runtime?.name ?? "No runtime selected";

  const stages: InvocationStage[] = [
    {
      key: "prepare",
      label: "Prepare task envelope",
      owner: "invocation-core",
      description: `Load the task instruction, input schema, and runtime policy for ${args.task.name}.`,
    },
    {
      key: "constrain",
      label: "Resolve harness constraints",
      owner: "harness-core",
      description: `Apply ${harness.name} before the first model turn so tools, budgets, and output behavior are explicit.`,
    },
    {
      key: "connect",
      label: "Connect runtime and provider",
      owner: "runtime-adapter",
      description: `Send the invocation to ${runtimeName} and keep the OpenCode runtime catalog in view.`,
    },
    {
      key: "stream",
      label: "Stream trace events",
      owner: "event-log",
      description: "Write thinking, tool activity, approvals, and text output as foldable event groups.",
    },
  ];

  if (harness.approvalRequiredTools.length > 0) {
    stages.push({
      key: "approve",
      label: "Pause for human approval",
      owner: "human-gate",
      description: `Stop before protected actions such as ${harness.approvalRequiredTools.join(", ")}.`,
    });
  }

  stages.push({
    key: "finalize",
    label: "Finalize result",
    owner: "invocation-core",
    description: "Close the run with a result state, artifact links, and a replayable audit trail.",
  });

  return stages;
}
