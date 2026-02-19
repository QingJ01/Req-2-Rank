# 快速开始

## 环境要求

- Node.js 18+
- pnpm 9+

## 安装依赖

```bash
pnpm install
```

## 构建与验证

```bash
pnpm typecheck
pnpm test
pnpm --filter @req2rank/cli build
```

## 首次本地评测

```bash
req2rank init
req2rank run --complexity C2 --rounds 1
req2rank history
```

## 查看与导出结果

```bash
req2rank report <run-id>
req2rank export --latest --format markdown
```

## 提交到 Hub

```bash
req2rank submit --latest
req2rank leaderboard --output table
```

提交前请确认配置文件中已启用 Hub 配置项。
