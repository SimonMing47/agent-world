import { buildExecutionPolicySummary } from "@/server/execution-policy-core";
import {
  type Agent,
  type AgentTeam,
  type AccessGrant,
  type ExecutionPolicy,
  type BusinessTeam,
  type ProviderProfile,
  type RuntimeEndpoint,
  type TenantSpace,
} from "@/server/db";

export type InvocationStage = {
  key: string;
  label: string;
  owner: string;
  description: string;
};

export function buildInvocationPlan(args: {
  tenantSpace: TenantSpace;
  businessTeam: BusinessTeam;
  team: AgentTeam;
  agent: Agent;
  executionPolicy: ExecutionPolicy;
  runtime: RuntimeEndpoint | null;
  provider: ProviderProfile | null;
  accessGrant: AccessGrant | null;
}) {
  const executionPolicy = buildExecutionPolicySummary(args.executionPolicy);
  const runtimeName = args.runtime?.name ?? "未选择执行配置";
  const providerName = args.provider?.name ?? "未选择模型服务";

  const stages: InvocationStage[] = [
    {
      key: "envelope",
      label: "组装调用上下文",
      owner: "invocation-core",
      description: "在请求首个 token 之前，先把租户空间、业务团队、Agent 团队、Agent 和任务上下文拼装完整。",
    },
    {
      key: "executionPolicy",
      label: "解析运行约束",
      owner: "execution-policy-core",
      description: `把 ${executionPolicy.name} 与 Agent 团队、租户策略合并，让工具、预算、输出规则都变成显式约束。`,
    },
    {
      key: "accessGrant",
      label: "校验跨团队授权范围",
      owner: "access-grant-core",
      description: args.accessGrant
        ? "在开始外部服务动作之前，先应用生效中的跨团队授权范围和定价限制。"
        : `这次调用留在 ${args.businessTeam.name} 内部，因此不需要做跨业务团队的范围扩展。`,
    },
    {
      key: "provider",
      label: "选择模型服务",
      owner: "model-service-core",
      description: `在不突破 ${args.tenantSpace.name} 模型白名单的前提下，把调用路由到 ${providerName}。`,
    },
    {
      key: "runtime",
      label: "挂载执行配置",
      owner: "execution-core",
      description: `优先使用 ${runtimeName}，并在节点真正开工前把执行健康状态显式展示出来。`,
    },
    {
      key: "trace",
      label: "流式记录 Trace 与工具事件",
      owner: "trace-core",
      description: `把 ${args.agent.name} 的推理摘要、工具动作、人工批准和文本输出写成可回放的事件分组。`,
    },
  ];

  if (executionPolicy.approvalRequiredTools.length > 0) {
    stages.push({
      key: "gate",
      label: "人工门禁暂停",
      owner: "human-gate",
      description: `在 ${executionPolicy.approvalRequiredTools.join(", ")} 这类受保护动作之前暂停，并等待显式批准。`,
    });
  }

  stages.push({
    key: "finalize",
    label: "完成节点收尾",
    owner: "executor-core",
    description: "校验输出、记录成本，并把任务节点推进到下一个稳定状态。",
  });

  return stages;
}
