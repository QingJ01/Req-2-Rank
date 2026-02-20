import { cookies } from "next/headers";
import { resolveLang } from "../i18n";
import { t } from "../locales";
import { resolveGithubOAuthSession } from "../../lib/github-oauth-session";

type AuthPageProps = {
  searchParams?: {
    error?: string;
  };
};

export default async function AuthPage({ searchParams }: AuthPageProps) {
  const cookieStore = await cookies();
  const lang = resolveLang(cookieStore.get("hub.lang")?.value);
  const error = searchParams?.error;
  const sessionToken = cookieStore.get("r2r_session")?.value;
  const session = sessionToken ? await resolveGithubOAuthSession(sessionToken) : undefined;

  return (
    <section className="hub-card hub-card-padded">
      <h1>{t(lang, "authTitle")}</h1>
      <p className="hub-muted">{t(lang, "authDesc")}</p>
      {error ? <p className="hub-muted">{lang === "en" ? `Login failed: ${error}` : `登录失败：${error}`}</p> : null}
      <div className="hub-flex-bar">
        <a className="hub-viz-button" href="/api/auth/github?action=login&redirect=/auth">
          {t(lang, "loginWithGithub")}
        </a>
        <a className="hub-viz-button" href="/api/auth/github?action=logout&redirect=/auth">
          {t(lang, "logoutAction")}
        </a>
        {session ? (
          <a className="hub-viz-button" href="/api/auth/github?action=cli-config">
            {t(lang, "downloadCliConfig")}
          </a>
        ) : null}
      </div>
      {session ? <p className="hub-muted hub-mt">{t(lang, "hubConfigHint")}</p> : null}
      <p className="hub-muted hub-mt">{t(lang, "adminAccount")}</p>
    </section>
  );
}
