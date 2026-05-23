"use client";

import Link from "next/link";
import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { AgentWorldLogo } from "@/components/agentworld-logo";
import { useLanguageText } from "@/components/language-pack-provider";
import { flatNavigation, navigationGroups } from "@/components/navigation-config";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { AppScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

type SidebarNavProps = {
  collapsed?: boolean;
  onItemClick?: () => void;
  onToggleCollapse?: () => void;
  showBrand?: boolean;
};

export function SidebarNav({
  collapsed = false,
  onItemClick,
  onToggleCollapse,
  showBrand = true,
}: SidebarNavProps) {
  const pathname = usePathname();
  const router = useRouter();
  const text = useLanguageText();

  useEffect(() => {
    const routes = flatNavigation
      .map((item) => item.href)
      .filter((href) => href !== pathname)
      .slice(0, 16);

    const warm = () => {
      for (const href of routes) {
        router.prefetch(href);
      }
    };

    if (typeof window === "undefined") return undefined;

    const idleWindow = window as Window & {
      requestIdleCallback?: (callback: IdleRequestCallback) => number;
      cancelIdleCallback?: (handle: number) => void;
    };

    if (typeof idleWindow.requestIdleCallback === "function") {
      const handle = idleWindow.requestIdleCallback(() => warm());
      return () => idleWindow.cancelIdleCallback?.(handle);
    }

    const handle = window.setTimeout(warm, 120);
    return () => window.clearTimeout(handle);
  }, [pathname, router]);

  return (
    <div className="agent-sidebar flex h-full flex-col">
      {showBrand ? (
        <div className={cn("flex items-center justify-between border-b border-[var(--sidebar-line)] px-3 py-4", collapsed && "justify-center px-0")}>
          <div className={cn("flex min-w-0 items-center gap-3", collapsed && "justify-center")}>
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[12px] border border-white/70 bg-white/88 text-[var(--sidebar-ink)] shadow-none">
              <AgentWorldLogo className="h-5 w-5" />
            </div>
            <div className={cn("min-w-0", collapsed && "hidden")}>
              <div className="truncate text-sm font-semibold text-[var(--sidebar-ink)]">{text("terminology.productName", "AgentWorld")}</div>
              <div className="mt-0.5 text-[10px] font-medium uppercase tracking-[0.16em] text-[var(--sidebar-ink-softer)]">{text("ui.generated.c5bd086d22a")}</div>
            </div>
          </div>
          {onToggleCollapse ? (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={onToggleCollapse}
              className={cn(
                "hidden h-8 w-8 border border-white/70 bg-white/88 text-[var(--sidebar-muted)] shadow-none hover:bg-white hover:text-[var(--sidebar-ink)] lg:inline-flex",
                collapsed && "absolute opacity-0 pointer-events-none",
              )}
            >
              {collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
            </Button>
          ) : null}
        </div>
      ) : null}

      <AppScrollArea className={cn("flex-1 px-2 py-3", !showBrand && "pt-4")}>
        <nav className="space-y-5 pb-6">
          {navigationGroups.map((group) => (
            <div key={group.title} className="space-y-1.5">
              {!collapsed ? (
                <div className="sidebar-section-title px-3 pb-1 text-[10px] font-semibold">
                  {text(group.title)}
                </div>
              ) : null}
              {group.items.map((item) => {
                const isActive =
                  pathname === item.href || (item.href !== "/" && pathname.startsWith(`${item.href}/`));
                const Icon = item.icon;
                const displayLabel = item.sidebarLabel ?? item.label;

                const content = (
                  <Link
                    key={item.href}
                    href={item.href}
                    prefetch
                    data-active={isActive ? "true" : "false"}
                    onClick={onItemClick}
                    onMouseEnter={() => router.prefetch(item.href)}
                    onFocus={() => router.prefetch(item.href)}
                    onTouchStart={() => router.prefetch(item.href)}
                    className={cn(
                      "sidebar-nav-link group relative flex min-h-10 items-center gap-3 rounded-[14px] border px-3 py-2 transition-colors before:absolute before:bottom-2 before:left-0 before:top-2 before:w-[2px] before:rounded-r-full before:bg-[var(--sidebar-accent)] before:opacity-0 before:transition-opacity",
                      collapsed && "justify-center border-transparent px-0",
                      isActive
                        ? "border-transparent bg-transparent before:opacity-100"
                        : "border-transparent hover:bg-[var(--sidebar-surface)]",
                    )}
                  >
                    <Icon
                      className={cn(
                        "sidebar-nav-icon h-4 w-4 shrink-0 transition-colors",
                        isActive && "sidebar-nav-icon-active",
                      )}
                    />
                    {!collapsed ? (
                      <div className="min-w-0 flex-1">
                        <div className="sidebar-nav-label truncate text-sm font-medium">
                          {text(displayLabel)}
                        </div>
                      </div>
                    ) : null}
                  </Link>
                );

                return collapsed ? (
                  <Tooltip key={item.href}>
                    <TooltipTrigger asChild>{content}</TooltipTrigger>
                    <TooltipContent>{text(displayLabel)}</TooltipContent>
                  </Tooltip>
                ) : (
                  content
                );
              })}
            </div>
          ))}
        </nav>
      </AppScrollArea>
    </div>
  );
}
