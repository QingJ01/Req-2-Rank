import type { ReactNode } from "react";
import { appStore } from "./state.js";
import "./globals.css";

type RootLayoutProps = {
  children: ReactNode;
};

export default async function RootLayout({ children }: RootLayoutProps) {
  const topModels = await appStore.listLeaderboard({ limit: 3, offset: 0, sort: "desc" });

  return (
    <html lang="en">
      <body>
        <header className="hub-header">
          <div className="hub-header-inner">
            <strong className="hub-brand">Req2Rank Hub</strong>
            <nav className="hub-nav">
              <a href="/">
                Leaderboard
              </a>
              <span className="hub-muted">Models</span>
              {topModels.map((item) => (
                <a key={item.model} href={`/model/${encodeURIComponent(item.model)}`}>
                  {item.model.split("/")[1] ?? item.model}
                </a>
              ))}
            </nav>
          </div>
        </header>
        <main className="hub-main">{children}</main>
      </body>
    </html>
  );
}
