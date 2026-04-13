import { SidebarNav } from "@/components/sidebar-nav";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen">
      <div className="mx-auto flex min-h-screen max-w-[1600px] gap-6 px-4 py-4 sm:px-6 lg:px-8">
        <aside className="hidden w-[280px] shrink-0 rounded-[32px] border border-[var(--line)] bg-[var(--surface)] px-5 py-6 lg:flex lg:flex-col">
          <div className="mb-8 border-b border-[var(--line)] pb-5">
            <div className="text-[11px] font-medium uppercase tracking-[0.24em] text-[var(--ink-muted)]">
              AgentHelix
            </div>
            <h1 className="mt-3 max-w-[14rem] text-2xl font-semibold tracking-[-0.04em] text-[var(--ink)]">
              Harnessed agent operations for real teams.
            </h1>
            <p className="mt-3 text-sm leading-6 text-[var(--ink-muted)]">
              One surface for schedules, runtimes, traces, and human intervention.
            </p>
          </div>
          <SidebarNav />
        </aside>

        <main className="flex min-h-[calc(100vh-2rem)] flex-1 flex-col rounded-[32px] border border-[var(--line)] bg-[var(--surface)] px-5 py-5 sm:px-7 sm:py-6">
          <header className="mb-7 flex flex-col gap-4 border-b border-[var(--line)] pb-5 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <div className="text-[11px] font-medium uppercase tracking-[0.24em] text-[var(--ink-muted)]">
                Team operating surface
              </div>
              <h2 className="mt-2 text-3xl font-semibold tracking-[-0.04em] text-[var(--ink)]">
                AgentHelix command center
              </h2>
            </div>
            <div className="grid gap-2 text-sm text-[var(--ink-muted)] sm:text-right">
              <div>Dispatch and invocation stay separate on purpose.</div>
              <div>Harness constraints stay visible before and during every run.</div>
            </div>
          </header>
          <div className="flex-1">{children}</div>
        </main>
      </div>
    </div>
  );
}
