# Hub 部署指南

## 当前生产环境

- 基础地址：`https://req2rank.top`
- 部署平台：Vercel
- 数据库：PostgreSQL（`r2r`）

## 环境变量

- 基础变量
  - `R2R_DATABASE_URL`：PostgreSQL 连接串。
  - `R2R_HUB_TOKEN`：仅在非 OAuth 模式下使用的 Bearer Token。
- OAuth 变量（启用 GitHub OAuth 会话模式）
  - `R2R_GITHUB_OAUTH=true`
  - `R2R_GITHUB_CLIENT_ID`
  - `R2R_GITHUB_CLIENT_SECRET`
  - `R2R_GITHUB_REDIRECT_URI`（推荐 `https://<domain>/api/auth/github`）
  - `R2R_ADMIN_GITHUB_LOGIN`（可选，覆盖默认管理员 `QingJ01`）
- 提交限频
  - `R2R_DAILY_SUBMISSION_LIMIT=20`（每个 actor 每日提交上限，未设置默认 20）
- 异步复验入口密钥
  - `R2R_REVERIFY_SECRET`：调用 `/api/reverification/process` 时请求头 `x-reverify-secret` 必须匹配
- 复验重放 LLM 变量（全部必填）
  - `R2R_REVERIFY_TARGET_API_KEY`
  - `R2R_REVERIFY_TARGET_BASE_URL`（可选，仅自定义 OpenAI 兼容端点时填写）
  - `R2R_REVERIFY_SYSTEM_PROVIDER`
  - `R2R_REVERIFY_SYSTEM_MODEL`
  - `R2R_REVERIFY_SYSTEM_API_KEY`
  - `R2R_REVERIFY_JUDGE_PROVIDER`
  - `R2R_REVERIFY_JUDGE_MODEL`
  - `R2R_REVERIFY_JUDGE_API_KEY`

## 本地运行

1. 复制 `packages/hub/.env.example` 为 `.env`。
2. 按部署模式配置变量：
   - OAuth 模式：设置 `R2R_GITHUB_OAUTH=true` + GitHub OAuth 变量
   - Bearer 模式：设置 `R2R_HUB_TOKEN`
3. 设置 `R2R_DAILY_SUBMISSION_LIMIT=20`（或你希望的值）。
4. 配置复验重放 LLM 变量（见上文）。
5. 运行 `pnpm --filter @req2rank/hub db:migrate` 创建/升级数据表。
6. 运行 `pnpm --filter @req2rank/hub test` 验证路由。
7. 使用 `x-reverify-secret` 调用 `/api/reverification/process` 触发复验 Worker。

## 生产部署检查清单

1. 在部署平台配置 PostgreSQL（`R2R_DATABASE_URL`）和网络访问策略。
2. 二选一配置认证模式：
   - OAuth 模式：`R2R_GITHUB_OAUTH=true` + GitHub OAuth 4 个变量（可选 `R2R_ADMIN_GITHUB_LOGIN`）
   - Bearer 模式：`R2R_HUB_TOKEN`
3. 配置 `R2R_DAILY_SUBMISSION_LIMIT=20`。
4. 配置 `R2R_REVERIFY_SECRET` 与复验重放 LLM 变量（8 个）。
5. 发布时执行 `pnpm --filter @req2rank/hub db:migrate`（确保 `hub_submissions` 有 `actor_id`/`evidence_chain` 列）。
6. 部署前执行 `pnpm --filter @req2rank/hub typecheck && pnpm --filter @req2rank/hub test`。
7. 对外暴露 `/api/nonce`、`/api/submit`、`/api/leaderboard`、`/api/model/:id`、`/api/submission/:id`、`/api/flag`、`/api/auth/github`。
8. 配置定时任务周期性调用 `/api/reverification/process`。

## OAuth 回调检查清单

1. 在 Vercel 中将 `R2R_GITHUB_REDIRECT_URI` 设为 `https://req2rank.top/api/auth/github`。
2. 在 GitHub OAuth App 设置中填写同一个 Callback URL。
3. 更新环境变量后重新部署。
4. 验证 `GET /api/auth/github?action=login` 返回的 `authUrl` 中 `redirect_uri` 与上述地址一致。
5. 完成 OAuth 回调后，确认返回 `set-cookie: r2r_session=...`。
6. 使用回调响应中的 `sessionToken`（Bearer）访问受保护 API，确认 `200`。

## 复验重放 LLM 检查清单

1. 准备一条进入复验队列的提交（高分或人工 flag）。
2. 确认已配置全部 `R2R_REVERIFY_*` LLM 变量。
3. 用 `x-reverify-secret` 调用 `POST /api/reverification/process`。
4. 检查返回 `processed > 0`，并在提交详情中确认状态从 `pending` 更新为 `verified`/`disputed`。
5. 若全部变为 `disputed`，优先检查：API Key、Provider 名称、模型名、baseUrl 是否匹配。

## 每日限频检查清单（20）

1. 设置 `R2R_DAILY_SUBMISSION_LIMIT=20`。
2. 用同一 `actorId` 连续提交 20 次，预期都可接受。
3. 第 21 次提交预期返回 `400`，错误信息包含 `daily submission limit exceeded (20)`。
4. 次日（UTC 日期变更）再次提交，计数应重置。

## 部署后冒烟检查

每次生产部署后执行以下检查：

1. `GET https://req2rank.top/` 能渲染排行榜页面。
2. `GET https://req2rank.top/api/public/leaderboard` 返回 `200`。
3. `GET https://req2rank.top/api/auth/github?action=login` 返回 `200` 且包含 `authUrl`。
4. 不带 Bearer Token 请求 `GET https://req2rank.top/api/leaderboard` 返回 `401`。
5. 使用 `x-reverify-secret` 触发 `/api/reverification/process`，确认复验流程可执行。
6. 同一 actor 连续提交到上限后，确认第 21 次被拒绝。
