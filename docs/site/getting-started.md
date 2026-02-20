# 快速开始

本指南将带你从零完成：安装环境 → 配置 API Key → 运行首次评测 → 查看报告 → 提交排行榜。

## 前置条件

| 依赖 | 版本要求 | 说明 |
|------|---------|------|
| **Node.js** | ≥ 18 | 运行时环境 |
| **LLM API Key** | — | 至少需要 1 个被测模型 + 1 个系统模型 + 1 个评审模型的 API Key |

> **提示**：你可以用同一个 API Key 同时充当系统模型和评审模型（例如只有 OpenAI Key 时，三者均填同一个 Key）。

## 第一步：安装

```bash
# 全局安装（推荐）
npm install -g req2rank

# 或免安装直接运行（用 npx 替代下文所有 req2rank 命令）
npx req2rank
```

安装完成后，终端中即可直接使用 `req2rank` 命令。

## 第二步：初始化配置

```bash
req2rank init
```

这将在当前目录生成 `req2rank.config.json`。打开它，填入你的 API Key：

```jsonc
{
  // 被测模型 —— 你要评测的 LLM
  "target": {
    "provider": "openai",          // openai | anthropic | google | custom
    "model": "gpt-4o-mini",
    "apiKey": "sk-your-key"        // 也可用环境变量 $R2R_TARGET_API_KEY
  },

  // 系统模型 —— 用于生成评测需求
  "systemModel": {
    "provider": "anthropic",
    "model": "claude-sonnet-4-20250514",
    "apiKey": "sk-ant-your-key"
  },

  // 评审团 —— 多模型交叉评审（至少 1 个，推荐 2-3 个）
  "judges": [
    { "provider": "openai", "model": "gpt-4o", "apiKey": "sk-your-key", "weight": 1 }
  ],

  // 评测参数
  "test": {
    "complexity": "C2",            // C1 | C2 | C3 | C4 | mixed
    "rounds": 1,                   // 评测轮数
    "concurrency": 1               // 并发数
  },

  // 排行榜配置（暂不启用）
  "hub": {
    "enabled": false
  }
}
```

> 详细的字段说明请参阅 [配置说明](/configuration)。

## 第三步：运行首次评测

```bash
req2rank run
```

你将看到类似以下输出：

```
[generate] Round 1/1 — Generating requirement...
[execute]  Round 1/1 — Executing code generation...
[evaluate] Round 1/1 — Evaluating with 1 judge(s)...
[score]    Round 1/1 — Computing scores...
Run completed: run-20260220-143000
Overall score: 82.5  CI95: [78.1, 86.9]
```

评测完成！结果已自动保存到本地 SQLite 数据库（`.req2rank/runs.db`）。

## 第四步：查看结果

### 查看历史记录

```bash
req2rank history
```

输出所有本地评测记录的摘要。

### 查看详细报告

```bash
req2rank report <run-id>
```

显示某次评测的完整报告，包括：
- 总分与 95% 置信区间
- 各维度得分（功能完整性 / 代码质量 / 逻辑准确性 / 安全性 / 工程实践）
- 评审一致性（IJA）分析
- 每轮评测的需求与得分明细

### 导出报告

```bash
req2rank export --latest --format markdown
```

将最近一次评测导出为 Markdown 文件（默认保存到 `.req2rank/exports/`）。

## 第五步（可选）：多模型对比

```bash
req2rank compare --targets openai/gpt-4o-mini,anthropic/claude-sonnet-4-20250514 --rounds 3
```

该命令会以相同的需求分别评测多个模型，生成对比报告。

## 第六步（可选）：提交到排行榜

1. 在 [req2rank.top](https://req2rank.top) 通过 GitHub 登录获取 Token。

2. 编辑 `req2rank.config.json`，启用 Hub：

```json
{
  "hub": {
    "enabled": true,
    "serverUrl": "https://req2rank.top",
    "token": "<your-token>"
  }
}
```

3. 提交最近一次评测：

```bash
req2rank submit --latest
```

4. 查看排行榜：

```bash
req2rank leaderboard
```

恭喜！你已完成从零到排行榜提交的全部流程。接下来可以继续阅读：

- [使用指南](/guide) — 了解所有 CLI 命令的进阶用法
- [配置说明](/configuration) — 深入了解配置项与环境变量
- [评分方法](/scoring-methodology) — 理解分数是如何计算的

## 常见问题

### API Key 相关

| 错误信息 | 解决方式 |
|---------|---------|
| `provider "xxx" is not supported` | 检查 `provider` 拼写，支持的值：`openai`、`anthropic`、`google`、`custom` |
| `401 Unauthorized` | 检查 API Key 是否有效 |
| `429 Rate Limit` | 降低 `concurrency` 或等待后重试 |

### Hub 提交相关

| 错误信息 | 解决方式 |
|---------|---------|
| `Hub is enabled but serverUrl/token is missing` | 在配置文件中补齐 `hub.serverUrl` 和 `hub.token` |
| `daily submission limit exceeded` | 已达每日上限（10 次），次日重试 |
| `nonce expired` | Nonce 有效期 2 小时，CLI `submit` 会自动申请新 Nonce |
