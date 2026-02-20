import { cookies } from "next/headers";
import { DimensionBars } from "../../components/dimension-bars.client";
import { TimelinePlayback } from "../../components/timeline-playback.client";
import { statusLabel } from "../../components/viz-utils";
import { resolveLang } from "../../i18n";
import { appStore } from "../../state";
import { SampleCard } from "./sample-card.client";
import { t } from "../../locales";

type SubmissionPageProps = {
  params: {
    id: string;
  };
};

export default async function SubmissionPage({ params }: SubmissionPageProps) {
  const cookieStore = await cookies();
  const lang = resolveLang(cookieStore.get("hub.lang")?.value);
  const detail = await appStore.getSubmission(params.id);
  const timeline = detail?.evidenceChain?.timeline ?? [];
  const samples = detail?.evidenceChain?.samples ?? [];
  const environment = detail?.evidenceChain?.environment;

  return (
    <section>
      <h1>{t(lang, "submissionDetail")}</h1>
      {!detail ? (
        <p className="hub-muted">{t(lang, "submissionNotFound")}</p>
      ) : (
        <div className="hub-card" style={{ padding: 16, lineHeight: 1.7 }}>
          <div>
            <strong>{t(lang, "runId")}</strong> {detail.runId}
          </div>
          <div>
            <strong>{t(lang, "modelLabel")}</strong> {detail.model}
          </div>
          <div>
            <strong>{t(lang, "scoreLabel")}</strong> {detail.score.toFixed(1)}
          </div>
          <div>
            <strong>{t(lang, "statusLabel")}</strong> {statusLabel(detail.verificationStatus, lang)}
          </div>
          <div>
            <strong>{t(lang, "submittedLabel")}</strong> {detail.submittedAt}
          </div>

          <h2>{t(lang, "dimensionScores")}</h2>
          {!detail.dimensionScores || Object.keys(detail.dimensionScores).length === 0 ? (
            <div>{t(lang, "dimensionScoresUnavailable")}</div>
          ) : (
            <DimensionBars values={detail.dimensionScores} lang={lang} />
          )}

          <h2>{t(lang, "evidenceChain")}</h2>
          <div>
            <strong>{t(lang, "timelineLabel")}</strong> {lang === "en" ? `${timeline.length} phase(s)` : `${timeline.length} 个阶段`}
          </div>
          {timeline.length > 0 && (
            <ul>
              {timeline.map((item, index) => (
                <li key={`${item.phase}-${index}`}>
                  {item.phase}: {item.startedAt} {"->"} {item.completedAt} ({item.model})
                </li>
              ))}
            </ul>
          )}
          <div>
            <strong>{t(lang, "samplesLabel")}</strong> {samples.length}
          </div>
          {samples.length > 0 && (
            <div className="hub-grid" style={{ marginTop: 6, marginBottom: 8 }}>
              {samples.map((sample) => (
                <SampleCard key={`sample-${sample.roundIndex}`} sample={sample} lang={lang} />
              ))}
            </div>
          )}
          {timeline.length > 0 ? <TimelinePlayback submission={detail} lang={lang} /> : null}
          <div>
            <strong>{t(lang, "envLabel")}</strong>{" "}
            {environment
              ? `${environment.os} / ${environment.nodeVersion} / ${environment.timezone}`
              : t(lang, "envUnavailable")}
          </div>
        </div>
      )}
    </section>
  );
}
