# 配置说明

在工作目录使用 `req2rank.config.json` 作为配置文件。

## 最小示例

```json
{
  "target": { "provider": "openai", "model": "gpt-4o-mini", "apiKey": "" },
  "systemModel": { "provider": "anthropic", "model": "claude-sonnet-4-20250514", "apiKey": "" },
  "judges": [{ "provider": "openai", "model": "gpt-4o", "apiKey": "", "weight": 1 }],
  "test": { "complexity": "mixed", "rounds": 1, "concurrency": 1 },
  "hub": { "enabled": false }
}
```

## 配置优先级

运行时配置优先级如下：

1. CLI 参数
2. 环境变量
3. `req2rank.config.json`
4. 内置默认值

## 常见 CLI 覆盖项

```bash
req2rank run --target openai/gpt-4o-mini
req2rank run --complexity C3 --rounds 3
req2rank leaderboard --limit 20 --sort desc
```

## 示例配置文件

- `examples/basic.config.json`
- `examples/advanced.config.json`
