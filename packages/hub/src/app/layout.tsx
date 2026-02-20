import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";
import type { ReactNode } from "react";
import { AuthStatusClient } from "./auth-status.client";
import { HeaderNav } from "./header-nav.client";
import { resolveLang } from "./i18n";
import { LangSync } from "./lang-sync.client";
import { appStore } from "./state";
import "./globals.css";

export const metadata: Metadata = {
  title: "Req2Rank Hub — AI Coding Benchmark Leaderboard",
  description: "Community-driven leaderboard for LLM coding capability evaluation. Submit scores, compare models, and explore verification data.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

type RootLayoutProps = {
  children: ReactNode;
};

export default async function RootLayout({ children }: RootLayoutProps) {
  const cookieStore = await cookies();
  const lang = resolveLang(cookieStore.get("hub.lang")?.value);
  const topModels = await appStore.listLeaderboard({ limit: 3, offset: 0, sort: "desc" });

  return (
    <html lang={lang === "en" ? "en" : "zh-CN"}>
      <body>
        <header className="hub-header">
          <div className="hub-header-inner">
            <strong className="hub-brand">Req2Rank Hub</strong>
            <HeaderNav topModels={topModels} />
            <AuthStatusClient />
          </div>
        </header>
        <LangSync />
        <main className="hub-main">{children}</main>
      </body>
    </html>
  );
}
