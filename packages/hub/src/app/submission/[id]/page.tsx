import { DimensionBars } from "../../components/dimension-bars.client.js";
import { TimelinePlayback } from "../../components/timeline-playback.client.js";
import { statusLabel } from "../../components/viz-utils.js";
import { resolveLang } from "../../i18n.js";
import { appStore } from "../../state.js";
import { SampleCard } from "./sample-card.client.js";

type SubmissionPageProps = {
  params: {
    id: string;
  };
  searchParams?: {
    lang?: string;
  };
};

export default async function SubmissionPage({ params, searchParams }: SubmissionPageProps) {
  const lang = resolveLang(searchParams?.lang);
  const isEn = lang === "en";
  const detail = await appStore.getSubmission(params.id);
  const timeline = detail?.evidenceChain?.timeline ?? [];
  const samples = detail?.evidenceChain?.samples ?? [];
  const environment = detail?.evidenceChain?.environment;

  return (
    <section>
      <h1>{isEn ? "Submission Detail" : "提交详情"}</h1>
      {!detail ? (
        <p className="hub-muted">{isEn ? "Submission not found." : "未找到该提交。"}</p>
      ) : (
        <div className="hub-card" style={{ padding: 16, lineHeight: 1.7 }}>
          <div>
            <strong>{isEn ? "Run ID:" : "运行 ID："}</strong> {detail.runId}
          </div>
          <div>
            <strong>{isEn ? "Model:" : "模型："}</strong> {detail.model}
          </div>
          <div>
            <strong>{isEn ? "Score:" : "得分："}</strong> {detail.score.toFixed(1)}
          </div>
          <div>
            <strong>{isEn ? "Status:" : "状态："}</strong> {statusLabel(detail.verificationStatus, lang)}
          </div>
          <div>
            <strong>{isEn ? "Submitted:" : "提交时间："}</strong> {detail.submittedAt}
          </div>

          <h2>{isEn ? "Dimension Scores" : "维度得分"}</h2>
          {!detail.dimensionScores || Object.keys(detail.dimensionScores).length === 0 ? (
            <div>{isEn ? "Dimension scores unavailable." : "暂无维度得分。"}</div>
          ) : (
            <DimensionBars values={detail.dimensionScores} lang={lang} />
          )}

          <h2>{isEn ? "Evidence Chain" : "证据链"}</h2>
          <div>
            <strong>{isEn ? "Timeline:" : "时间线："}</strong> {isEn ? `${timeline.length} phase(s)` : `${timeline.length} 个阶段`}
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
            <strong>{isEn ? "Samples:" : "样本："}</strong> {samples.length}
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
            <strong>{isEn ? "Environment:" : "环境："}</strong>{" "}
            {environment
              ? `${environment.os} / ${environment.nodeVersion} / ${environment.timezone}`
              : isEn ? "environment unavailable" : "暂无环境信息"}
          </div>
        </div>
      )}
    </section>
  );
}
