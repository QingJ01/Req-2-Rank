# Hub 排行榜

Hub 是 Req2Rank 的中心化排行榜服务，接收评测提交、执行诚信验证、维护公开排行榜。

## 线上地址

| 入口 | 地址 |
|------|------|
| 排行榜首页 | [https://req2rank.top](https://req2rank.top) |
| GitHub OAuth 登录 | [https://req2rank.top/api/auth/github?action=login](https://req2rank.top/api/auth/github?action=login) |

---

## 页面入口

| 路径 | 说明 |
|------|------|
| `/` | 排行榜首页 — 所有模型排名、趋势图、分段筛选 |
| `/model/:id` | 模型详情页 — 该模型的历史提交、维度得分、CI 图表 |
| `/submission/:id` | 提交详情页 — 单次提交的完整数据、证据链、评审明细 |
| `/workbench` | 实时监控 — 正在进行的评测进度、时间线回放 |
| `/auth` | 登录/会话管理 |
| `/admin` | 管理后台 — 复验队列、举报处理 |

---

## 一键获取 CLI 配置

登录后可在 `/auth` 页面直接点击 **下载 `req2rank.config.json`**（等价接口：`/api/auth/github?action=cli-config`），文件会自动写入当前会话的 Hub Token，并启用 Hub：

```json
{
  "hub": {
    "enabled": true,
    "serverUrl": "https://req2rank.top",
    "token": "<your-token>"
  }
}
```

如果你已有本地配置，建议把下载文件中的 `hub` 字段合并到现有 `req2rank.config.json`，避免覆盖你的模型与评测参数。

---

## 提交流程

从 CLI 到排行榜的完整提交链路：

```
CLI: req2rank submit --latest
        │
        ├─ 1. 向 Hub 申请一次性 Nonce
        │      POST /api/nonces
        │
        ├─ 2. 组装证据包
        │      含：评测结果 + 时间线 + 抽样数据 + 环境指纹
        │
        └─ 3. 提交证据包
               POST /api/submissions
                    │
                    ├─ 验证 Nonce 有效性
                    ├─ 验证时间线合理性
                    ├─ 统计异常检测
                    ├─ 写入数据库
                    └─ 更新排行榜
```

### 证据包内容

| 组成部分 | 说明 |
|---------|------|
| **Nonce** | 评测前从 Hub 申请的一次性令牌，绑定用户身份 |
| **评测结果** | 综合分、各维度分、CI95、IJA 一致性分析 |
| **时间线** | 每个阶段（generate/execute/evaluate/score）的起止时间与 Token 消耗 |
| **抽样数据** | 随机 1-2 轮的完整需求原文 + 代码产出 + 评审原始响应 |
| **环境指纹** | 操作系统、Node 版本、时区 |

---

## 防作弊机制

由于评测在用户本地运行，无法完全杜绝作弊。Hub 采用多层验证策略，核心目标：**让作弊可被发现，让诚实可被证明**。

| 层级 | 机制 | 说明 |
|------|------|------|
| L1 | **身份关联** | GitHub OAuth 登录，作弊关联真实身份 |
| L2 | **Server Nonce** | 一次性令牌，有效期 2h，防止离线伪造 |
| L3 | **时序验证** | 检查各阶段时间戳是否合理（如 C3 执行不可能 < 1s） |
| L4 | **统计检测** | CI 过窄（全一致）或全 100 分触发异常标记 |
| L5 | **抽样复验** | 对高分/可疑提交用 Hub 自有 API Key 重放评测 |
| L6 | **社区举报** | 公开审计数据，社区可标记可疑提交 |
| L7 | **限频** | 每用户每天 ≤ 10 次提交 |

### 验证状态

| 状态 | 含义 |
|------|------|
| `pending` | 未验证，待复验 |
| `verified` ✅ | 复验通过，分差 ≤ 15 分 |
| `disputed` ⚠️ | 复验不通过或被举报，降权展示 |

---

## 本地开发 Hub

### 环境准备

1. 设置环境变量：

```bash
# .env（packages/hub/.env）
R2R_DATABASE_URL=postgresql://...   # PostgreSQL 连接串
R2R_HUB_TOKEN=your-secret-token     # Hub API 认证令牌
R2R_GITHUB_CLIENT_ID=...            # GitHub OAuth App Client ID
R2R_GITHUB_CLIENT_SECRET=...        # GitHub OAuth App Secret
R2R_GITHUB_REDIRECT_URI=http://localhost:3000/api/auth/github
R2R_GITHUB_OAUTH_GC_INTERVAL_MS=600000  # OAuth 会话 GC 间隔（ms，0 表示关闭）
```

2. 执行数据库迁移：

```bash
pnpm --filter @req2rank/hub db:migrate
```

3. 启动 Hub 开发服务器：

```bash
pnpm --filter @req2rank/hub next:dev
```

4. 访问 `http://localhost:3000` 查看排行榜。

### 联调 CLI → Hub

在 `req2rank.config.json` 中配置本地 Hub：

```json
{
  "hub": {
    "enabled": true,
    "serverUrl": "http://localhost:3000",
    "token": "<与 R2R_HUB_TOKEN 相同>"
  }
}
```

然后运行评测并提交：

```bash
req2rank run --complexity C2 --rounds 1
req2rank submit --latest
req2rank leaderboard
```

---

## 管理员

### 权限配置

- 默认管理员 GitHub 账号：`QingJ01`
- 通过环境变量 `R2R_ADMIN_GITHUB_LOGIN` 覆盖（支持逗号分隔多个账号）
- 管理员操作使用 CSRF 校验（`x-csrf-token` + `r2r_admin_csrf` Cookie）

### 复验模式

| 模式 | 触发方式 |
|------|---------|
| 自动模式 | `R2R_REVERIFY_MODE=auto`，通过 Vercel Cron（`x-vercel-cron`）自动触发 |
| 手动模式 | `POST /api/reverification/process` + `x-reverify-secret` 请求头 |

---

## 生产部署验证

部署后建议检查以下项目：

```bash
# 1. 公开排行榜接口正常
curl https://req2rank.top/api/public/leaderboard

# 2. OAuth 登录链接正确
curl https://req2rank.top/api/auth/github?action=login
# 确认 authUrl 的 redirect_uri 与 R2R_GITHUB_REDIRECT_URI 一致

# 3. 受保护接口未认证时返回 401
curl -s -o /dev/null -w "%{http_code}" https://req2rank.top/api/leaderboard/all
# 应返回 401
```
