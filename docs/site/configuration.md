# 配置说明

Req2Rank 在当前工作目录读取 `req2rank.config.json`。

## 完整示例

```json
{
  "target": {
    "provider": "openai",
    "model": "gpt-4o-mini",
    "apiKey": "",
    "baseUrl": null
  },
  "systemModel": {
    "provider": "anthropic",
    "model": "claude-sonnet-4-20250514",
    "apiKey": ""
  },
  "judges": [
    { "provider": "openai", "model": "gpt-4o", "apiKey": "", "weight": 1 },
    { "provider": "anthropic", "model": "claude-sonnet-4-20250514", "apiKey": "", "weight": 1.2 }
  ],
  "test": {
    "complexity": "mixed",
    "rounds": 3,
    "concurrency": 1
  },
  "hub": {
    "enabled": false,
    "serverUrl": "https://r2r.byebug.cn",
    "token": ""
  }
}
```

## 字段参考

### `target`

被测模型。

- `provider` (`string`, 必填): 模型提供商标识。
- `model` (`string`, 必填): 具体模型名。
- `apiKey` (`string`, 可选): API 密钥。为空时可用环境变量覆盖。
- `baseUrl` (`string | null`, 可选): OpenAI-compatible 服务地址。

### `systemModel`

用于需求生成和结构化阶段的系统模型。

- `provider` (`string`, 必填)
- `model` (`string`, 必填)
- `apiKey` (`string`, 可选)

### `judges`

评审团配置，至少一个评审模型。

- `provider` (`string`, 必填)
- `model` (`string`, 必填)
- `apiKey` (`string`, 可选)
- `weight` (`number`, 默认 `1`): 加权评分权重，必须大于 `0`。

### `test`

评测执行参数。

- `complexity` (`"C1" | "C2" | "C3" | "C4" | "mixed"`, 必填)
- `rounds` (`number`, 必填): 轮数，正整数。
- `concurrency` (`number`, 必填): 并发轮数，正整数。

### `hub`

排行榜上报配置。

- `enabled` (`boolean`, 默认 `false`)
- `serverUrl` (`string`, 可选): Hub 地址，启用提交时必填。
- `token` (`string`, 可选): Bearer token，启用提交时必填。

## Sandbox 运行配置（环境变量）

当前沙箱执行通过环境变量控制，而不是 `req2rank.config.json` 字段：

- `R2R_SANDBOX_ENABLED=true`：启用提交代码的容器校验。
- `R2R_SANDBOX_STRICT=false`：校验失败时不中断整轮（默认严格模式）。
- `R2R_SANDBOX_TIMEOUT_MS=60000`：单轮沙箱超时。
- `R2R_SANDBOX_IMAGE=node:20-alpine`：自定义 Docker 镜像。

## 常用环境变量

- `R2R_TARGET_PROVIDER` / `R2R_TARGET_MODEL`
- `R2R_TEST_COMPLEXITY` / `R2R_TEST_ROUNDS`
- `R2R_HUB_ENABLED` / `R2R_HUB_SERVER_URL` / `R2R_HUB_TOKEN`

## 配置优先级

1. CLI 参数（如 `--target`）
2. 环境变量
3. `req2rank.config.json`
4. 内置默认值

## 常见覆盖命令

```bash
req2rank run --target openai/gpt-4o-mini
req2rank run --complexity C3 --rounds 3
req2rank compare --targets openai/gpt-4o-mini,anthropic/claude-sonnet-4-20250514
req2rank leaderboard --limit 20 --sort desc
```

## 示例配置

- `examples/basic.config.json`
- `examples/advanced.config.json`
