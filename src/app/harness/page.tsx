import { buildHarnessSummary } from "@/server/harness-core";
import { translateHarnessScope } from "@/lib/presentation";
import { listHarnessProfiles } from "@/server/queries";

export default function HarnessPage() {
  const harnesses = listHarnessProfiles();

  return (
    <div className="space-y-4">
      {harnesses.map((profile) => {
        const harness = buildHarnessSummary(profile);
        const scope =
          profile.teamId
            ? "AgentTeam"
            : profile.kingdomId
              ? "Kingdom"
              : profile.worldId
                ? "World"
                : "Global";

        return (
          <section
            key={profile.id}
            className="rounded-[28px] border border-[var(--line)] bg-[var(--surface-strong)] p-6"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-[11px] font-medium uppercase tracking-[0.22em] text-[var(--ink-muted)]">
                  {translateHarnessScope(scope)} Harness
                </div>
                <h3 className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-[var(--ink)]">
                  {harness.name}
                </h3>
              </div>
              <div className="text-[11px] uppercase tracking-[0.18em] text-[var(--ink-muted)]">
                {translateHarnessScope(scope)}
              </div>
            </div>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-[var(--ink-muted)]">
              {harness.instruction}
            </p>
            <div className="mt-5 grid gap-4 md:grid-cols-3">
              <div className="rounded-[24px] border border-[var(--line)] bg-[var(--surface)] p-4">
                <div className="text-[11px] font-medium uppercase tracking-[0.22em] text-[var(--ink-muted)]">
                  允许工具
                </div>
                <div className="mt-3 text-sm leading-6 text-[var(--ink)]">
                  {harness.allowedTools.join(", ")}
                </div>
              </div>
              <div className="rounded-[24px] border border-[var(--line)] bg-[var(--surface)] p-4">
                <div className="text-[11px] font-medium uppercase tracking-[0.22em] text-[var(--ink-muted)]">
                  人工门禁
                </div>
                <div className="mt-3 text-sm leading-6 text-[var(--ink)]">
                  {harness.approvalRequiredTools.join(", ") || "当前无人工门禁"}
                </div>
              </div>
              <div className="rounded-[24px] border border-[var(--line)] bg-[var(--surface)] p-4">
                <div className="text-[11px] font-medium uppercase tracking-[0.22em] text-[var(--ink-muted)]">
                  预算约束
                </div>
                <div className="mt-3 text-sm leading-6 text-[var(--ink)]">
                  {harness.budget.maxRuntimeMinutes} 分钟 / {harness.budget.maxSteps} 步 / {harness.budget.maxToolCalls} 次工具调用
                </div>
              </div>
            </div>
            <div className="mt-4 rounded-[24px] border border-[var(--line)] bg-[var(--surface)] p-4">
              <div className="text-[11px] font-medium uppercase tracking-[0.22em] text-[var(--ink-muted)]">
                输出策略
              </div>
              <div className="mt-3 grid gap-2 text-sm text-[var(--ink)] md:grid-cols-2">
                <div>默认语言: {harness.safety.defaultLocale}</div>
                <div>默认折叠思考: {harness.safety.collapseThinkingByDefault ? "是" : "否"}</div>
                <div>结构化输出: {harness.safety.structuredOutput ? "是" : "否"}</div>
                <div>Prompt 扫描 / 输出扫描: {harness.safety.promptScan ? "开" : "关"} / {harness.safety.outputScan ? "开" : "关"}</div>
              </div>
            </div>
          </section>
        );
      })}
    </div>
  );
}
