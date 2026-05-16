import { buildExecutionPolicySummary } from "@/server/execution-policy-core";
import { translateExecutionPolicyScope } from "@/lib/presentation";
import { listExecutionPolicies } from "@/server/queries";

export default function ExecutionPolicyPage() {
  const executionPolicies = listExecutionPolicies();

  return (
    <div className="space-y-4">
      {executionPolicies.map((profile) => {
        const executionPolicy = buildExecutionPolicySummary(profile);
        const scope =
          profile.teamId
            ? "AgentTeam"
            : profile.businessTeamId
              ? "BusinessTeam"
              : profile.tenantSpaceId
                ? "TenantSpace"
                : "Global";

        return (
          <section
            key={profile.id}
            className="rounded-[28px] border border-[var(--line)] bg-[var(--surface-strong)] p-6"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-[11px] font-medium uppercase tracking-[0.22em] text-[var(--ink-muted)]">
                  {translateExecutionPolicyScope(scope)}运行约束
                </div>
                <h3 className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-[var(--ink)]">
                  {executionPolicy.name}
                </h3>
              </div>
              <div className="text-[11px] uppercase tracking-[0.18em] text-[var(--ink-muted)]">
                {translateExecutionPolicyScope(scope)}
              </div>
            </div>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-[var(--ink-muted)]">
              {executionPolicy.instruction}
            </p>
            <div className="mt-5 grid gap-4 md:grid-cols-3">
              <div className="rounded-[24px] border border-[var(--line)] bg-[var(--surface)] p-4">
                <div className="text-[11px] font-medium uppercase tracking-[0.22em] text-[var(--ink-muted)]">
                  允许工具
                </div>
                <div className="mt-3 text-sm leading-6 text-[var(--ink)]">
                  {executionPolicy.allowedTools.join(", ")}
                </div>
              </div>
              <div className="rounded-[24px] border border-[var(--line)] bg-[var(--surface)] p-4">
                <div className="text-[11px] font-medium uppercase tracking-[0.22em] text-[var(--ink-muted)]">
                  人工门禁
                </div>
                <div className="mt-3 text-sm leading-6 text-[var(--ink)]">
                  {executionPolicy.approvalRequiredTools.join(", ") || "当前无人工门禁"}
                </div>
              </div>
              <div className="rounded-[24px] border border-[var(--line)] bg-[var(--surface)] p-4">
                <div className="text-[11px] font-medium uppercase tracking-[0.22em] text-[var(--ink-muted)]">
                  预算约束
                </div>
                <div className="mt-3 text-sm leading-6 text-[var(--ink)]">
                  {executionPolicy.budget.maxRuntimeMinutes} 分钟 / {executionPolicy.budget.maxSteps} 步 / {executionPolicy.budget.maxToolCalls} 次工具调用
                </div>
              </div>
            </div>
            <div className="mt-4 rounded-[24px] border border-[var(--line)] bg-[var(--surface)] p-4">
              <div className="text-[11px] font-medium uppercase tracking-[0.22em] text-[var(--ink-muted)]">
                输出策略
              </div>
              <div className="mt-3 grid gap-2 text-sm text-[var(--ink)] md:grid-cols-2">
                <div>默认语言: {executionPolicy.safety.defaultLocale}</div>
                <div>默认折叠思考: {executionPolicy.safety.collapseThinkingByDefault ? "是" : "否"}</div>
                <div>结构化输出: {executionPolicy.safety.structuredOutput ? "是" : "否"}</div>
                <div>Prompt 扫描 / 输出扫描: {executionPolicy.safety.promptScan ? "开" : "关"} / {executionPolicy.safety.outputScan ? "开" : "关"}</div>
              </div>
            </div>
          </section>
        );
      })}
    </div>
  );
}
