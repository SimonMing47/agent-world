const layers = [
  { name: "Provider 执行层", detail: "统一执行网关，默认 opencode SDK，可发现并接入 opencode / claude code / openclaw 等运行时。" },
  { name: "Agent 定义层", detail: "在线定义 Agent 的角色、能力、权限与工具集，支持版本化迭代。" },
  { name: "工具 / Skill 管理层", detail: "工具与 skill 通过插件声明注册，内建邮件、IM 等标准接口能力。" },
  { name: "多 Agent 编排层", detail: "定义 Leader 与协作 Agent 关系、交互提示词和团队目标。" },
  { name: "Agent 团队任务执行层", detail: "提供任务分配、执行面板、任务空间对话，并完整记录 thinking/tool use。" },
  { name: "业务团队管理层", detail: "管理创建者/编辑者/使用者权限和团队/全局/个人可见范围。" },
  { name: "任务执行展示层", detail: "按业务团队与任务类型（一次性/定时/webhook）统一看板展示。" },
  { name: "环境层", detail: "管理代码仓、执行路径、执行人和私钥，预留沙箱执行扩展点。" },
  { name: "记忆层", detail: "基于 OpenViking 进行分层分域记忆管理，并向 Agent/skill 提供访问接口。" },
];

const cases = [
  { name: "神盾计划：MR 代码检视", flow: ["配置 webhook 触发任务模板并绑定检视 Agent 团队", "接收 MR diff 并按团队编排流程执行", "从记忆层读取检视 skill，分层分类生成审查意见", "回写 MR 评论并在任务看板实时展示执行状态"] },
  { name: "每日安全检视", flow: ["配置定时全量代码仓扫描任务", "按环境配置拉取代码仓并执行安全检视链路", "汇总风险结果并固化到任务面板与记忆层", "通过邮件插件发送团队安全日报"] },
];

export default function ArchitecturePage() {
  return (
    <div className="space-y-8">
      <section className="rounded-[28px] border border-[var(--line)] bg-[var(--surface-strong)] p-6">
        <h1 className="text-3xl font-semibold tracking-[-0.04em] text-[var(--ink)]">团队级 Agent 平台九层架构</h1>
      </section>
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {layers.map((layer, index) => (
          <article key={layer.name} className="rounded-[24px] border border-[var(--line)] bg-[var(--surface)] p-5">
            <div className="text-xs font-medium uppercase tracking-[0.18em] text-[var(--ink-muted)]">L{index + 1}</div>
            <h2 className="mt-2 text-lg font-semibold text-[var(--ink)]">{layer.name}</h2>
            <p className="mt-2 text-sm leading-6 text-[var(--ink-muted)]">{layer.detail}</p>
          </article>
        ))}
      </section>
      <section className="grid gap-6 xl:grid-cols-2">
        {cases.map((item) => (
          <div key={item.name} className="rounded-[28px] border border-[var(--line)] bg-[var(--surface-strong)] p-6">
            <h3 className="text-xl font-semibold text-[var(--ink)]">{item.name}</h3>
            <ol className="mt-4 space-y-2 text-sm text-[var(--ink-muted)]">
              {item.flow.map((step) => (
                <li key={step}>• {step}</li>
              ))}
            </ol>
          </div>
        ))}
      </section>
    </div>
  );
}
