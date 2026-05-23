import type { Metadata } from "next";
import { headers } from "next/headers";
import { IBM_Plex_Mono, Noto_Sans_SC } from "next/font/google";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { uiText } from "@/lib/language-pack";
import { getRequestAuthContext } from "@/server/auth-core";
import { getActiveLanguagePack } from "@/server/language-pack-store";
import "./globals.css";

const notoSansSc = Noto_Sans_SC({
  variable: "--font-manrope",
  preload: true,
  display: "swap",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  fallback: ["PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "sans-serif"],
});

const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  title: "AgentWorld",
  description: uiText("ui.generated.caab5c6c8a4"),
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
  const publicPaths = new Set(["/", "/signin", "/access-request"]);
  const authContext = await getRequestAuthContext();
  if (!publicPaths.has(pathname)) {
    if (!authContext) {
      redirect(`/?next=${encodeURIComponent(pathname)}`);
    }
    if (!authContext.access.allowed) {
      redirect(`/access-request?next=${encodeURIComponent(pathname)}`);
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
      className={`${notoSansSc.variable} ${plexMono.variable} h-full bg-[var(--canvas)] text-[var(--ink)] antialiased`}
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
