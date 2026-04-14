import type { Metadata } from "next";
import { IBM_Plex_Mono, Noto_Sans_SC } from "next/font/google";
import { AppShell } from "@/components/app-shell";
import "./globals.css";

const notoSansSc = Noto_Sans_SC({
  variable: "--font-manrope",
  preload: true,
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  title: "AgentWorld",
  description:
    "一个面向 World、Kingdom、Quest、Contract、Tavern 与 Harness Agent 执行的 TypeScript 单体平台。",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="zh-CN"
      className={`${notoSansSc.variable} ${plexMono.variable} h-full bg-[var(--canvas)] text-[var(--ink)] antialiased`}
    >
      <body className="min-h-full">
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
