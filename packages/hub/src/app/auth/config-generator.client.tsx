"use client";

import { useEffect, useMemo, useState } from "react";
import type { Lang } from "../i18n";
import { t } from "../locales";

type ConfigGeneratorProps = {
  lang: Lang;
  initialHubToken?: string;
};

type JudgeConfig = {
  provider: string;
  model: string;
  apiKey: string;
  baseUrl: string;
  weight: string;
};

export function ConfigGenerator({ lang, initialHubToken }: ConfigGeneratorProps) {
  const [targetProvider, setTargetProvider] = useState("openai");
  const [targetModel, setTargetModel] = useState("gpt-4o-mini");
  const [targetApiKey, setTargetApiKey] = useState("");
  const [targetBaseUrl, setTargetBaseUrl] = useState("");

  const [systemProvider, setSystemProvider] = useState("anthropic");
  const [systemModel, setSystemModel] = useState("claude-sonnet-4-20250514");
  const [systemApiKey, setSystemApiKey] = useState("");
  const [systemBaseUrl, setSystemBaseUrl] = useState("");

  const [judges, setJudges] = useState<JudgeConfig[]>([
    {
      provider: "openai",
      model: "gpt-4o",
      apiKey: "",
      baseUrl: "",
      weight: "1"
    }
  ]);
  const [activeJudgeIndex, setActiveJudgeIndex] = useState(0);

  const [complexity, setComplexity] = useState("mixed");
  const [rounds, setRounds] = useState("1");
  const [concurrency, setConcurrency] = useState("1");

  const [hubEnabled, setHubEnabled] = useState(true);
  const [hubServerUrl, setHubServerUrl] = useState("https://req2rank.top");
  const [hubToken, setHubToken] = useState(initialHubToken ?? "");
  const [includeToken, setIncludeToken] = useState(Boolean(initialHubToken));
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (initialHubToken) {
      setHubToken(initialHubToken);
      setIncludeToken(true);
    }
  }, [initialHubToken]);

  const configJson = useMemo(() => {
    const target = {
      provider: targetProvider.trim(),
      model: targetModel.trim(),
      apiKey: targetApiKey,
      ...(targetBaseUrl.trim() ? { baseUrl: targetBaseUrl.trim() } : {})
    };
    const systemConfig = {
      provider: systemProvider.trim(),
      model: systemModel.trim(),
      apiKey: systemApiKey,
      ...(systemBaseUrl.trim() ? { baseUrl: systemBaseUrl.trim() } : {})
    };
    const judgeList = judges.map((judge) => ({
      provider: judge.provider.trim(),
      model: judge.model.trim(),
      apiKey: judge.apiKey,
      weight: Number(judge.weight) || 1,
      ...(judge.baseUrl.trim() ? { baseUrl: judge.baseUrl.trim() } : {})
    }));
    const hub = hubEnabled
      ? {
          enabled: true,
          serverUrl: hubServerUrl.trim(),
          ...(includeToken && hubToken ? { token: hubToken } : {})
        }
      : { enabled: false };

    const config = {
      target,
      systemModel: systemConfig,
      judges: judgeList,
      test: {
        complexity,
        rounds: Number(rounds) || 1,
        concurrency: Number(concurrency) || 1
      },
      hub
    };

    return JSON.stringify(config, null, 2);
  }, [
    targetProvider,
    targetModel,
    targetApiKey,
    targetBaseUrl,
    systemProvider,
    systemModel,
    systemApiKey,
    systemBaseUrl,
    judges,
    complexity,
    rounds,
    concurrency,
    hubEnabled,
    hubServerUrl,
    hubToken,
    includeToken
  ]);

  async function handleCopy(): Promise<void> {
    try {
      if (typeof navigator !== "undefined" && navigator.clipboard) {
        await navigator.clipboard.writeText(configJson);
        setCopied(true);
        setTimeout(() => setCopied(false), 1200);
      }
    } catch {
      setCopied(false);
    }
  }

  function handleDownload(): void {
    const blob = new Blob([configJson], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "req2rank.config.json";
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="hub-config-generator">
      <h2>{t(lang, "configGeneratorTitle")}</h2>
      <div className="hub-config-grid">
        <div className="hub-config-section">
          <h3>{t(lang, "configTargetTitle")}</h3>
          <label className="hub-field">
            <span>{t(lang, "configProvider")}</span>
            <input value={targetProvider} onChange={(event) => setTargetProvider(event.target.value)} />
          </label>
          <label className="hub-field">
            <span>{t(lang, "configModel")}</span>
            <input value={targetModel} onChange={(event) => setTargetModel(event.target.value)} />
          </label>
          <label className="hub-field">
            <span>{t(lang, "configApiKey")}</span>
            <input value={targetApiKey} onChange={(event) => setTargetApiKey(event.target.value)} />
          </label>
          <label className="hub-field">
            <span>{t(lang, "configBaseUrl")}</span>
            <input value={targetBaseUrl} onChange={(event) => setTargetBaseUrl(event.target.value)} />
          </label>
        </div>
        <div className="hub-config-section">
          <h3>{t(lang, "configSystemTitle")}</h3>
          <label className="hub-field">
            <span>{t(lang, "configProvider")}</span>
            <input value={systemProvider} onChange={(event) => setSystemProvider(event.target.value)} />
          </label>
          <label className="hub-field">
            <span>{t(lang, "configModel")}</span>
            <input value={systemModel} onChange={(event) => setSystemModel(event.target.value)} />
          </label>
          <label className="hub-field">
            <span>{t(lang, "configApiKey")}</span>
            <input value={systemApiKey} onChange={(event) => setSystemApiKey(event.target.value)} />
          </label>
          <label className="hub-field">
            <span>{t(lang, "configBaseUrl")}</span>
            <input value={systemBaseUrl} onChange={(event) => setSystemBaseUrl(event.target.value)} />
          </label>
        </div>
        <div className="hub-config-section">
          <div className="hub-flex-between">
            <h3>{t(lang, "configJudgeTitle")}</h3>
            <button
              type="button"
              className="hub-viz-button"
              onClick={() =>
                setJudges((current) => {
                  const next = [
                    ...current,
                    { provider: "openai", model: "gpt-4o", apiKey: "", baseUrl: "", weight: "1" }
                  ];
                  setActiveJudgeIndex(next.length - 1);
                  return next;
                })
              }
            >
              {t(lang, "configAddJudge")}
            </button>
          </div>
          <div className="hub-judge-tabs">
            {judges.map((_, index) => (
              <button
                key={`judge-tab-${index}`}
                type="button"
                className={`hub-judge-tab ${index === activeJudgeIndex ? "is-active" : ""}`}
                onClick={() => setActiveJudgeIndex(index)}
              >
                {index + 1}
              </button>
            ))}
          </div>
          {judges[activeJudgeIndex] ? (
            <div className="hub-judge-card">
              <div className="hub-flex-between">
                <strong>
                  {t(lang, "configJudgeLabel")} {activeJudgeIndex + 1}
                </strong>
                {judges.length > 1 ? (
                  <button
                    type="button"
                    className="hub-link-button"
                    onClick={() =>
                      setJudges((current) => {
                        const next = current.filter((_, currentIndex) => currentIndex !== activeJudgeIndex);
                        const nextIndex = Math.max(0, Math.min(activeJudgeIndex, next.length - 1));
                        setActiveJudgeIndex(nextIndex);
                        return next;
                      })
                    }
                  >
                    {t(lang, "configRemoveJudge")}
                  </button>
                ) : null}
              </div>
              <label className="hub-field">
                <span>{t(lang, "configProvider")}</span>
                <input
                  value={judges[activeJudgeIndex].provider}
                  onChange={(event) =>
                    setJudges((current) =>
                      current.map((item, currentIndex) =>
                        currentIndex === activeJudgeIndex ? { ...item, provider: event.target.value } : item
                      )
                    )
                  }
                />
              </label>
              <label className="hub-field">
                <span>{t(lang, "configModel")}</span>
                <input
                  value={judges[activeJudgeIndex].model}
                  onChange={(event) =>
                    setJudges((current) =>
                      current.map((item, currentIndex) =>
                        currentIndex === activeJudgeIndex ? { ...item, model: event.target.value } : item
                      )
                    )
                  }
                />
              </label>
              <label className="hub-field">
                <span>{t(lang, "configApiKey")}</span>
                <input
                  value={judges[activeJudgeIndex].apiKey}
                  onChange={(event) =>
                    setJudges((current) =>
                      current.map((item, currentIndex) =>
                        currentIndex === activeJudgeIndex ? { ...item, apiKey: event.target.value } : item
                      )
                    )
                  }
                />
              </label>
              <label className="hub-field">
                <span>{t(lang, "configBaseUrl")}</span>
                <input
                  value={judges[activeJudgeIndex].baseUrl}
                  onChange={(event) =>
                    setJudges((current) =>
                      current.map((item, currentIndex) =>
                        currentIndex === activeJudgeIndex ? { ...item, baseUrl: event.target.value } : item
                      )
                    )
                  }
                />
              </label>
              <label className="hub-field">
                <span>{t(lang, "configWeight")}</span>
                <input
                  value={judges[activeJudgeIndex].weight}
                  onChange={(event) =>
                    setJudges((current) =>
                      current.map((item, currentIndex) =>
                        currentIndex === activeJudgeIndex ? { ...item, weight: event.target.value } : item
                      )
                    )
                  }
                />
              </label>
            </div>
          ) : null}
        </div>
        <div className="hub-config-section">
          <h3>{t(lang, "configTestTitle")}</h3>
          <label className="hub-field">
            <span>{t(lang, "configComplexity")}</span>
            <select value={complexity} onChange={(event) => setComplexity(event.target.value)}>
              <option value="mixed">mixed</option>
              <option value="C1">C1</option>
              <option value="C2">C2</option>
              <option value="C3">C3</option>
              <option value="C4">C4</option>
            </select>
          </label>
          <label className="hub-field">
            <span>{t(lang, "configRounds")}</span>
            <input value={rounds} onChange={(event) => setRounds(event.target.value)} />
          </label>
          <label className="hub-field">
            <span>{t(lang, "configConcurrency")}</span>
            <input value={concurrency} onChange={(event) => setConcurrency(event.target.value)} />
          </label>
        </div>
        <div className="hub-config-section">
          <h3>{t(lang, "configHubTitle")}</h3>
          <label className="hub-field">
            <span>{t(lang, "configHubEnabled")}</span>
            <select value={hubEnabled ? "true" : "false"} onChange={(event) => setHubEnabled(event.target.value === "true")}>
              <option value="true">true</option>
              <option value="false">false</option>
            </select>
          </label>
          <label className="hub-field">
            <span>{t(lang, "configHubServerUrl")}</span>
            <input value={hubServerUrl} onChange={(event) => setHubServerUrl(event.target.value)} />
          </label>
          <label className="hub-field">
            <span>{t(lang, "configHubToken")}</span>
            <input value={hubToken} onChange={(event) => setHubToken(event.target.value)} />
          </label>
          <label className="hub-field hub-field-inline">
            <input
              type="checkbox"
              checked={includeToken}
              onChange={(event) => setIncludeToken(event.target.checked)}
            />
            <span>{t(lang, "configIncludeToken")}</span>
          </label>
        </div>
      </div>
      <div className="hub-config-actions">
        <button type="button" className="hub-viz-button" onClick={handleCopy}>
          {copied ? t(lang, "copied") : t(lang, "configCopy")}
        </button>
        <button type="button" className="hub-viz-button" onClick={handleDownload}>
          {t(lang, "configDownload")}
        </button>
      </div>
      <label className="hub-field">
        <span>{t(lang, "configPreview")}</span>
        <textarea className="hub-config-preview" rows={16} value={configJson} readOnly />
      </label>
    </div>
  );
}
