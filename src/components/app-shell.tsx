"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";
import { Menu, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { findNavItem } from "@/components/navigation-config";
import { SidebarNav } from "@/components/sidebar-nav";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { TooltipProvider } from "@/components/ui/tooltip";

const SIDEBAR_STORAGE_KEY = "agentworld.sidebar.collapsed";
const SIDEBAR_EVENT = "agentworld:sidebar-collapsed-change";

function subscribeToSidebarPreference(callback: () => void) {
  if (typeof window === "undefined") {
    return () => undefined;
  }

  const handler = () => callback();
  window.addEventListener("storage", handler);
  window.addEventListener(SIDEBAR_EVENT, handler);

  return () => {
    window.removeEventListener("storage", handler);
    window.removeEventListener(SIDEBAR_EVENT, handler);
  };
}

function getSidebarSnapshot() {
  if (typeof window === "undefined") {
    return false;
  }

  return window.localStorage.getItem(SIDEBAR_STORAGE_KEY) === "1";
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const currentNav = useMemo(() => findNavItem(pathname), [pathname]);
  const collapsed = useSyncExternalStore(subscribeToSidebarPreference, getSidebarSnapshot, () => false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const updateCollapsed = (nextValue: boolean) => {
    window.localStorage.setItem(SIDEBAR_STORAGE_KEY, nextValue ? "1" : "0");
    window.dispatchEvent(new Event(SIDEBAR_EVENT));
  };

  return (
    <TooltipProvider>
      <div className="h-screen overflow-hidden bg-[var(--canvas)] text-[var(--ink)]">
        <div className="flex h-full">
          <aside
            className={`hidden h-screen shrink-0 overflow-hidden border-r border-[var(--sidebar-line)] bg-[var(--sidebar)] shadow-[8px_0_24px_rgba(15,23,42,0.08)] transition-[width] duration-200 lg:block ${
              collapsed ? "w-[80px]" : "w-[284px]"
            }`}
          >
            <SidebarNav
              collapsed={collapsed}
              onToggleCollapse={() => updateCollapsed(!collapsed)}
            />
          </aside>

          <div className="flex h-screen min-w-0 flex-1 flex-col overflow-hidden">
            <header className="z-30 shrink-0 border-b border-[var(--line)] bg-[var(--canvas)]/94 backdrop-blur">
              <div className="flex h-14 items-center gap-3 px-4 sm:px-6">
                <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
                  <SheetTrigger asChild>
                    <Button variant="ghost" size="icon" className="lg:hidden">
                      <Menu className="h-4 w-4" />
                    </Button>
                  </SheetTrigger>
                  <SheetContent side="left" className="p-0">
                    <SidebarNav onItemClick={() => setMobileOpen(false)} showBrand={false} />
                  </SheetContent>
                </Sheet>

                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="hidden text-[var(--ink-muted)] hover:bg-[var(--surface-muted)] hover:text-[var(--ink)] lg:inline-flex"
                  onClick={() => updateCollapsed(!collapsed)}
                >
                  {collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
                </Button>

                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold text-[var(--ink)]">{currentNav.label}</div>
                </div>
              </div>
            </header>

            <main className="min-h-0 min-w-0 flex-1 overflow-y-auto">
              <div className="mx-auto flex w-full max-w-[1480px] flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
                {children}
              </div>
            </main>
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
}
