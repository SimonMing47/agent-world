"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { navigationGroups } from "@/components/navigation-config";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { AppScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

type SidebarNavProps = {
  collapsed?: boolean;
  onItemClick?: () => void;
  onToggleCollapse?: () => void;
};

export function SidebarNav({
  collapsed = false,
  onItemClick,
  onToggleCollapse,
}: SidebarNavProps) {
  const pathname = usePathname();

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-[var(--sidebar-line)] px-4 pb-4 pt-5">
        <div className={cn("min-w-0", collapsed && "sr-only")}>
          <div className="text-base font-semibold tracking-[0.01em] text-[var(--sidebar-ink)]">AgentWorld</div>
          <div className="mt-1 text-xs font-medium text-[var(--sidebar-muted)]">任务平台控制台</div>
        </div>
        {onToggleCollapse ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onToggleCollapse}
            className="hidden border border-transparent text-[var(--sidebar-muted)] hover:border-[var(--sidebar-line)] hover:bg-[var(--sidebar-surface)] hover:text-[var(--sidebar-ink)] lg:inline-flex"
          >
            {collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
          </Button>
        ) : null}
      </div>

      <AppScrollArea className="flex-1 px-3 py-3">
        <nav className="space-y-6 pb-6">
          {navigationGroups.map((group) => (
            <div key={group.title} className="space-y-2">
              {!collapsed ? (
                <div className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--sidebar-subtle)]">
                  {group.title}
                </div>
              ) : null}
              {group.items.map((item) => {
                const isActive =
                  pathname === item.href || (item.href !== "/" && pathname.startsWith(`${item.href}/`));
                const Icon = item.icon;

                const content = (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={onItemClick}
                    className={cn(
                      "group flex min-h-[56px] items-center gap-3 rounded-xl border px-3 py-2.5 transition-all",
                      collapsed && "justify-center px-0",
                      isActive
                        ? "border-[var(--sidebar-line)] bg-[var(--sidebar-surface-strong)] text-[var(--sidebar-ink)] shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]"
                        : "border-transparent text-[var(--sidebar-subtle)] hover:border-[var(--sidebar-line)] hover:bg-[var(--sidebar-surface)] hover:text-[var(--sidebar-ink)]",
                    )}
                  >
                    <Icon
                      className={cn(
                        "h-4 w-4 shrink-0",
                        isActive ? "text-[var(--sidebar-accent)]" : "text-current",
                      )}
                    />
                    {!collapsed ? (
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold tracking-[0.01em]">{item.label}</div>
                        <div
                          className={cn(
                            "truncate pt-0.5 text-xs",
                            isActive
                              ? "text-[color:rgba(248,250,252,0.78)]"
                              : "text-[var(--sidebar-muted)] group-hover:text-[var(--sidebar-muted)]",
                          )}
                        >
                          {item.description}
                        </div>
                      </div>
                    ) : null}
                  </Link>
                );

                return collapsed ? (
                  <Tooltip key={item.href}>
                    <TooltipTrigger asChild>{content}</TooltipTrigger>
                    <TooltipContent>{item.label}</TooltipContent>
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
