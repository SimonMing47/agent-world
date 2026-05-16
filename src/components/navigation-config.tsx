import type { LucideIcon } from "lucide-react";
import {
  Activity,
  BookOpen,
  Boxes,
  Cable,
  ChartNoAxesCombined,
  Globe,
  LayoutDashboard,
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
      { href: "/task-runs", label: term("task"), description: "运行实例与执行轨迹", icon: Activity },
      { href: "/task-blueprints", label: "任务蓝图", description: "任务模板与触发规则", icon: Boxes },
    ],
  },
  {
    title: "配置",
    items: [
      { href: "/settings", label: "设置", description: "Provider、环境与 Webhook 配置", icon: Settings },
      { href: "/runtimes", label: term("runtime"), description: "执行引擎发现与健康状态", icon: Cable },
      { href: "/knowledge", label: "知识库", description: "记忆层、Skill 与知识空间", icon: BookOpen },
      { href: "/execution-policies", label: term("executionPolicy"), description: "权限、预算与审批策略", icon: ShieldCheck },
    ],
  },
  {
    title: "治理",
    items: [
      { href: "/tenant-spaces", label: term("tenantSpace"), description: "租户级别治理与白名单", icon: Globe },
      { href: "/business-teams", label: term("businessTeam"), description: "业务团队可见性与归属", icon: Users },
      { href: "/agent-teams", label: `${term("agentTeam")}服务`, description: "团队编排与 Agent 分工", icon: Workflow },
      { href: "/service-catalog", label: term("serviceDirectory"), description: "跨团队能力目录", icon: Store },
      { href: "/access-grants", label: term("accessPolicy"), description: "跨团队授权与访问控制", icon: ScrollText },
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
