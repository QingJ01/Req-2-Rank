# Req-2-Rank

Req-2-Rank 是一个面向代码模型评测的开源基准框架，支持动态需求生成、多评审模型打分、置信区间统计，以及社区排行榜提交流程。

## 仓库结构

- `packages/core`：评测流水线引擎、评分逻辑、持久化与模型 Provider 适配层。
- `packages/cli`：`req2rank` 命令行工具实现。
- `packages/hub`：基于 Next.js 的排行榜中枢（API + Web 页面，内置可视化 Workbench）。
- `docs/site`：VitePress 文档站。
- `examples`：示例配置文件。

## 快速开始

```bash
pnpm install
pnpm typecheck
pnpm test
pnpm --filter @req2rank/cli build
```

初始化配置并执行一次本地评测：

```bash
req2rank init
req2rank run --complexity C2 --rounds 1
req2rank history
```

## CLI 命令

<!-- cli-commands:start -->
- `req2rank init`
- `req2rank run [--target <provider/model>] [--complexity <C1|C2|C3|C4|mixed>] [--rounds <count>]`
- `req2rank compare --targets <provider/model,...> [--complexity <level>] [--rounds <count>]`
- `req2rank history [--output <text|json>]`
- `req2rank report <runId> [--markdown] [--template <default|compact>] [--out <filePath>]`
- `req2rank export [runId] [--latest] [--format <markdown|json>] [--template <default|compact>] [--out <filePath>]`
- `req2rank submit [runId] [--latest]`
- `req2rank leaderboard [--limit <count>] [--offset <count>] [--sort <asc|desc>] [--output <text|table|json>]`
- `req2rank calibrate [--write]`
- `req2rank sandbox [--image <image>] [--command <command>]`
<!-- cli-commands:end -->

## Docs

- 文档首页：`docs/site/index.md`
- 入门指南：`docs/site/getting-started.md`
- 配置说明：`docs/site/configuration.md`
- 评分方法：`docs/site/scoring-methodology.md`
- Hub API 与页面：`docs/site/hub.md`
- 贡献指南：`docs/site/contributing.md`

## 线上 Hub

- 生产地址：`https://r2r.byebug.cn`
- OAuth 登录入口：`https://r2r.byebug.cn/api/auth/github?action=login`

## 开发检查

```bash
pnpm check:baseline
pnpm check:cli-doc-sync
```

## 许可证

MIT，详见 `LICENSE`。
