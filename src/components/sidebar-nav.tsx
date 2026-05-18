"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { useLanguageText } from "@/components/language-pack-provider";
import { navigationGroups } from "@/components/navigation-config";
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
  const text = useLanguageText();

  return (
    <div className="agent-sidebar flex h-full flex-col">
      {showBrand ? (
        <div className="flex items-center justify-between border-b border-[var(--sidebar-line)] px-3 py-4">
          <div className={cn("flex min-w-0 items-center gap-3", collapsed && "sr-only")}>
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[var(--sidebar-line)] bg-[var(--sidebar-surface-strong)] text-sm font-semibold text-[var(--sidebar-ink)]">
              AW
            </div>
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold text-[var(--sidebar-ink)]">{text("terminology.productName", "AgentWorld")}</div>
              <div className="mt-0.5 text-xs font-medium text-[var(--sidebar-ink-softer)]">{text("ui.generated.c5bd086d22a")}</div>
            </div>
          </div>
          {onToggleCollapse ? (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={onToggleCollapse}
              className="hidden h-8 w-8 border border-[var(--sidebar-line)] bg-[var(--sidebar-surface-strong)] text-[var(--sidebar-muted)] hover:bg-[var(--sidebar-surface)] hover:text-[var(--sidebar-ink)] lg:inline-flex"
            >
              {collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
            </Button>
          ) : null}
        </div>
      ) : null}

      <AppScrollArea className={cn("flex-1 px-2 py-3", !showBrand && "pt-4")}>
        <nav className="space-y-4 pb-6">
          {navigationGroups.map((group) => (
            <div key={group.title} className="space-y-1.5">
              {!collapsed ? (
                <div className="sidebar-section-title px-3 pb-1 text-[11px] font-semibold">
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
                    data-active={isActive ? "true" : "false"}
                    onClick={onItemClick}
                    className={cn(
                      "sidebar-nav-link group flex min-h-10 items-center gap-3 rounded-lg border px-3 py-2 transition-colors",
                      collapsed && "justify-center px-0",
                      isActive
                        ? "border-[var(--sidebar-line)] bg-[var(--sidebar-surface-strong)]"
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
