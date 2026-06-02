import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { uiText } from "@/lib/language-pack";
import { getRequestAuthContext } from "@/server/auth-core";
import { getActiveLanguagePack } from "@/server/language-pack-store";
import "./globals.css";

export const metadata: Metadata = {
  title: "AgentWorld",
  description: uiText("ui.generated.caab5c6c8a4"),
  icons: {
    icon: [{ url: "/icon.svg", type: "image/svg+xml" }],
    shortcut: ["/icon.svg"],
  },
};

export const dynamic = "force-dynamic";

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const languagePack = getActiveLanguagePack();
  const requestHeaders = await headers();
  const pathname = requestHeaders.get("x-agentworld-pathname") ?? "/";
  const publicPaths = new Set(["/", "/signin"]);
  const authContext = await getRequestAuthContext();
  if (!publicPaths.has(pathname)) {
    if (!authContext) {
      redirect(`/?next=${encodeURIComponent(pathname)}`);
    }
    if (authContext.mustChangePassword && pathname !== "/change-password") {
      redirect(`/change-password?next=${encodeURIComponent(pathname)}`);
    }
  }
  const initials =
    authContext?.user.name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? "")
      .join("") ?? "";

  return (
    <html
      lang={languagePack.locale}
      dir={languagePack.direction}
      className="h-full bg-[var(--canvas)] text-[var(--ink)] antialiased"
    >
      <body className="min-h-full">
        <AppShell
          languagePack={languagePack}
          currentUser={
            authContext
              ? {
                  name: authContext.user.name,
                  email: authContext.user.email,
                  title: authContext.user.title,
                  avatarUrl: authContext.user.avatarUrl,
                  initials,
                  isSystemAdmin: authContext.user.isSystemAdmin === 1,
                  primaryBusinessTeamName: authContext.primaryBusinessTeam?.name ?? null,
                  accessibleBusinessTeams: authContext.accessibleBusinessTeams.map((team) => ({
                    id: team.id,
                    name: team.name,
                  })),
                }
              : null
          }
        >
          {children}
        </AppShell>
      </body>
    </html>
  );
}
