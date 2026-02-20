import type { ReactNode } from "react";
import { HeaderNav } from "./header-nav.client.js";
import { LangSync } from "./lang-sync.client.js";
import { appStore } from "./state.js";
import "./globals.css";

type RootLayoutProps = {
  children: ReactNode;
};

export default async function RootLayout({ children }: RootLayoutProps) {
  const topModels = await appStore.listLeaderboard({ limit: 3, offset: 0, sort: "desc" });

  return (
    <html lang="zh-CN">
      <body>
        <header className="hub-header">
          <div className="hub-header-inner">
            <strong className="hub-brand">Req2Rank Hub</strong>
            <HeaderNav topModels={topModels} />
          </div>
        </header>
        <LangSync />
        <main className="hub-main">{children}</main>
      </body>
    </html>
  );
}
