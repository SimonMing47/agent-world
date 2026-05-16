"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  AlarmClock,
  Boxes,
  Bot,
  BookOpen,
  Cable,
  ChartNoAxesCombined,
  Command,
  Globe,
  GitBranch,
  LayoutDashboard,
  Network,
  ScrollText,
  Settings,
  ShieldCheck,
  ShieldPlus,
  Store,
  Users,
  Workflow,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { term } from "@/lib/terminology";

const items = [
  { href: "/", label: "总览", icon: LayoutDashboard },
  { href: "/tenant-spaces", label: term("tenantSpace"), icon: Globe },
  { href: "/business-teams", label: term("businessTeam"), icon: Users },
  { href: "/agent-teams", label: `${term("agentTeam")}服务`, icon: Workflow },
  { href: "/task-blueprints", label: "任务蓝图", icon: Boxes },
  { href: "/task-runs", label: term("task"), icon: Activity },
  { href: "/architecture", label: "规格文档", icon: Network },
  { href: "/service-catalog", label: term("serviceDirectory"), icon: Store },
  { href: "/access-grants", label: term("accessPolicy"), icon: ScrollText },
  { href: "/runtimes", label: term("runtime"), icon: Cable },
  { href: "/execution-policies", label: term("executionPolicy"), icon: ShieldCheck },
  { href: "/knowledge", label: "知识库", icon: BookOpen },
  { href: "/wallboard", label: "大屏", icon: ChartNoAxesCombined },
  { href: "/settings", label: "设置", icon: Settings },
];

export function SidebarNav() {
  const pathname = usePathname();

  return (
    <nav className="flex flex-col gap-1.5">
      {items.map((item) => {
        const isActive =
          pathname === item.href ||
          (item.href !== "/" && pathname.startsWith(`${item.href}/`));
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
          关键视角
        </div>
        <div className="space-y-2 text-sm text-[var(--ink-muted)]">
          <div className="flex items-center gap-2">
            <Bot className="h-4 w-4" />
            活跃 Agent
          </div>
          <div className="flex items-center gap-2">
            <Network className="h-4 w-4" />
            授权调用边
          </div>
          <div className="flex items-center gap-2">
            <GitBranch className="h-4 w-4" />
            活跃代码仓
          </div>
          <div className="flex items-center gap-2">
            <AlarmClock className="h-4 w-4" />
            定时任务
          </div>
          <div className="flex items-center gap-2">
            <ShieldPlus className="h-4 w-4" />
            人工门禁
          </div>
        </div>
      </div>
    </nav>
  );
}
