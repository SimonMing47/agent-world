import type { Metadata } from "next";
import { IBM_Plex_Mono, Noto_Sans_SC } from "next/font/google";
import { AppShell } from "@/components/app-shell";
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
  description:
    "一个面向租户空间、业务团队、任务、跨团队授权、服务目录与运行约束的 TypeScript Agent 平台。",
};

export const dynamic = "force-dynamic";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const languagePack = getActiveLanguagePack();

  return (
    <html
      lang={languagePack.locale}
      dir={languagePack.direction}
      className={`${notoSansSc.variable} ${plexMono.variable} h-full bg-[var(--canvas)] text-[var(--ink)] antialiased`}
    >
      <body className="min-h-full">
        <AppShell languagePack={languagePack}>{children}</AppShell>
      </body>
    </html>
  );
}
