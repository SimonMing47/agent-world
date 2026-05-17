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
  Plug,
  ScrollText,
  Settings,
  ShieldCheck,
  Users,
  UserRoundCog,
  Wrench,
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
      { href: "/", label: "整体任务看板", sidebarLabel: "整体", description: "任务、风险和配置状态", icon: LayoutDashboard },
      { href: "/team-wallboard", label: "团队任务看板", sidebarLabel: "团队", description: "按业务团队组织的任务运行情况", icon: ChartNoAxesCombined },
      { href: "/agent-team-wallboard", label: "Agent 团队看板", sidebarLabel: "执行团队", description: "按 Agent 团队观察调度效果", icon: Activity },
      { href: "/findings", label: "Finding 治理", sidebarLabel: "风险", description: "标准化问题输出、误报、修复和发布状态", icon: ShieldCheck },
    ],
  },
  {
    title: "智能体治理",
    items: [
      { href: "/agents", label: "Agent 目录", sidebarLabel: "Agent", description: "Agent 定义、模型和权限", icon: Bot },
      { href: "/agent-teams", label: "Agent 团队", sidebarLabel: "执行团队", description: "Leader、成员和工作流", icon: Workflow },
    ],
  },
  {
    title: "团队治理",
    items: [
      { href: "/business-teams", label: "组织结构", sidebarLabel: "组织", description: "业务团队结构、归属和同步入口", icon: Users },
      { href: "/team-members", label: "团队成员", sidebarLabel: "成员", description: "成员、工号、邮箱、团队和角色", icon: UserRoundCog },
      { href: "/team-permissions", label: "成员权限", sidebarLabel: "权限", description: "团队成员对 AgentWorld 的操作权限", icon: KeyRound },
      { href: "/team-assets", label: "团队资产", sidebarLabel: "资产", description: "Skill、知识库、Codebase 和 Connector 授权", icon: Boxes },
      { href: "/task-blueprints", label: "任务管理", sidebarLabel: "任务", description: "任务定义和触发方式", icon: ScrollText },
    ],
  },
  {
    title: "基础配置",
    items: [
      { href: "/runtimes", label: "模型服务", sidebarLabel: "模型", description: "模型网关、密钥引用和能力参数", icon: Cable },
      { href: "/skills", label: "Skill 管理", sidebarLabel: "Skill", description: "Skill 内容、标签和同步状态", icon: Wrench },
      { href: "/mcp", label: "MCP 管理", sidebarLabel: "MCP", description: "MCP 服务、传输方式和工具白名单", icon: Network },
      { href: "/connectors", label: "Connector 管理", sidebarLabel: "连接器", description: "IM、邮件、Web Push 和外部通知通道", icon: Plug },
      { href: "/codebases", label: "Codebase 管理", sidebarLabel: "Codebase", description: "代码仓、地址和多个操作者 token", icon: Code2 },
      { href: "/knowledge", label: "知识库管理", sidebarLabel: "知识库", description: "基于 OpenViking 的团队/项目知识空间", icon: BookOpen },
      { href: "/settings", label: "系统配置", sidebarLabel: "系统", description: "执行环境、Webhook、运行配置、租户和系统级入口", icon: Settings },
    ],
  },
];

export const secondaryNavigation: NavItem[] = [
  { href: "/runtime-bindings", label: "模型执行配置", sidebarLabel: "执行配置", description: "默认模型服务、密钥引用、审批模式和附加参数", icon: Cable },
  { href: "/environments", label: "执行环境管理", sidebarLabel: "环境", description: "任务运行对象、代码仓、执行人、路径和记忆依赖", icon: Database },
  { href: "/webhooks", label: "Webhook 管理", sidebarLabel: "Webhook", description: "外部触发入口、签名密钥引用和请求 Schema", icon: Plug },
  { href: "/tenant-spaces", label: "租户空间", sidebarLabel: "租户", description: "租户级治理边界和模型白名单", icon: Globe },
  { href: "/execution-policies", label: "执行策略", sidebarLabel: "策略", description: "工具权限、预算、审批和输出约束", icon: ShieldCheck },
  { href: "/service-catalog", label: "服务目录", sidebarLabel: "目录", description: "跨团队服务条目", icon: Database },
  { href: "/access-grants", label: "跨团队授权", sidebarLabel: "授权", description: "服务方和消费方授权", icon: KeyRound },
];

export const flatNavigation = [
  ...navigationGroups.flatMap((group) => group.items),
  ...secondaryNavigation,
];

export function findNavItem(pathname: string) {
  return (
    flatNavigation.find((item) => pathname === item.href || (item.href !== "/" && pathname.startsWith(`${item.href}/`))) ??
    flatNavigation[0]
  );
}
