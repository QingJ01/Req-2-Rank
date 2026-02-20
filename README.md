# Req-2-Rank

**开源 AI 编码能力评测框架** — 动态需求生成 · 多模型陪审团评审 · 社区驱动排行榜

[![MIT License](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/Node.js-18%2B-brightgreen.svg)](#技术栈)
[![Hub](https://img.shields.io/badge/Live%20Hub-req2rank.top-0ea5e9.svg)](https://req2rank.top)

---

## 它解决什么问题？

现有 LLM 编码评测普遍依赖**固定题库**，面临训练集泄漏、难度分布不均和维度单一等问题。

Req-2-Rank 的策略：

| 特性 | 实现方案 |
|------|----------|
| **杜绝数据泄漏** | 每次运行由 LLM 动态生成全新需求，无固定题库 |
| **去评审偏见** | 多模型陪审团（LLM-as-a-Judge）交叉评审，附带一致性分析与 95% 置信区间 |
| **开源自部署** | 用户用自己的 API Key 在本地运行，零外部服务依赖（仅需 LLM API） |
| **社区排行榜** | 评测结果可提交至中心 Hub，含 Nonce 防伪 + 抽样复验机制 |

---

## 架构概览

```
┌─────────────────────────────────────────────────────┐
│               用户侧（开源 CLI）                      │
│                                                     │
│   CLI ──→ Pipeline Orchestrator                     │
│             ├── Requirement Generator (动态出题)     │
│             ├── Execution Engine     (代码生成)      │
│             ├── Evaluation Panel     (多模型评审)    │
│             └── Scoring Engine       (统计与计分)    │
│                     │                               │
│                     ▼                               │
│              Local Report / Submit ──→ Hub          │
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│           排行榜中枢（Leaderboard Hub）               │
│                                                     │
│   Submission API → Integrity Verifier → Leaderboard │
│   GitHub OAuth   → Public Web + REST API            │
└─────────────────────────────────────────────────────┘
```

---

## 仓库结构

```
Req-2-Rank/
├── packages/
│   ├── core/          # 评测流水线引擎、评分、Provider 适配层
│   ├── cli/           # `req2rank` 命令行工具
│   ├── hub/           # Next.js 排行榜中枢（API + Web + Workbench）
│   └── req2rank/      # npm 发布入口包
├── docs/site/         # VitePress 文档站
├── examples/          # 配置文件示例
└── scripts/           # 仓库检查脚本
```

---

## 快速开始

### 环境要求

- **Node.js** ≥ 18

### 安装

```bash
# 全局安装
npm install -g req2rank

# 或免安装直接运行
npx req2rank
```

### 初始化配置

```bash
req2rank init
```

这将在当前目录生成 `req2rank.config.json`，填入你的 API Key 即可：

```jsonc
{
  "target":      { "provider": "openai",    "model": "gpt-4o-mini",          "apiKey": "$R2R_TARGET_API_KEY" },
  "systemModel": { "provider": "anthropic", "model": "claude-sonnet-4-20250514", "apiKey": "$R2R_SYSTEM_API_KEY" },
  "judges": [
    { "provider": "openai", "model": "gpt-4o", "apiKey": "$R2R_JUDGE_OPENAI_API_KEY", "weight": 1 }
  ],
  "test": { "complexity": "mixed", "rounds": 1, "concurrency": 1 },
  "hub":  { "enabled": false }
}
```

> **配置优先级**：CLI 参数 > 环境变量 > 配置文件 > 默认值

### 运行评测

```bash
# 基础运行
req2rank run

# 指定模型和难度
req2rank run --target openai/gpt-4o --complexity C2 --rounds 3

# 多模型对比
req2rank compare --targets openai/gpt-4o,anthropic/claude-sonnet-4-20250514
```

---

## CLI 命令速查

<!-- cli-commands:start -->
| 命令 | 用途 |
|------|------|
| `req2rank init` | 初始化配置文件 |
| `req2rank run [--target] [--complexity] [--rounds]` | 执行评测 |
| `req2rank compare --targets <models> [--complexity] [--rounds]` | 多模型对比 |
| `req2rank history [--output text\|json]` | 查看本地评测记录 |
| `req2rank report <runId> [--markdown] [--template] [--out]` | 生成评测报告 |
| `req2rank export [runId] [--latest] [--format] [--out]` | 导出评测数据 |
| `req2rank submit [runId] [--latest]` | 提交到排行榜 |
| `req2rank leaderboard [--limit] [--sort] [--output]` | 查看排行榜 |
| `req2rank calibrate [--write]` | 难度自适应校准 |
| `req2rank sandbox [--image] [--command]` | 沙箱测试 |
<!-- cli-commands:end -->

---

## 评测流水线

每次 `req2rank run` 按以下流程执行：

```
1. Generate  ─  LLM 动态生成需求（能力矩阵 × 领域场景 × 种子变异，三阶段 Prompt Pipeline）
2. Execute   ─  将需求发给被测模型，获取代码产出
3. Evaluate  ─  多个评审模型独立打分（5 维度 × N 评审员）
4. Score     ─  统计加权均值、评审一致性（IJA）、95% 置信区间
```

**评分维度**：

| 维度 | 权重 | 说明 |
|------|------|------|
| 功能完整性 | 30% | 是否实现所有功能点 |
| 代码质量 | 25% | 命名、结构、可读性 |
| 逻辑准确性 | 25% | 算法正确、边界处理 |
| 安全性 | 10% | 注入漏洞、硬编码秘钥 |
| 工程实践 | 10% | 错误处理、文档、测试 |

**复杂度等级**：

| 等级 | 说明 | 约束 |
|------|------|------|
| C1 `atomic` | 单一功能点 | 1 个文件、1 个函数 |
| C2 `composed` | 2-3 个功能点组合 | 1-2 个文件 |
| C3 `integrated` | 多功能协作 | 多文件、模块边界 |
| C4 `architectural` | 完整应用架构 | 前后端分离 |

---

## 排行榜中枢（Hub）

- **线上地址**：[https://req2rank.top](https://req2rank.top)
- **OAuth 登录**：GitHub 认证，提交分数关联真实身份
- **防作弊**：Server Nonce + 时序验证 + 统计异常检测 + 异步抽样复验

### 本地开发

```bash
pnpm --filter @req2rank/hub next:dev
```

---

## 技术栈

| 层次 | 选型 |
|------|------|
| 语言 | TypeScript (Node.js) |
| CLI | Commander.js |
| 本地存储 | SQLite (better-sqlite3) + Drizzle ORM |
| LLM 适配 | OpenAI / Anthropic / Google / 自定义兼容 API |
| 配置校验 | Zod |
| Hub 框架 | Next.js (App Router) |
| Hub 数据库 | PostgreSQL + Drizzle |
| 认证 | GitHub OAuth |

---

## 文档

| 主题 | 路径 |
|------|------|
| 文档首页 | `docs/site/index.md` |
| 入门指南 | `docs/site/getting-started.md` |
| 配置说明 | `docs/site/configuration.md` |
| 评分方法 | `docs/site/scoring-methodology.md` |
| Hub API | `docs/site/hub.md` |
| 贡献指南 | `docs/site/contributing.md` |
| Hub 部署 | `docs/hub-deployment.md` |
| 发布流程 | `docs/release-runbook.md` |

---

## 开发与检查

```bash
pnpm typecheck          # 类型检查
pnpm test               # 运行所有测试
pnpm check:baseline     # 仓库基线检查
pnpm check:cli-doc-sync # CLI 文档同步检查
```

---

## 许可证

[MIT](LICENSE)
