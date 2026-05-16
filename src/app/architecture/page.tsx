import { getSettingsSnapshot } from "@/server/queries";

const docs = [
  { label: "系统概要设计", path: "docs/system-design.zh-CN.md" },
  { label: "系统详细设计", path: "docs/system-design-detailed.zh-CN.md" },
  { label: "Task Blueprint 规格", path: "docs/specs/task-blueprint-spec.zh-CN.md" },
  { label: "Provider Adapter 规格", path: "docs/specs/provider-adapter-spec.zh-CN.md" },
  { label: "Plugin SDK 规格", path: "docs/specs/plugin-sdk-spec.zh-CN.md" },
  { label: "Agent Team Orchestration 规格", path: "docs/specs/agent-team-orchestration-spec.zh-CN.md" },
  { label: "Memory & Skill 规格", path: "docs/specs/memory-skill-spec.zh-CN.md" },
  { label: "Environment & Secret 规格", path: "docs/specs/environment-secret-spec.zh-CN.md" },
  { label: "Task Event & Observability 规格", path: "docs/specs/task-event-observability-spec.zh-CN.md" },
  { label: "Case Blueprint 规格", path: "docs/specs/case-blueprint-spec.zh-CN.md" },
];

export default function ArchitecturePage() {
  const snapshot = getSettingsSnapshot();

  return (
    <div className="space-y-6">
      <section className="rounded-[28px] border border-[var(--line)] bg-[var(--surface-strong)] p-6">
        <div className="text-[11px] font-medium uppercase tracking-[0.22em] text-[var(--ink-muted)]">
          规格文档
        </div>
        <h1 className="mt-2 text-3xl font-semibold tracking-[-0.04em] text-[var(--ink)]">
          文档用于约束实现，不在界面里复述架构过程。
        </h1>
        <p className="mt-3 text-sm leading-6 text-[var(--ink-muted)]">
          这里保留正式规格和设计文档入口，运营界面只展示配置和运行数据。
        </p>
      </section>

      <section className="grid gap-4 md:grid-cols-4">
        <div className="rounded-[24px] border border-[var(--line)] bg-[var(--surface)] p-5">
          <div className="text-sm text-[var(--ink-muted)]">模型接口</div>
          <div className="mt-2 text-3xl font-semibold text-[var(--ink)]">{snapshot.metrics.providerProfileCount}</div>
        </div>
        <div className="rounded-[24px] border border-[var(--line)] bg-[var(--surface)] p-5">
          <div className="text-sm text-[var(--ink-muted)]">执行引擎</div>
          <div className="mt-2 text-3xl font-semibold text-[var(--ink)]">{snapshot.metrics.runtimeBindingCount}</div>
        </div>
        <div className="rounded-[24px] border border-[var(--line)] bg-[var(--surface)] p-5">
          <div className="text-sm text-[var(--ink-muted)]">任务蓝图</div>
          <div className="mt-2 text-3xl font-semibold text-[var(--ink)]">{snapshot.metrics.blueprintCount}</div>
        </div>
        <div className="rounded-[24px] border border-[var(--line)] bg-[var(--surface)] p-5">
          <div className="text-sm text-[var(--ink-muted)]">环境</div>
          <div className="mt-2 text-3xl font-semibold text-[var(--ink)]">{snapshot.environments.length}</div>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        {docs.map((doc) => (
          <div
            key={doc.path}
            className="rounded-[24px] border border-[var(--line)] bg-[var(--surface)] px-5 py-4"
          >
            <div className="text-base font-semibold text-[var(--ink)]">{doc.label}</div>
            <div className="mt-1 text-sm text-[var(--ink-muted)]">{doc.path}</div>
          </div>
        ))}
      </section>
    </div>
  );
}
