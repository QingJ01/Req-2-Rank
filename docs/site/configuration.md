# 配置说明

Req2Rank 通过当前工作目录下的 `req2rank.config.json` 进行配置。可通过 `req2rank init` 自动生成默认配置文件。

## 完整配置示例

```jsonc
{
  // ─── 被测模型 ───
  "target": {
    "provider": "openai",
    "model": "gpt-4o-mini",
    "apiKey": "",                    // 可用环境变量替代
    "baseUrl": null                  // 可选；azure-openai/newapi 必填
  },

  // ─── 系统模型（需求生成） ───
  "systemModel": {
    "provider": "anthropic",
    "model": "claude-sonnet-4-20250514",
    "apiKey": ""
  },

  // ─── 评审团 ───
  "judges": [
    { "provider": "openai",    "model": "gpt-4o",                  "apiKey": "", "weight": 1.0 },
    { "provider": "anthropic", "model": "claude-sonnet-4-20250514", "apiKey": "", "weight": 1.2 }
  ],

  // ─── 评测参数 ───
  "test": {
    "complexity": "mixed",
    "rounds": 3,
    "concurrency": 1
  },

  // ─── 排行榜提交 ───
  "hub": {
    "enabled": false,
    "serverUrl": "https://req2rank.top",
    "token": ""
  }
}
```

---

## 字段详解

### `target` — 被测模型

你要评测的 LLM。

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `provider` | `string` | ✅ | 接口类型：`openai` / `openai-response` / `gemini` / `anthropic` / `azure-openai` / `newapi` |
| `model` | `string` | ✅ | 模型名称（如 `gpt-4o-mini`） |
| `apiKey` | `string` | — | API 密钥，留空时从环境变量读取 |
| `baseUrl` | `string \| null` | 条件必填 | `azure-openai`、`newapi` 时必填；其他类型可省略（默认官方端点） |

**接口类型说明**：

| `provider` 值 | 默认端点（未配置 `baseUrl` 时） | 备注 |
|------|------|------|
| `openai` | `https://api.openai.com/v1/chat/completions` | OpenAI Chat Completions |
| `openai-response` | `https://api.openai.com/v1/responses` | OpenAI Responses API |
| `gemini` | `https://generativelanguage.googleapis.com/v1beta` | Gemini 原生接口 |
| `anthropic` | `https://api.anthropic.com/v1/messages` | Anthropic 原生接口 |
| `azure-openai` | 无默认（必须配置） | 需填 Azure 资源地址 |
| `newapi` | 无默认（必须配置） | 需填中转站地址（例如 `https://xxx.com/v1`） |

**baseUrl 使用场景**：

```jsonc
// 本地 Ollama
"target": {
  "provider": "newapi",
  "model": "llama3",
  "baseUrl": "http://localhost:11434/v1"
}
```

```jsonc
// Azure OpenAI（baseUrl 必填）
"target": {
  "provider": "azure-openai",
  "model": "gpt-4o-mini",
  "baseUrl": "https://YOUR_RESOURCE_NAME.openai.azure.com/openai/deployments/YOUR_DEPLOYMENT_NAME"
}
```

```jsonc
// NewAPI 中转 + Responses API
"target": {
  "provider": "openai-response",
  "model": "gpt-4o",
  "baseUrl": "https://your-newapi.com/v1"
}
```

### `systemModel` — 系统模型

用于需求生成的 LLM。建议使用能力较强的模型以保证出题质量。

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `provider` | `string` | ✅ | 模型提供商 |
| `model` | `string` | ✅ | 模型名称 |
| `apiKey` | `string` | — | API 密钥 |
| `baseUrl` | `string \| null` | 条件必填 | `azure-openai`、`newapi` 时必填 |

### `judges` — 评审团

评审模型列表。至少配置 1 个，推荐 2-3 个以获得可靠的一致性分析。

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `provider` | `string` | ✅ | 模型提供商 |
| `model` | `string` | ✅ | 模型名称 |
| `apiKey` | `string` | — | API 密钥 |
| `baseUrl` | `string \| null` | 条件必填 | `azure-openai`、`newapi` 时必填 |
| `weight` | `number` | — | 评分权重，默认 `1`，必须 > 0 |

**权重说明**：权重用于加权平均评分。例如 `weight: 1.2` 表示该评审员的得分占比略高于 `weight: 1.0` 的评审员。

### `test` — 评测参数

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `complexity` | `string` | ✅ | 复杂度等级 |
| `rounds` | `number` | ✅ | 评测轮数，正整数 |
| `concurrency` | `number` | ✅ | 并发轮数，正整数 |

**复杂度等级说明**：

| 等级 | 说明 | 约束 |
|------|------|------|
| `C1` | 单一功能点 | 1 文件 / 1 函数 |
| `C2` | 2-3 个功能点组合 | 1-2 个文件 |
| `C3` | 多功能协作 | 多文件 / 明确模块边界 |
| `C4` | 完整应用架构 | 前后端分离 / 多层架构 |
| `mixed` | 随机混合 C1-C4 | 每轮随机选择一个等级 |

### `hub` — 排行榜提交

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `enabled` | `boolean` | — | 是否启用排行榜提交，默认 `false` |
| `serverUrl` | `string` | 启用时必填 | Hub 服务器地址 |
| `token` | `string` | 启用时必填 | Bearer Token（通过 GitHub OAuth 获取） |

你可以在 Hub 登录页 `https://req2rank.top/auth` 登录后，直接一键下载已填充 `hub.token` 的 `req2rank.config.json`。

---

## 环境变量

所有配置项均可通过环境变量覆盖，适用于 CI/CD 或不便将密钥写入文件的场景。

### 模型配置

| 环境变量 | 对应字段 |
|---------|---------|
| `R2R_TARGET_PROVIDER` | `target.provider` |
| `R2R_TARGET_MODEL` | `target.model` |
| `R2R_TARGET_API_KEY` | `target.apiKey` |

### 评测参数

| 环境变量 | 对应字段 |
|---------|---------|
| `R2R_TEST_COMPLEXITY` | `test.complexity` |
| `R2R_TEST_ROUNDS` | `test.rounds` |

### Hub 配置

| 环境变量 | 对应字段 |
|---------|---------|
| `R2R_HUB_ENABLED` | `hub.enabled` |
| `R2R_HUB_SERVER_URL` | `hub.serverUrl` |
| `R2R_HUB_TOKEN` | `hub.token` |

### 沙箱配置

沙箱执行通过环境变量控制（不在配置文件中）：

| 环境变量 | 说明 | 默认值 |
|---------|------|--------|
| `R2R_SANDBOX_ENABLED` | 是否启用代码沙箱校验 | `false` |
| `R2R_SANDBOX_STRICT` | 严格模式（校验失败中断评测） | `true` |
| `R2R_SANDBOX_TIMEOUT_MS` | 单轮沙箱超时（毫秒） | `60000` |
| `R2R_SANDBOX_IMAGE` | Docker 镜像 | `node:20-alpine` |

---

## 配置优先级

从高到低：

1. **CLI 参数**（如 `--target openai/gpt-4o`）
2. **环境变量**（如 `R2R_TARGET_MODEL=gpt-4o`）
3. **配置文件**（`req2rank.config.json`）
4. **内置默认值**

---

## 示例配置文件

项目仓库 `examples/` 目录下提供了现成的配置模板：

- `examples/basic.config.json` — 最小化配置，单评审模型
- `examples/advanced.config.json` — 完整配置，多评审模型 + Hub 提交
