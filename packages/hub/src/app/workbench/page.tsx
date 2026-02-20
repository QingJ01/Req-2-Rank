import { LiveMonitor } from "../components/live-monitor.client.js";
import { resolveLang } from "../i18n.js";

type WorkbenchPageProps = {
  searchParams?: {
    model?: string;
    lang?: string;
  };
};

export default function WorkbenchPage({ searchParams }: WorkbenchPageProps) {
  const lang = resolveLang(searchParams?.lang);
  const isEn = lang === "en";
  return (
    <section>
      <h1>{isEn ? "Workbench" : "实时工作台"}</h1>
      <p className="hub-muted">{isEn ? "Realtime monitoring for leaderboard updates, pipeline events, and timeline playback." : "实时监控排行榜更新、流水线事件与时间线回放。"}</p>
      <LiveMonitor initialModel={searchParams?.model} lang={lang} />
    </section>
  );
}
