"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";
import { ChevronRight, Menu } from "lucide-react";
import { CurrentUserMenu } from "@/components/current-user-menu";
import {
  LanguagePackProvider,
  useLanguageText,
} from "@/components/language-pack-provider";
import { findNavGroup, findNavItem } from "@/components/navigation-config";
import { SidebarNav } from "@/components/sidebar-nav";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { TooltipProvider } from "@/components/ui/tooltip";
import type { LanguagePack } from "@/lib/language-pack";

const SIDEBAR_STORAGE_KEY = "agentworld.sidebar.collapsed.v2";
const SIDEBAR_EVENT = "agentworld:sidebar-collapsed-change";

type CurrentUserSummary = {
  name: string;
  email: string;
  title: string;
  avatarUrl: string;
  initials: string;
  isSystemAdmin: boolean;
  primaryBusinessTeamName: string | null;
  accessibleBusinessTeams: Array<{ id: string; name: string }>;
};

type AuthSessionPayload = {
  authenticated?: boolean;
  context?: {
    user?: {
      name?: string;
      email?: string;
      title?: string;
      avatarUrl?: string;
      isSystemAdmin?: boolean | number;
    };
    primaryBusinessTeam?: {
      name?: string;
    } | null;
    accessibleBusinessTeams?: Array<{
      id?: string;
      name?: string;
    }>;
  } | null;
};

function initialsFromName(name: string, email: string) {
  const source = name.trim() || email.trim();
  return source
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

function currentUserFromSession(payload: AuthSessionPayload): CurrentUserSummary | null {
  const user = payload.context?.user;
  if (!payload.authenticated || !user) {
    return null;
  }

  const name = user.name ?? "";
  const email = user.email ?? "";
  return {
    name,
    email,
    title: user.title ?? "",
    avatarUrl: user.avatarUrl ?? "",
    initials: initialsFromName(name, email),
    isSystemAdmin: user.isSystemAdmin === true || user.isSystemAdmin === 1,
    primaryBusinessTeamName: payload.context?.primaryBusinessTeam?.name ?? null,
    accessibleBusinessTeams:
      payload.context?.accessibleBusinessTeams
        ?.filter((team): team is { id: string; name: string } => Boolean(team.id && team.name))
        .map((team) => ({ id: team.id, name: team.name })) ?? [],
  };
}

function isPublicWorkspacePath(pathname: string) {
  return pathname === "/" || pathname === "/signin" || pathname === "/change-password";
}

function subscribeToSidebarPreference(callback: () => void) {
  if (typeof window === "undefined") {
    return () => undefined;
  }

  const handler = () => callback();
  window.addEventListener("storage", handler);
  window.addEventListener(SIDEBAR_EVENT, handler);

  return () => {
    window.removeEventListener("storage", handler);
    window.removeEventListener(SIDEBAR_EVENT, handler);
  };
}

function getSidebarSnapshot() {
  if (typeof window === "undefined") {
    return true;
  }
  const stored = window.localStorage.getItem(SIDEBAR_STORAGE_KEY);
  return stored === null ? true : stored === "1";
}

export function AppShell({
  children,
  languagePack,
  currentUser,
}: {
  children: React.ReactNode;
  languagePack: LanguagePack;
  currentUser?: CurrentUserSummary | null;
}) {
  return (
    <LanguagePackProvider languagePack={languagePack}>
      <AppShellContentWithUser currentUser={currentUser}>{children}</AppShellContentWithUser>
    </LanguagePackProvider>
  );
}

function AppShellContentWithUser({
  children,
  currentUser,
}: {
  children: React.ReactNode;
  currentUser?: CurrentUserSummary | null;
}) {
  const pathname = usePathname();
  const currentNav = useMemo(() => findNavItem(pathname), [pathname]);
  const currentGroup = useMemo(() => findNavGroup(pathname), [pathname]);
  const text = useLanguageText();
  const collapsed = useSyncExternalStore(subscribeToSidebarPreference, getSidebarSnapshot, () => true);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [sessionUser, setSessionUser] = useState<CurrentUserSummary | null>(null);
  const isFullBleedWorkspace = pathname === "/knowledge";
  const resolvedUser = currentUser ?? sessionUser;

  useEffect(() => {
    if (currentUser || isPublicWorkspacePath(pathname)) {
      return;
    }

    const controller = new AbortController();
    void fetch("/api/auth/session", {
      cache: "no-store",
      signal: controller.signal,
    })
      .then((response) => (response.ok ? response.json() : null))
      .then((payload: AuthSessionPayload | null) => {
        if (payload) {
          setSessionUser(currentUserFromSession(payload));
        }
      })
      .catch(() => undefined);

    return () => controller.abort();
  }, [currentUser, pathname]);

  if (isPublicWorkspacePath(pathname)) {
    return <>{children}</>;
  }

  const updateCollapsed = (nextValue: boolean) => {
    window.localStorage.setItem(SIDEBAR_STORAGE_KEY, nextValue ? "1" : "0");
    window.dispatchEvent(new Event(SIDEBAR_EVENT));
  };

  return (
    <TooltipProvider>
      <div className="h-screen overflow-hidden bg-[var(--canvas)] text-[var(--ink)]">
        <div className="flex h-full">
          <aside
            className={`hidden h-screen shrink-0 overflow-visible border-r border-[var(--sidebar-line)] bg-[var(--sidebar)] backdrop-blur-2xl transition-[width] duration-200 lg:block ${
              collapsed ? "w-[68px]" : "w-[214px]"
            }`}
          >
            <SidebarNav
              collapsed={collapsed}
              onToggleCollapse={() => updateCollapsed(!collapsed)}
            />
          </aside>

          <div className="flex h-screen min-w-0 flex-1 flex-col overflow-hidden">
            <header className="z-30 shrink-0 border-b border-[var(--line)] bg-[rgba(245,245,247,0.72)] backdrop-blur-2xl">
              <div className="flex h-14 items-center gap-3 px-5 sm:px-6 lg:px-8">
                <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
                  <SheetTrigger asChild>
                    <Button variant="ghost" size="icon" className="lg:hidden">
                      <Menu className="h-4 w-4" />
                    </Button>
                  </SheetTrigger>
                  <SheetContent side="left" className="p-0">
                    <SidebarNav onItemClick={() => setMobileOpen(false)} showBrand={false} />
                  </SheetContent>
                </Sheet>

                <div className="min-w-0 flex-1">
                  <nav className="flex min-w-0 items-center gap-2 text-[12px] text-[var(--ink-muted)]" aria-label={text("navigation.breadcrumb")}>
                    <span className="truncate font-medium">{text(currentGroup.title)}</span>
                    <ChevronRight className="h-3.5 w-3.5 shrink-0 text-[var(--ink-softer)]" />
                    <span className="truncate font-semibold text-[var(--ink)]">{text(currentNav.label)}</span>
                  </nav>
                  <div className="mt-0.5 hidden truncate text-[11px] text-[var(--ink-softer)] sm:block">{text(currentNav.description)}</div>
                </div>

                {resolvedUser ? <CurrentUserMenu user={resolvedUser} /> : null}
              </div>
            </header>

            <main className="min-h-0 min-w-0 flex-1 overflow-y-auto">
              <div
                className={
                  isFullBleedWorkspace
                    ? "flex min-h-full w-full flex-col gap-5 px-5 py-5 sm:px-6 lg:px-7 xl:px-8"
                    : "mx-auto flex w-full max-w-[1560px] flex-col gap-8 px-5 py-7 sm:px-6 lg:px-8"
                }
              >
                {children}
              </div>
            </main>
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
}
