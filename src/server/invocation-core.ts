import { buildHarnessSummary } from "@/server/harness-core";
import {
  type Agent,
  type AgentTeam,
  type Contract,
  type HarnessProfile,
  type Kingdom,
  type ProviderProfile,
  type RuntimeEndpoint,
  type World,
} from "@/server/db";

export type InvocationStage = {
  key: string;
  label: string;
  owner: string;
  description: string;
};

export function buildInvocationPlan(args: {
  world: World;
  kingdom: Kingdom;
  team: AgentTeam;
  agent: Agent;
  harness: HarnessProfile;
  runtime: RuntimeEndpoint | null;
  provider: ProviderProfile | null;
  contract: Contract | null;
}) {
  const harness = buildHarnessSummary(args.harness);
  const runtimeName = args.runtime?.name ?? "未选择 runtime";
  const providerName = args.provider?.name ?? "未选择 Provider";

  const stages: InvocationStage[] = [
    {
      key: "envelope",
      label: "组装调用上下文",
      owner: "invocation-core",
      description: "在请求首个 token 之前，先把 world、kingdom、team、agent 和 quest 上下文拼装完整。",
    },
    {
      key: "harness",
      label: "解析 Harness 约束",
      owner: "harness-core",
      description: `把 ${harness.name} 与 team、world 策略合并，让工具、预算、输出规则都变成显式约束。`,
    },
    {
      key: "contract",
      label: "校验 Contract 范围",
      owner: "contract-core",
      description: args.contract
        ? "在开始外部服务动作之前，先应用生效中的 Contract 范围和定价限制。"
        : `这次调用留在 ${args.kingdom.name} 内部，因此不需要做跨 Kingdom 的范围扩展。`,
    },
    {
      key: "provider",
      label: "选择模型 Provider",
      owner: "provider-core",
      description: `在不突破 ${args.world.name} 模型白名单的前提下，把调用路由到 ${providerName}。`,
    },
    {
      key: "runtime",
      label: "挂载执行 runtime",
      owner: "runtime-core",
      description: `优先使用 ${runtimeName}，并在节点真正开工前把 runtime 健康状态显式展示出来。`,
    },
    {
      key: "trace",
      label: "流式记录 Trace 与工具事件",
      owner: "trace-core",
      description: `把 ${args.agent.name} 的思考、工具动作、人工批准和文本输出写成可回放的事件分组。`,
    },
  ];

  if (harness.approvalRequiredTools.length > 0) {
    stages.push({
      key: "gate",
      label: "人工门禁暂停",
      owner: "human-gate",
      description: `在 ${harness.approvalRequiredTools.join(", ")} 这类受保护动作之前暂停，并等待显式批准。`,
    });
  }

  stages.push({
    key: "finalize",
    label: "完成节点收尾",
    owner: "executor-core",
    description: "校验输出、记录成本，并把 Quest 节点推进到下一个稳定状态。",
  });

  return stages;
}
