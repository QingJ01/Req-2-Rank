export const DOMAIN_TAXONOMY = {
  ecommerce: ["product-search", "cart", "coupon-pricing", "inventory", "order-state-machine"],
  social: ["feed", "comment-thread", "notification-fanout", "friend-graph", "content-moderation"],
  finance: ["ledger", "fx-conversion", "risk-rules", "statement-reporting", "reconciliation"],
  developerTools: ["cli-tool", "config-parser", "log-analysis", "code-formatting", "mock-server"],
  dataAnalytics: ["data-cleaning", "aggregation", "viz-prep", "etl-pipeline", "anomaly-detection"],
  iot: ["sensor-ingestion", "protocol-parser", "alert-engine", "device-state", "firmware-rollout"],
  gaming: ["game-loop", "collision-check", "scoreboard", "save-system", "level-generation"],
  utilities: ["file-converter", "cache-layer", "task-scheduler", "markdown-rendering", "rule-engine"]
} as const;

export type DomainName = keyof typeof DOMAIN_TAXONOMY;

export const DOMAIN_NAMES = Object.keys(DOMAIN_TAXONOMY) as DomainName[];
