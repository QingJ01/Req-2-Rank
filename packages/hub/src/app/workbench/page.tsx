import { LiveMonitor } from "../components/live-monitor.client.js";

type WorkbenchPageProps = {
  searchParams?: {
    model?: string;
  };
};

export default function WorkbenchPage({ searchParams }: WorkbenchPageProps) {
  return (
    <section>
      <h1>Workbench</h1>
      <p className="hub-muted">Realtime monitoring for leaderboard updates, pipeline events, and timeline playback.</p>
      <LiveMonitor initialModel={searchParams?.model} />
    </section>
  );
}
