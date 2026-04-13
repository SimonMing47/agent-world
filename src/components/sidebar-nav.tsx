"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  AlarmClock,
  Bot,
  Cable,
  ChartNoAxesCombined,
  Command,
  GitBranch,
  LayoutDashboard,
  Settings,
  ShieldCheck,
  Users,
  Workflow,
} from "lucide-react";
import { cn } from "@/lib/utils";

const items = [
  { href: "/", label: "Overview", icon: LayoutDashboard },
  { href: "/tasks", label: "Tasks", icon: Workflow },
  { href: "/runs", label: "Runs", icon: Activity },
  { href: "/runtimes", label: "Runtimes", icon: Cable },
  { href: "/harness", label: "Harness", icon: ShieldCheck },
  { href: "/wallboard", label: "Wallboard", icon: ChartNoAxesCombined },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function SidebarNav() {
  const pathname = usePathname();

  return (
    <nav className="flex flex-col gap-1.5">
      {items.map((item) => {
        const isActive = pathname === item.href;
        const Icon = item.icon;

        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm transition-colors",
              isActive
                ? "bg-[var(--surface-strong)] text-[var(--ink)] shadow-[inset_0_0_0_1px_var(--line)]"
                : "text-[var(--ink-muted)] hover:bg-[var(--surface)] hover:text-[var(--ink)]",
            )}
          >
            <Icon className="h-4 w-4" />
            <span>{item.label}</span>
          </Link>
        );
      })}

      <div className="mt-6 space-y-3 rounded-[26px] border border-[var(--line)] bg-[var(--surface)] p-4">
        <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.22em] text-[var(--ink-muted)]">
          <Command className="h-3.5 w-3.5" />
          Core lenses
        </div>
        <div className="space-y-2 text-sm text-[var(--ink-muted)]">
          <div className="flex items-center gap-2">
            <Bot className="h-4 w-4" />
            Active agents
          </div>
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            Active developers
          </div>
          <div className="flex items-center gap-2">
            <GitBranch className="h-4 w-4" />
            Active repositories
          </div>
          <div className="flex items-center gap-2">
            <AlarmClock className="h-4 w-4" />
            Scheduled queue
          </div>
        </div>
      </div>
    </nav>
  );
}
