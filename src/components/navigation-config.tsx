import type { LucideIcon } from "lucide-react";
import {
  Activity,
  Bot,
  BookOpen,
  Boxes,
  Cable,
  ChartNoAxesCombined,
  Globe,
  LayoutDashboard,
  MessagesSquare,
  ScrollText,
  Settings,
  ShieldCheck,
  Store,
  Users,
  Workflow,
} from "lucide-react";
import { term } from "@/lib/terminology";

export type NavItem = {
  href: string;
  label: string;
  sidebarLabel?: string;
  description: string;
  icon: LucideIcon;
};

export type NavGroup = {
  title: string;
  items: NavItem[];
};

export const navigationGroups: NavGroup[] = [
  {
    title: "总览",
    items: [
      { href: "/", label: "总览", description: "平台运行概览与关键指标", icon: LayoutDashboard },
      { href: "/wallboard", label: "大屏", description: "全局任务与风险看板", icon: ChartNoAxesCombined },
      { href: "/task-runs", label: term("task"), sidebarLabel: "任务", description: "运行实例与执行轨迹", icon: Activity },
      { href: "/task-blueprints", label: "任务定义", sidebarLabel: "蓝图", description: "任务、触发器与执行环境", icon: Boxes },
      { href: "/interactions", label: "交互工作台", sidebarLabel: "会话", description: "模型对话、Team 会话与人工介入", icon: MessagesSquare },
    ],
  },
  {
    title: "配置",
    items: [
      { href: "/settings", label: "设置", description: "Provider、环境与 Webhook 配置", icon: Settings },
      { href: "/runtimes", label: term("runtime"), sidebarLabel: "运行时", description: "执行引擎发现与健康状态", icon: Cable },
      { href: "/knowledge", label: "知识库", sidebarLabel: "知识", description: "记忆层、Skill 与知识空间", icon: BookOpen },
      { href: "/execution-policies", label: term("executionPolicy"), sidebarLabel: "策略", description: "权限、预算与审批策略", icon: ShieldCheck },
    ],
  },
  {
    title: "治理",
    items: [
      { href: "/tenant-spaces", label: term("tenantSpace"), sidebarLabel: "租户", description: "租户级别治理与白名单", icon: Globe },
      { href: "/business-teams", label: term("businessTeam"), sidebarLabel: "业务", description: "业务团队可见性与归属", icon: Users },
      { href: "/agents", label: "Agent 定义", sidebarLabel: "Agent", description: "个人 Agent、共享范围与提示词定义", icon: Bot },
      { href: "/agent-teams", label: term("agentTeam"), sidebarLabel: "编排", description: "团队编排与 Agent 分工", icon: Workflow },
      { href: "/service-catalog", label: term("serviceDirectory"), sidebarLabel: "目录", description: "跨团队能力目录", icon: Store },
      { href: "/access-grants", label: term("accessPolicy"), sidebarLabel: "授权", description: "跨团队授权与访问控制", icon: ScrollText },
    ],
  },
];

export const flatNavigation = navigationGroups.flatMap((group) => group.items);

export function findNavItem(pathname: string) {
  return (
    flatNavigation.find((item) => pathname === item.href || (item.href !== "/" && pathname.startsWith(`${item.href}/`))) ??
    flatNavigation[0]
  );
}
