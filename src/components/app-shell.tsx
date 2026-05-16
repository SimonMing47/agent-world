import { SidebarNav } from "@/components/sidebar-nav";
import { term } from "@/lib/terminology";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen">
      <div className="mx-auto flex min-h-screen max-w-[1600px] gap-6 px-4 py-4 sm:px-6 lg:px-8">
        <aside className="hidden w-[280px] shrink-0 rounded-[32px] border border-[var(--line)] bg-[var(--surface)] px-5 py-6 lg:flex lg:flex-col">
          <div className="mb-8 border-b border-[var(--line)] pb-5">
            <div className="text-[11px] font-medium uppercase tracking-[0.24em] text-[var(--ink-muted)]">
              AgentWorld
            </div>
            <h1 className="mt-3 max-w-[14rem] text-2xl font-semibold tracking-[-0.04em] text-[var(--ink)]">
              面向{term("tenantSpace")}、{term("businessTeam")}和{term("task")}的可治理 Agent 执行平台。
            </h1>
            <p className="mt-3 text-sm leading-6 text-[var(--ink-muted)]">
              一个界面统一承载{term("serviceDirectory")}、{term("accessPolicy")}、{term("runtime")}发现、{term("trace")}回放和人工门禁。
            </p>
          </div>
          <SidebarNav />
        </aside>

        <main className="flex min-h-[calc(100vh-2rem)] flex-1 flex-col rounded-[32px] border border-[var(--line)] bg-[var(--surface)] px-5 py-5 sm:px-7 sm:py-6">
          <header className="mb-7 flex flex-col gap-4 border-b border-[var(--line)] pb-5 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <div className="text-[11px] font-medium uppercase tracking-[0.24em] text-[var(--ink-muted)]">
                Agent 运营工作台
              </div>
              <h2 className="mt-2 text-3xl font-semibold tracking-[-0.04em] text-[var(--ink)]">
                AgentWorld 控制台
              </h2>
            </div>
            <div className="grid gap-2 text-sm text-[var(--ink-muted)] sm:text-right">
              <div>{term("task")}调度、DAG 执行和 Agent 调用会被明确拆开展示。</div>
              <div>{term("executionPolicy")}会在{term("task")}之前、过程中和结果里持续可见。</div>
            </div>
          </header>
          <div className="flex-1">{children}</div>
        </main>
      </div>
    </div>
  );
}
