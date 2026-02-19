# 贡献指南

## 开发环境准备

```bash
pnpm install
pnpm typecheck
pnpm test
```

## 仓库基线检查

```bash
pnpm check:baseline
pnpm check:cli-doc-sync
```

## 各包常用命令

- Core：`pnpm --filter @req2rank/core test`
- CLI：`pnpm --filter @req2rank/cli test`
- Hub：`pnpm --filter @req2rank/hub test`
- Docs：`pnpm --dir docs/site build`

## Pull Request 说明

- 保持 `plan.md` 与实际实现行为一致。
- 行为变更必须补充或更新测试。
- 命令行为或 API 路由变更时，请同步更新 `docs/site/*` 文档。
