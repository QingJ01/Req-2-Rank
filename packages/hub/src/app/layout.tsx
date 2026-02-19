import type { ReactNode } from "react";

type RootLayoutProps = {
  children: ReactNode;
};

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          fontFamily: '"Trebuchet MS", "Segoe UI", sans-serif',
          background:
            "radial-gradient(circle at 15% 20%, #ffd89b 0%, transparent 35%), radial-gradient(circle at 85% 10%, #a0d2ff 0%, transparent 40%), linear-gradient(145deg, #faf6ef 0%, #f2f7ff 55%, #fffdf5 100%)",
          color: "#1f2430"
        }}
      >
        <header
          style={{
            padding: "18px 28px",
            borderBottom: "1px solid rgba(31,36,48,0.12)",
            backdropFilter: "blur(4px)"
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <strong style={{ letterSpacing: "0.08em", textTransform: "uppercase" }}>Req2Rank Hub</strong>
            <nav style={{ display: "flex", gap: 16, fontSize: 14 }}>
              <a href="/" style={{ color: "#1f2430", textDecoration: "none" }}>
                Leaderboard
              </a>
              <a href="/model/openai%2Fgpt-4o-mini" style={{ color: "#1f2430", textDecoration: "none" }}>
                Model View
              </a>
            </nav>
          </div>
        </header>
        <main style={{ padding: 28 }}>{children}</main>
      </body>
    </html>
  );
}
