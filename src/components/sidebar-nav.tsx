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
      <div className="flex items-center justify-between px-3 pb-3 pt-4">
        <div className={cn("min-w-0", collapsed && "sr-only")}>
          <div className="text-sm font-semibold text-[var(--sidebar-ink)]">AgentWorld</div>
          <div className="text-xs text-[var(--sidebar-muted)]">任务平台控制台</div>
        </div>
        {onToggleCollapse ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onToggleCollapse}
            className="hidden text-[var(--sidebar-muted)] hover:bg-white/6 hover:text-[var(--sidebar-ink)] lg:inline-flex"
          >
            {collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
          </Button>
        ) : null}
      </div>

      <AppScrollArea className="flex-1 px-2">
        <nav className="space-y-5 pb-6">
          {navigationGroups.map((group) => (
            <div key={group.title} className="space-y-1.5">
              {!collapsed ? (
                <div className="px-3 pb-1 text-[11px] font-medium uppercase tracking-[0.16em] text-[var(--sidebar-muted)]">
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
                      "group flex items-center gap-3 rounded-xl px-3 py-2.5 transition-all",
                      collapsed && "justify-center px-0",
                      isActive
                        ? "bg-white/10 text-[var(--sidebar-ink)] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)]"
                        : "text-[var(--sidebar-muted)] hover:bg-white/6 hover:text-[var(--sidebar-ink)]",
                    )}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    {!collapsed ? (
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium">{item.label}</div>
                        <div className="truncate text-xs text-[var(--sidebar-muted)] group-hover:text-[var(--sidebar-muted)]">
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
