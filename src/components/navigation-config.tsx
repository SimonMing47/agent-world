import type { LucideIcon } from "lucide-react";
import {
  Activity,
  Bot,
  BookOpen,
  Boxes,
  Cable,
  ChartNoAxesCombined,
  Code2,
  Database,
  KeyRound,
  Globe,
  LayoutDashboard,
  Network,
  PlugZap,
  ScrollText,
  Settings,
  ShieldCheck,
  Sparkles,
  Users,
  UserRoundCog,
  Workflow,
} from "lucide-react";

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
      { href: "/", label: "整体任务大屏", sidebarLabel: "整体", description: "平台级任务、风险和治理指标", icon: LayoutDashboard },
      { href: "/team-wallboard", label: "团队任务大屏", sidebarLabel: "团队", description: "按业务团队组织的任务运行情况", icon: ChartNoAxesCombined },
      { href: "/agent-team-wallboard", label: "智能体团队大屏", sidebarLabel: "AgentTeam", description: "按智能体团队观察调度效果", icon: Activity },
    ],
  },
  {
    title: "智能体治理",
    items: [
      { href: "/agents", label: "智能体定义", sidebarLabel: "智能体", description: "Agent 是调度的最小单位和系统第一公民", icon: Bot },
      { href: "/agent-teams", label: "智能体团队", sidebarLabel: "Agent团队", description: "用于完成复杂任务的 Agent 调度单元", icon: Workflow },
    ],
  },
  {
    title: "团队治理",
    items: [
      { href: "/business-teams", label: "组织结构", sidebarLabel: "组织", description: "业务团队结构、归属和同步入口", icon: Users },
      { href: "/team-members", label: "团队成员", sidebarLabel: "成员", description: "成员、工号、邮箱、团队和角色", icon: UserRoundCog },
      { href: "/team-permissions", label: "成员权限", sidebarLabel: "权限", description: "团队成员对 AgentWorld 的操作权限", icon: KeyRound },
      { href: "/team-assets", label: "团队资产", sidebarLabel: "资产", description: "Skill、知识库、Codebase 和 Connector 授权", icon: Boxes },
      { href: "/task-blueprints", label: "任务管理", sidebarLabel: "任务", description: "所有任务从业务团队视角治理", icon: ScrollText },
    ],
  },
  {
    title: "基础配置",
    items: [
      { href: "/runtimes", label: "AI Provider", sidebarLabel: "Provider", description: "模型接口、密钥引用和模型能力", icon: Cable },
      { href: "/skills", label: "Skill 管理", sidebarLabel: "Skill", description: "存储在 OpenViking 的可复用运行能力", icon: Sparkles },
      { href: "/mcp", label: "MCP 管理", sidebarLabel: "MCP", description: "MCP 服务、传输方式和工具白名单", icon: Network },
      { href: "/connectors", label: "Connector 管理", sidebarLabel: "连接器", description: "IM、邮件、Web Push 和外部通知通道", icon: PlugZap },
      { href: "/codebases", label: "Codebase 管理", sidebarLabel: "Codebase", description: "代码仓、地址和多个操作者 token", icon: Code2 },
      { href: "/knowledge", label: "知识库管理", sidebarLabel: "知识库", description: "基于 OpenViking 的团队/项目知识空间", icon: BookOpen },
      { href: "/settings", label: "系统配置", sidebarLabel: "系统", description: "租户、执行策略、服务目录和系统级入口", icon: Settings },
      { href: "/tenant-spaces", label: "租户空间", sidebarLabel: "租户", description: "租户级治理边界和模型白名单", icon: Globe },
      { href: "/execution-policies", label: "执行策略", sidebarLabel: "策略", description: "权限、预算和审批策略", icon: ShieldCheck },
      { href: "/service-catalog", label: "服务目录", sidebarLabel: "目录", description: "跨团队可复用能力目录", icon: Database },
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
