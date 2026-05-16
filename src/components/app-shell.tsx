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
              面向{term("tenantSpace")}、{term("businessTeam")}和{term("task")}的配置化 Agent 平台。
            </h1>
            <p className="mt-3 text-sm leading-6 text-[var(--ink-muted)]">
              一个界面统一管理任务蓝图、执行引擎、模型接口、环境、记忆和任务运行。
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
              <div>配置项落库，界面负责编辑和运行，不再承载解释型架构文案。</div>
              <div>{term("executionPolicy")}和权限会跟随任务运行、环境和输出一起生效。</div>
            </div>
          </header>
          <div className="flex-1">{children}</div>
        </main>
      </div>
    </div>
  );
}
