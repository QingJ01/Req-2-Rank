# API 参考

本页聚焦 Hub API 的请求/响应格式、认证方式和常见错误码。

## Base URL

- 生产环境：`https://r2r.byebug.cn`
- 本地开发：`http://localhost:3000`

## 响应包格式

多数内部接口返回统一 envelope：

```json
{
  "ok": true,
  "status": 200,
  "data": {}
}
```

失败时：

```json
{
  "ok": false,
  "status": 401,
  "error": {
    "code": "AUTH_ERROR",
    "message": "not authorized"
  }
}
```

## 认证方式

### 内部写接口（CLI 提交）

- 请求头：`Authorization: Bearer <R2R_HUB_TOKEN>`
- 可选：`x-actor-id`（未传时默认 `anonymous`）

### Public API

- `R2R_PUBLIC_API_KEY` 未配置：允许匿名访问。
- `R2R_PUBLIC_API_KEY` 已配置：请求头必须携带 `x-api-key: <key>`。

## 关键接口

### `POST /api/nonce`

申请一次性 nonce（提交前调用）。

Request:

```json
{
  "userId": "demo-user"
}
```

Response:

```json
{
  "ok": true,
  "status": 200,
  "data": {
    "nonce": "nonce-1730000000000-a1b2c3",
    "expiresAt": "2026-02-20T12:00:00.000Z"
  }
}
```

### `POST /api/submit`

提交评测结果。

Request（节选）：

```json
{
  "runId": "run-1",
  "nonce": "nonce-...",
  "targetProvider": "openai",
  "targetModel": "gpt-4o-mini",
  "complexity": "C2",
  "overallScore": 84.2,
  "ci95": [80.5, 88.0],
  "agreementLevel": "moderate",
  "dimensionScores": {
    "functionalCompleteness": 86,
    "codeQuality": 82,
    "logicAccuracy": 85,
    "security": 80,
    "engineeringPractice": 83
  },
  "submittedAt": "2026-02-20T10:00:00.000Z",
  "evidenceChain": {
    "timeline": [{ "phase": "generate", "startedAt": "...", "completedAt": "...", "model": "..." }],
    "samples": [{ "roundIndex": 0, "requirement": "...", "codeSubmission": "..." }],
    "environment": { "os": "linux", "nodeVersion": "v20.18.0", "timezone": "UTC" }
  }
}
```

Response:

```json
{
  "ok": true,
  "status": 200,
  "data": {
    "status": "accepted",
    "message": "Submission accepted: run-1"
  }
}
```

### `GET /api/leaderboard`

需要 Bearer token。支持查询参数：

- `limit`, `offset`, `sort=asc|desc`
- `complexity=C1|C2|C3|C4|mixed`
- `dimension=functionalCompleteness|codeQuality|logicAccuracy|security|engineeringPractice`
- `strategy=mean|best|latest`

### `GET /api/public/leaderboard`

公开排行榜接口，支持和内部 leaderboard 一致的筛选参数。

### `GET /api/public/model/:id`

公开模型详情接口，返回该模型提交历史。

### `POST /api/flag`

标记某次提交进入复验队列。

Request:

```json
{
  "runId": "run-1"
}
```

## 错误码

- `AUTH_ERROR`：认证失败（401）。
- `VALIDATION_ERROR`：请求参数、nonce、证据链校验失败（400）。
- `INTERNAL_ERROR`：未知服务端错误（500）。

## 联调建议

1. 先调 `POST /api/nonce`，确认 token 可用。
2. 再调 `POST /api/submit`，重点检查 `evidenceChain` 字段完整性。
3. 最后验证 `GET /api/leaderboard` 与 `GET /api/public/leaderboard` 的聚合和筛选一致性。
