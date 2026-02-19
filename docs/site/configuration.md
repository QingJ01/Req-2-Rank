# Configuration

Use `req2rank.config.json` in your working directory.

## Minimal Example

```json
{
  "target": { "provider": "openai", "model": "gpt-4o-mini", "apiKey": "" },
  "systemModel": { "provider": "anthropic", "model": "claude-sonnet-4-20250514", "apiKey": "" },
  "judges": [{ "provider": "openai", "model": "gpt-4o", "apiKey": "", "weight": 1 }],
  "test": { "complexity": "mixed", "rounds": 1, "concurrency": 1 },
  "hub": { "enabled": false }
}
```

## Precedence

Runtime config precedence is:

1. CLI flags
2. Environment variables
3. `req2rank.config.json`
4. Built-in defaults

## Common CLI Overrides

```bash
req2rank run --target openai/gpt-4o-mini
req2rank run --complexity C3 --rounds 3
req2rank leaderboard --limit 20 --sort desc
```

## Sample Config Files

- `examples/basic.config.json`
- `examples/advanced.config.json`
