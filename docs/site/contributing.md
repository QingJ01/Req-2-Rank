# 贡献指南

感谢你对 Req2Rank 的关注！无论是修复 Bug、改进文档还是提交新功能，我们都非常欢迎。

## 开发环境搭建

### 前置条件

- Node.js ≥ 18
- pnpm ≥ 9
- Git

### 初始化

```bash
git clone https://github.com/QingJ01/Req-2-Rank.git
cd Req-2-Rank
pnpm install
```

### 验证环境

```bash
pnpm typecheck    # TypeScript 类型检查
pnpm test         # 运行所有测试
```

---

## 项目结构

```
packages/
├── core/      # 评测引擎核心（pipeline, scoring, providers）
├── cli/       # req2rank 命令行工具
├── hub/       # Next.js 排行榜中枢
└── req2rank/  # npm 发布入口包
```

### 各包常用命令

| 包 | 测试 | 构建 |
|----|------|------|
| Core | `pnpm --filter @req2rank/core test` | `pnpm --filter @req2rank/core build` |
| CLI | `pnpm --filter @req2rank/cli test` | `pnpm --filter @req2rank/cli build` |
| Hub | `pnpm --filter @req2rank/hub test` | `pnpm --filter @req2rank/hub next:build` |
| Docs | — | `pnpm --dir docs/site build` |

---

## 仓库检查

提交 PR 前请确保通过以下检查：

```bash
# 仓库基线检查（文件结构、必要文件是否存在等）
pnpm check:baseline

# CLI 文档同步检查（确保 README 中的命令列表与实现一致）
pnpm check:cli-doc-sync
```

这些检查也会在 CI 中自动运行。

---

## PR 提交规范

### 代码要求

- **TypeScript**：所有代码使用 TypeScript，严格模式
- **测试**：行为变更必须补充或更新测试
- **KISS 原则**：保持简洁，避免过度设计

### 文档同步

以下变更需同步更新文档：

| 变更类型 | 需更新的文档 |
|---------|------------|
| CLI 命令行为变更 | `docs/site/guide.md`、`README.md` |
| API 路由变更 | `docs/site/api.md`、`docs/site/hub.md` |
| 配置项变更 | `docs/site/configuration.md` |
| 评分逻辑变更 | `docs/site/scoring-methodology.md` |

### Commit 格式

推荐使用语义化 Commit Message：

```
feat(core): add sandbox timeout configuration
fix(hub): correct CI95 calculation for single judge
docs: update getting-started guide
```

---

## 发布流程

详见 `docs/release-runbook.md`。
