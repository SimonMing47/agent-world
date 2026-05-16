import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Panel, PanelBody, PanelHeader } from "@/components/ui/panel";
import { buildExecutionPolicySummary } from "@/server/execution-policy-core";
import { translateExecutionPolicyScope } from "@/lib/presentation";
import { listExecutionPolicies } from "@/server/queries";

export default function ExecutionPolicyPage() {
  const executionPolicies = listExecutionPolicies();

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Execution Policies"
        title="运行约束"
        description="统一查看工具许可、人工门禁、预算和输出安全策略。"
        badges={[
          { label: `${executionPolicies.length} 条运行约束`, variant: "accent" },
        ]}
      />

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
          <Panel key={profile.id}>
            <PanelHeader
              eyebrow={`${translateExecutionPolicyScope(scope)}运行约束`}
              title={executionPolicy.name}
              description={executionPolicy.instruction}
              action={<Badge variant="neutral">{translateExecutionPolicyScope(scope)}</Badge>}
            />
            <PanelBody className="space-y-3 text-sm text-[var(--ink-muted)]">
              <div>允许工具: <span className="font-medium text-[var(--ink)]">{executionPolicy.allowedTools.join(", ")}</span></div>
              <div>人工门禁: <span className="font-medium text-[var(--ink)]">{executionPolicy.approvalRequiredTools.join(", ") || "当前无人工门禁"}</span></div>
              <div>预算约束: <span className="font-medium text-[var(--ink)]">{executionPolicy.budget.maxRuntimeMinutes} 分钟 / {executionPolicy.budget.maxSteps} 步 / {executionPolicy.budget.maxToolCalls} 次工具调用</span></div>
              <div>默认语言: <span className="font-medium text-[var(--ink)]">{executionPolicy.safety.defaultLocale}</span></div>
              <div>默认折叠思考: <span className="font-medium text-[var(--ink)]">{executionPolicy.safety.collapseThinkingByDefault ? "是" : "否"}</span></div>
              <div>结构化输出: <span className="font-medium text-[var(--ink)]">{executionPolicy.safety.structuredOutput ? "是" : "否"}</span></div>
              <div>Prompt 扫描 / 输出扫描: <span className="font-medium text-[var(--ink)]">{executionPolicy.safety.promptScan ? "开" : "关"} / {executionPolicy.safety.outputScan ? "开" : "关"}</span></div>
            </PanelBody>
          </Panel>
        );
      })}
    </div>
  );
}
