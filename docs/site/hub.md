# Hub API 与页面

本页用于说明当前可用的 Hub 接口与页面入口。

## 生产环境地址

- 基础地址：`https://r2r.byebug.cn`
- 部署平台：Vercel

## 公共 API 接口

- `GET /api/public/leaderboard`
- `GET /api/public/model/:id`

## 需要鉴权的 Hub 接口

- `POST /api/nonce`
- `POST /api/submit`
- `GET /api/leaderboard`
- `GET /api/model/:id`
- `GET /api/submission/:id`
- `POST /api/flag`
- `GET /api/reports`
- `POST /api/reverification/process`

## Hub 页面入口

- `/` 排行榜首页
- `/model/:id` 模型详情页
- `/submission/:id` 提交详情页
- `/workbench` 实时监控与时间线回放
- `/admin` 管理后台

## 本地最小闭环流程

1. 为 Hub 设置 `R2R_HUB_TOKEN` 与 `R2R_DATABASE_URL`。
2. 执行迁移：`pnpm --filter @req2rank/hub db:migrate`。
3. 启动 Hub 页面与 API 服务：`pnpm --filter @req2rank/hub next:dev`。
4. 在 CLI 配置中设置：
   - `hub.enabled = true`
   - `hub.serverUrl = http://localhost:3000`
   - `hub.token = <与 R2R_HUB_TOKEN 相同>`
5. 执行命令：
   - `req2rank run --complexity C2 --rounds 1`
   - `req2rank submit --latest`
   - `req2rank leaderboard`

如果启用了复验流程，请使用配置的密钥请求头触发 `/api/reverification/process`。

## 生产环境验证

生产部署后建议至少验证以下项目：

1. `GET https://r2r.byebug.cn/api/public/leaderboard` returns `200`.
2. `GET https://r2r.byebug.cn/api/auth/github?action=login` returns `authUrl`.
3. The `authUrl` must include `redirect_uri=https://r2r.byebug.cn/api/auth/github`.
4. 受保护接口（如 `/api/leaderboard`）在未提供 Bearer Token 时返回 `401`。

## OAuth 配置说明

- Vercel 中的 `R2R_GITHUB_REDIRECT_URI` 必须与 GitHub OAuth Callback URL 完全一致。
- 若回调地址变更，更新环境变量后需要重新部署。
