import { cookies } from "next/headers";
import { LiveMonitor } from "../components/live-monitor.client";
import { resolveLang } from "../i18n";
import { t } from "../locales";

type WorkbenchPageProps = {
  searchParams?: Promise<{
    model?: string;
  }>;
};

export default async function WorkbenchPage({ searchParams }: WorkbenchPageProps) {
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const cookieStore = await cookies();
  const lang = resolveLang(cookieStore.get("hub.lang")?.value);
  return (
    <section>
      <h1>{t(lang, "workbenchTitle")}</h1>
      <p className="hub-muted">{t(lang, "workbenchDesc")}</p>
      <LiveMonitor initialModel={resolvedSearchParams?.model} lang={lang} />
    </section>
  );
}
