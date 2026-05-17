import type { Metadata } from "next";
import { IBM_Plex_Mono, Noto_Sans_SC } from "next/font/google";
import { AppShell } from "@/components/app-shell";
import { uiText } from "@/lib/language-pack";
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
