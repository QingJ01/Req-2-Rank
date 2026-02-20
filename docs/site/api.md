# API 参考

本页是 Hub 全部 API 接口的技术参考，包含请求/响应格式、认证方式和错误码。

## Base URL

| 环境 | 地址 |
|------|------|
| 生产环境 | `https://req2rank.top` |
| 本地开发 | `http://localhost:3000` |

---

## 通用响应格式

所有接口返回统一的 envelope 结构：

**成功**：
```json
{
  "ok": true,
  "status": 200,
  "data": { ... }
}
```

**失败**：
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

---

## 认证方式

### Bearer Token（CLI 提交 / 内部接口）

```
Authorization: Bearer <R2R_HUB_TOKEN>
```

可选请求头 `x-actor-id` 用于标识提交者身份。未传时默认 `anonymous`。

### Public API Key（公开接口）

- 未配置 `R2R_PUBLIC_API_KEY`：允许匿名访问
- 已配置 `R2R_PUBLIC_API_KEY`：需携带 `x-api-key: <key>`

### GitHub OAuth Session（管理员）

通过 GitHub OAuth 登录获取 `r2r_session` Cookie，自动鉴权。

---

## 公开接口

以下接口不需要 Bearer Token（但可能需要 API Key）。

### `GET /api/public/leaderboard`

获取公开排行榜。

**查询参数**：

| 参数 | 类型 | 说明 |
|------|------|------|
| `limit` | `number` | 返回数量 |
| `offset` | `number` | 偏移量 |
| `sort` | `asc \| desc` | 排序方向 |
| `strategy` | `mean \| best \| latest` | 聚合策略 |
| `complexity` | `C1 \| C2 \| C3 \| C4 \| mixed` | 按复杂度筛选 |
| `dimension` | `string` | 按维度排序 |

**响应示例**：
```json
{
  "ok": true,
  "status": 200,
  "data": [
    {
      "rank": 1,
      "model": "openai/gpt-4o",
      "score": 88.5,
      "ci95": [85.2, 91.8],
      "verificationStatus": "verified",
      "submissionCount": 12
    }
  ]
}
```

### `GET /api/public/model/:id`

获取指定模型的详情（历史提交列表）。

### `GET /api/public/live/stream`

SSE 实时数据流（Workbench 使用）。

---

## 需认证接口

以下接口需要 `Authorization: Bearer <token>` 请求头。

### `POST /api/nonce`

申请一次性 Nonce（提交前调用）。

**请求体**：
```json
{
  "userId": "demo-user"
}
```

**响应**：
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

**Nonce 规则**：
- 有效期：2 小时
- 同一用户同时最多持有 3 个活跃 Nonce
- 使用后自动作废

### `POST /api/submit`

提交评测结果。

**请求体（核心字段）**：
```json
{
  "runId": "run-20260220-143000",
  "nonce": "nonce-1730000000000-a1b2c3",
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
    "timeline": [
      {
        "phase": "generate",
        "startedAt": "2026-02-20T09:50:00.000Z",
        "completedAt": "2026-02-20T09:50:15.000Z",
        "model": "claude-sonnet-4-20250514",
        "tokenUsage": { "prompt": 800, "completion": 1200 }
      }
    ],
    "samples": [
      {
        "roundIndex": 0,
        "requirement": "Build a REST API for...",
        "codeSubmission": "const express = require('express')..."
      }
    ],
    "environment": {
      "os": "linux",
      "nodeVersion": "v20.18.0",
      "timezone": "UTC"
    }
  }
}
```

**响应**：
```json
{
  "ok": true,
  "status": 200,
  "data": {
    "status": "accepted",
    "message": "Submission accepted: run-20260220-143000"
  }
}
```

### `GET /api/leaderboard`

内部排行榜接口，支持与公开接口一致的查询参数。

### `GET /api/submission/:id`

获取指定提交的详情（含证据链）。

### `POST /api/flag`

标记某次提交进入复验队列。

**请求体**：
```json
{
  "runId": "run-20260220-143000"
}
```

### `GET /api/reports`

获取待处理的举报列表。

### `POST /api/reverification/process`

触发复验流程。

---

## 管理员接口

需要管理员 Session + CSRF Token。

| 接口 | 说明 |
|------|------|
| `GET /api/admin/reports` | 获取管理员视角的举报列表 |
| `POST /api/admin/reports/resolve` | 处理举报（通过/驳回） |
| `GET /api/admin/reports/evidence` | 获取证据链详情 |

---

## 错误码

| 错误码 | HTTP 状态码 | 说明 |
|--------|-----------|------|
| `AUTH_ERROR` | 401 | Bearer Token 无效或缺失 |
| `VALIDATION_ERROR` | 400 | 请求参数校验失败、Nonce 无效、证据链不完整 |
| `INTERNAL_ERROR` | 500 | 服务端内部错误 |

---

## 联调清单

按以下顺序调试，可快速定位问题：

1. **`POST /api/nonce`** — 验证 Token 可用，确认 Nonce 正常返回
2. **`POST /api/submit`** — 重点检查 `evidenceChain` 字段的完整性
3. **`GET /api/public/leaderboard`** — 确认提交数据已在排行榜中生效
4. **`GET /api/submission/:id`** — 检查详情页数据是否完整
