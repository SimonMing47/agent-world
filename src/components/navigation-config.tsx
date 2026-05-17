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
    title: "ui.generated.cc122e1758c",
    items: [
      { href: "/", label: "ui.generated.c5219bd1bbc", sidebarLabel: "ui.generated.cf0e2bbbacc", description: "ui.generated.cc1ecf48bb4", icon: LayoutDashboard },
      { href: "/team-wallboard", label: "ui.generated.c40b17f7982", sidebarLabel: "ui.generated.c21d7042ff0", description: "ui.generated.c89b53fa03e", icon: ChartNoAxesCombined },
      { href: "/agent-team-wallboard", label: "ui.generated.c0309379742", sidebarLabel: "ui.generated.cd4f6dd33b7", description: "ui.generated.c24430ad429", icon: Activity },
      { href: "/findings", label: "ui.generated.c3c2f7b1bc9", sidebarLabel: "ui.generated.c96a9697379", description: "ui.generated.ca528221852", icon: ShieldCheck },
    ],
  },
  {
    title: "ui.generated.c85894b835e",
    items: [
      { href: "/agents", label: "ui.generated.cc7b4185dbe", sidebarLabel: "Agent", description: "ui.generated.c10e5edeb6f", icon: Bot },
      { href: "/agent-teams", label: "ui.generated.c70f970c1fc", sidebarLabel: "ui.generated.cd4f6dd33b7", description: "ui.generated.c0bd68882f9", icon: Workflow },
    ],
  },
  {
    title: "ui.generated.c41decbbd6e",
    items: [
      { href: "/business-teams", label: "ui.generated.c21dfec6104", sidebarLabel: "ui.generated.ca3540e824b", description: "ui.generated.ca9f7562a7c", icon: Users },
      { href: "/team-members", label: "ui.generated.c7de0251fdd", sidebarLabel: "ui.generated.cc1ee9f0190", description: "ui.generated.c2fddae130e", icon: UserRoundCog },
      { href: "/team-permissions", label: "ui.generated.c24a78ebc85", sidebarLabel: "ui.generated.c560165a6d7", description: "ui.generated.cf5d07326c6", icon: KeyRound },
      { href: "/team-assets", label: "ui.generated.ce40458cdde", sidebarLabel: "ui.generated.c713fd96fb2", description: "ui.generated.c9cc4c1ba80", icon: Boxes },
      { href: "/task-blueprints", label: "ui.generated.cff5e8b99ae", sidebarLabel: "ui.generated.c3172b317f9", description: "ui.generated.cc954e6a95e", icon: ScrollText },
    ],
  },
  {
    title: "ui.generated.c5095009346",
    items: [
      { href: "/runtimes", label: "ui.generated.cbc56f948bb", sidebarLabel: "ui.generated.c98fd0cbd9c", description: "ui.generated.c0f0ca69c34", icon: Cable },
      { href: "/skills", label: "ui.generated.ceb5b6ad433", sidebarLabel: "Skill", description: "ui.generated.cdc0757c222", icon: Wrench },
      { href: "/mcp", label: "ui.generated.c0950f9419b", sidebarLabel: "MCP", description: "ui.generated.c82a807f2dd", icon: Network },
      { href: "/connectors", label: "ui.generated.c2e8b3a3fbd", sidebarLabel: "ui.generated.cc2dd028659", description: "ui.generated.cda19037130", icon: Plug },
      { href: "/codebases", label: "ui.generated.c30a4255f18", sidebarLabel: "Codebase", description: "ui.generated.c53f720768a", icon: Code2 },
      { href: "/knowledge", label: "ui.generated.c053fc4ecbf", sidebarLabel: "ui.generated.c1dda51f9e3", description: "ui.generated.c572ffec9e5", icon: BookOpen },
      { href: "/settings", label: "ui.generated.c3c71dca8a0", sidebarLabel: "ui.generated.c1a1f6dff78", description: "ui.generated.cc133a25a4a", icon: Settings },
    ],
  },
];

export const secondaryNavigation: NavItem[] = [
  { href: "/runtime-bindings", label: "ui.generated.c94a82a5175", sidebarLabel: "ui.generated.c8e175e7aa9", description: "ui.generated.c607060c125", icon: Cable },
  { href: "/environments", label: "ui.generated.c78f16f104a", sidebarLabel: "ui.generated.caa3833ea2a", description: "ui.generated.c6024d1d911", icon: Database },
  { href: "/webhooks", label: "ui.generated.cc6ce61d180", sidebarLabel: "Webhook", description: "ui.generated.c1ed9c2542f", icon: Plug },
  { href: "/tenant-spaces", label: "ui.generated.c3db35d2741", sidebarLabel: "ui.generated.ccc04fa896e", description: "ui.generated.c187be7147c", icon: Globe },
  { href: "/execution-policies", label: "ui.generated.c6408e9f93d", sidebarLabel: "ui.generated.cf3c49831c6", description: "ui.generated.cf1eddc323b", icon: ShieldCheck },
  { href: "/service-catalog", label: "ui.generated.cab63588ee3", sidebarLabel: "ui.generated.c41e5243e2d", description: "ui.generated.ce05c93fb64", icon: Database },
  { href: "/access-grants", label: "ui.generated.c2c4520c3e3", sidebarLabel: "ui.generated.c3a6e607f0c", description: "ui.generated.cb7453bf268", icon: KeyRound },
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
