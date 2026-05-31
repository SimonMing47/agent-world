import type { LucideIcon } from "lucide-react";
import {
  Activity,
  Bot,
  BookOpen,
  Cable,
  ChartNoAxesCombined,
  Code2,
  Database,
  KeyRound,
  Globe,
  LayoutDashboard,
  MessageSquareMore,
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
    title: "navigation.groups.overview",
    items: [
      { href: "/overview", label: "nav.overview.label", sidebarLabel: "nav.overview.sidebarLabel", description: "nav.overview.description", icon: LayoutDashboard },
      { href: "/interactions", label: "console.interactions.label", sidebarLabel: "console.interactions.sidebarLabel", description: "console.interactions.description", icon: MessageSquareMore },
      { href: "/team-wallboard", label: "nav.teamWallboard.label", sidebarLabel: "nav.teamWallboard.sidebarLabel", description: "nav.teamWallboard.description", icon: ChartNoAxesCombined },
      { href: "/agent-team-wallboard", label: "nav.agentTeamWallboard.label", sidebarLabel: "nav.agentTeamWallboard.sidebarLabel", description: "nav.agentTeamWallboard.description", icon: Activity },
    ],
  },
  {
    title: "navigation.groups.agentGovernance",
    items: [
      { href: "/agents", label: "nav.agents.label", sidebarLabel: "ui.common.resources.agent", description: "nav.agents.description", icon: Bot },
      { href: "/agent-teams", label: "ui.common.resources.agentTeam", sidebarLabel: "ui.common.resources.agentTeam", description: "nav.agentTeams.description", icon: Workflow },
    ],
  },
  {
    title: "navigation.groups.teamGovernance",
    items: [
      { href: "/business-teams", label: "nav.businessTeams.label", sidebarLabel: "nav.businessTeams.sidebarLabel", description: "nav.businessTeams.description", icon: Users },
      { href: "/team-members", label: "nav.teamMembers.label", sidebarLabel: "nav.teamMembers.sidebarLabel", description: "nav.teamMembers.description", icon: UserRoundCog },
      { href: "/task-blueprints", label: "nav.taskBlueprints.label", sidebarLabel: "nav.taskBlueprints.sidebarLabel", description: "nav.taskBlueprints.description", icon: ScrollText },
    ],
  },
  {
    title: "navigation.groups.foundation",
    items: [
      { href: "/runtimes", label: "ui.common.resources.providerProfile", sidebarLabel: "nav.runtimes.sidebarLabel", description: "nav.runtimes.description", icon: Cable },
      { href: "/skills", label: "nav.skills.label", sidebarLabel: "terminology.skill", description: "nav.skills.description", icon: Wrench },
      { href: "/mcp", label: "nav.mcp.label", sidebarLabel: "MCP", description: "nav.mcp.description", icon: Network },
      { href: "/connectors", label: "nav.connectors.label", sidebarLabel: "terminology.connector", description: "nav.connectors.description", icon: Plug },
      { href: "/codebases", label: "nav.codebases.label", sidebarLabel: "terminology.codebase", description: "nav.codebases.description", icon: Code2 },
      { href: "/knowledge", label: "nav.knowledge.label", sidebarLabel: "terminology.knowledge", description: "nav.knowledge.description", icon: BookOpen },
      { href: "/identity-access", label: "identityAccess.nav.label", sidebarLabel: "identityAccess.nav.sidebarLabel", description: "identityAccess.nav.description", icon: ShieldCheck },
      { href: "/settings", label: "nav.settings.label", sidebarLabel: "nav.settings.sidebarLabel", description: "nav.settings.description", icon: Settings },
    ],
  },
];

export const secondaryNavigation: NavItem[] = [
  { href: "/runtime-bindings", label: "nav.runtimeBindings.label", sidebarLabel: "ui.common.resources.runtimeBinding", description: "nav.runtimeBindings.description", icon: Cable },
  { href: "/environments", label: "nav.environments.label", sidebarLabel: "nav.environments.sidebarLabel", description: "nav.environments.description", icon: Database },
  { href: "/webhooks", label: "nav.webhooks.label", sidebarLabel: "Webhook", description: "nav.webhooks.description", icon: Plug },
  { href: "/tenant-spaces", label: "terminology.tenantSpace", sidebarLabel: "nav.tenantSpaces.sidebarLabel", description: "nav.tenantSpaces.description", icon: Globe },
  { href: "/execution-policies", label: "terminology.executionPolicy", sidebarLabel: "nav.executionPolicies.sidebarLabel", description: "nav.executionPolicies.description", icon: ShieldCheck },
  { href: "/service-catalog", label: "terminology.serviceDirectory", sidebarLabel: "nav.serviceCatalog.sidebarLabel", description: "nav.serviceCatalog.description", icon: Database },
  { href: "/access-grants", label: "terminology.accessPolicy", sidebarLabel: "nav.accessGrants.sidebarLabel", description: "nav.accessGrants.description", icon: KeyRound },
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

export function findNavGroup(pathname: string) {
  const item = findNavItem(pathname);
  return (
    navigationGroups.find((group) => group.items.some((candidate) => candidate.href === item.href)) ??
    (secondaryNavigation.some((candidate) => candidate.href === item.href)
      ? {
          title: "navigation.groups.foundation",
          items: secondaryNavigation,
        }
      : navigationGroups[0])
  );
}
