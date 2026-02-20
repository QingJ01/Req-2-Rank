import { resolveLang } from "../i18n.js";

type AuthPageProps = {
  searchParams?: {
    lang?: string;
    error?: string;
  };
};

export default function AuthPage({ searchParams }: AuthPageProps) {
  const lang = resolveLang(searchParams?.lang);
  const isEn = lang === "en";
  const error = searchParams?.error;

  return (
    <section className="hub-card" style={{ padding: 14 }}>
      <h1>{isEn ? "Authentication" : "登录管理"}</h1>
      <p className="hub-muted">
        {isEn
          ? "Use GitHub OAuth to access admin moderation functions."
          : "使用 GitHub OAuth 登录后可访问管理员审核能力。"}
      </p>
      {error ? <p className="hub-muted">{isEn ? `Login failed: ${error}` : `登录失败：${error}`}</p> : null}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <a className="hub-viz-button" href={`/api/auth/github?action=login&redirect=/admin?lang=${lang}`}>
          {isEn ? "Login with GitHub" : "使用 GitHub 登录"}
        </a>
        <a className="hub-viz-button" href={`/api/auth/github?action=logout&redirect=/auth?lang=${lang}`}>
          {isEn ? "Logout" : "退出登录"}
        </a>
      </div>
      <p className="hub-muted" style={{ marginTop: 10 }}>
        {isEn ? "Admin account: QingJ01" : "管理员账号：QingJ01"}
      </p>
    </section>
  );
}
