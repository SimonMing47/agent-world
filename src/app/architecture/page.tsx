import { PageHeader } from "@/components/page-header";
import { Panel, PanelBody, PanelHeader } from "@/components/ui/panel";
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
      <PageHeader
        eyebrow="Architecture"
        title="设计规格入口"
        description="设计文档保留在这里作为实现约束，控制台页面本身只承载配置对象和运行对象。"
        badges={[
          { label: `${docs.length} 份核心规格`, variant: "accent" },
          { label: `${snapshot.metrics.blueprintCount} 个任务蓝图`, variant: "neutral" },
        ]}
      />

      <section className="grid gap-4 md:grid-cols-4">
        {[
          ["模型接口", snapshot.metrics.providerProfileCount],
          ["执行引擎", snapshot.metrics.runtimeBindingCount],
          ["任务蓝图", snapshot.metrics.blueprintCount],
          ["环境", snapshot.environments.length],
        ].map(([label, value]) => (
          <Panel key={String(label)}>
            <PanelBody className="p-5">
              <div className="text-sm text-[var(--ink-muted)]">{label}</div>
              <div className="mt-2 text-3xl font-semibold text-[var(--ink)]">{value}</div>
            </PanelBody>
          </Panel>
        ))}
      </section>

      <Panel>
        <PanelHeader
          eyebrow="Specs"
          title="核心规格文档"
          description="只保留约束实现所需的正式设计文档，不在界面里重复铺陈过程态描述。"
        />
        <PanelBody className="grid gap-3 xl:grid-cols-2">
          {docs.map((doc) => (
            <div
              key={doc.path}
              className="rounded-xl border border-[var(--line)] bg-[var(--surface-muted)] px-4 py-4"
            >
              <div className="text-base font-semibold text-[var(--ink)]">{doc.label}</div>
              <div className="mt-1 text-sm text-[var(--ink-muted)]">{doc.path}</div>
            </div>
          ))}
        </PanelBody>
      </Panel>
    </div>
  );
}
