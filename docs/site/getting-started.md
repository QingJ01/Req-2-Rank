# 快速开始

本指南覆盖从安装到提交排行榜的完整闭环。

## 1) 环境准备

- Node.js 18+
- pnpm 9+
- 至少 1 个 target 模型 API Key
- 至少 1 个 judge 模型 API Key

安装依赖：

```bash
pnpm install
```

## 2) 构建与测试

```bash
pnpm typecheck
pnpm test
pnpm --filter @req2rank/cli build
```

如果你想验证完整本地构建（含 Hub Next 构建）：

```bash
pnpm build
```

## 3) 初始化配置

```bash
pnpm --filter @req2rank/cli build
node packages/cli/dist/index.js init
```

会在当前目录生成 `req2rank.config.json`。

最少需要补齐：

- `target.provider` / `target.model` / `target.apiKey`
- `systemModel.provider` / `systemModel.model` / `systemModel.apiKey`
- `judges[0].provider` / `judges[0].model` / `judges[0].apiKey`

## 4) 运行首轮评测

```bash
node packages/cli/dist/index.js run --complexity C2 --rounds 1
node packages/cli/dist/index.js history
```

成功后会看到 `Run completed: <run-id>`。

## 5) 查看和导出报告

```bash
node packages/cli/dist/index.js report <run-id>
node packages/cli/dist/index.js export --latest --format markdown
```

导出默认位置：`.req2rank/exports/`。

## 6) 可选：多模型对比

```bash
node packages/cli/dist/index.js compare --targets openai/gpt-4o-mini,anthropic/claude-sonnet-4-20250514 --complexity C2 --rounds 1
```

## 7) 提交到 Hub 并查看排行榜

在 `req2rank.config.json` 中启用：

```json
{
  "hub": {
    "enabled": true,
    "serverUrl": "https://r2r.byebug.cn",
    "token": "<your-token>"
  }
}
```

提交与查询：

```bash
node packages/cli/dist/index.js submit --latest
node packages/cli/dist/index.js leaderboard --output table
```

## 8) 常见问题

- `Hub is enabled but serverUrl/token is missing`：补齐 `hub.serverUrl` 与 `hub.token`。
- `daily submission limit exceeded`：超过每日提交上限，次日重试。
- `nonce ...` 错误：先重新请求 nonce（CLI `submit` 会自动处理），并避免长时间等待后再提交。
