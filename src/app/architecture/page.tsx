import { getArchitectureCases, getArchitectureLayers } from "@/server/architecture-core";

const triggerLabel: Record<string, string> = {
  webhook: "Webhook 触发",
  scheduled: "定时触发",
  manual: "手工触发",
};

export default function ArchitecturePage() {
  const layers = getArchitectureLayers();
  const cases = getArchitectureCases();

  return (
    <div className="space-y-8">
      <section className="rounded-[28px] border border-[var(--line)] bg-[var(--surface-strong)] p-6">
        <div className="text-[11px] font-medium uppercase tracking-[0.22em] text-[var(--ink-muted)]">
          Blueprint
        </div>
        <h1 className="mt-2 text-3xl font-semibold tracking-[-0.04em] text-[var(--ink)]">
          AgentWorld 全量设计与实现对照
        </h1>
        <p className="mt-3 text-sm leading-6 text-[var(--ink-muted)]">
          该页面按九层模型逐层对照“目标—实现—扩展点”，确保概要设计、详细设计与当前实现链路一致，不遗漏关键治理与执行闭环。
        </p>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        {layers.map((layer, index) => (
          <article key={layer.id} className="rounded-[24px] border border-[var(--line)] bg-[var(--surface)] p-5">
            <div className="text-xs font-medium uppercase tracking-[0.18em] text-[var(--ink-muted)]">L{index + 1}</div>
            <h2 className="mt-2 text-lg font-semibold text-[var(--ink)]">{layer.name}</h2>
            <p className="mt-1 text-sm leading-6 text-[var(--ink-muted)]">{layer.objective}</p>
            <div className="mt-4 space-y-3 text-sm">
              <div>
                <div className="font-semibold text-[var(--ink)]">能力</div>
                <ul className="mt-1 list-disc space-y-1 pl-5 text-[var(--ink-muted)]">
                  {layer.capabilities.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
              <div>
                <div className="font-semibold text-[var(--ink)]">后端映射</div>
                <ul className="mt-1 list-disc space-y-1 pl-5 text-[var(--ink-muted)]">
                  {layer.backend.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
              <div>
                <div className="font-semibold text-[var(--ink)]">前端映射</div>
                <ul className="mt-1 list-disc space-y-1 pl-5 text-[var(--ink-muted)]">
                  {layer.frontend.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
              <div>
                <div className="font-semibold text-[var(--ink)]">API 边界</div>
                <ul className="mt-1 list-disc space-y-1 pl-5 text-[var(--ink-muted)]">
                  {layer.apiSurfaces.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
              <div>
                <div className="font-semibold text-[var(--ink)]">扩展点</div>
                <ul className="mt-1 list-disc space-y-1 pl-5 text-[var(--ink-muted)]">
                  {layer.extensibility.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
              <div>
                <div className="font-semibold text-[var(--ink)]">设计校验</div>
                <ul className="mt-1 list-disc space-y-1 pl-5 text-[var(--ink-muted)]">
                  {layer.designCheckpoints.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            </div>
          </article>
        ))}
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-[-0.03em] text-[var(--ink)]">关键案例落地</h2>
        <div className="grid gap-4 xl:grid-cols-2">
          {cases.map((item) => (
            <article key={item.id} className="rounded-[24px] border border-[var(--line)] bg-[var(--surface)] p-5">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-lg font-semibold text-[var(--ink)]">{item.name}</h3>
                <span className="text-xs font-medium uppercase tracking-[0.18em] text-[var(--ink-muted)]">
                  {triggerLabel[item.trigger]}
                </span>
              </div>
              <ol className="mt-3 list-decimal space-y-1 pl-5 text-sm leading-6 text-[var(--ink-muted)]">
                {item.steps.map((step) => (
                  <li key={step}>{step}</li>
                ))}
              </ol>
              <div className="mt-3 text-sm leading-6 text-[var(--ink-muted)]">
                <div>配置: {item.configuration.join(" · ")}</div>
                <div>插件: {item.plugins.join(" · ")}</div>
                <div>记忆层: {item.memoryLayers.join(" · ")}</div>
              </div>
              <div className="mt-3">
                <div className="text-sm font-semibold text-[var(--ink)]">产出</div>
                <div className="mt-1 text-sm text-[var(--ink-muted)]">{item.output.join(" · ")}</div>
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
