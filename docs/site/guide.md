# 使用指南

本页是 `req2rank` CLI 全部命令的深度参考，涵盖每个命令的完整选项、使用场景和示例。

## 命令总览

| 命令 | 用途 |
|------|------|
| `init` | 生成配置文件 |
| `run` | 执行评测 |
| `compare` | 多模型对比 |
| `history` | 查看本地评测记录 |
| `report` | 查看评测详细报告 |
| `export` | 导出评测数据 |
| `submit` | 提交到排行榜 |
| `leaderboard` | 查看排行榜 |
| `calibrate` | 难度自适应校准 |
| `sandbox` | 代码沙箱测试 |

---

## `req2rank init`

生成默认配置文件 `req2rank.config.json`。

```bash
req2rank init
```

如果配置文件已存在，不会覆盖。

---

## `req2rank run`

执行一次完整的评测流水线（生成需求 → 代码执行 → 评审打分 → 统计计分）。

```bash
req2rank run [options]
```

| 选项 | 说明 | 默认值 |
|------|------|--------|
| `--target <provider/model>` | 覆盖被测模型 | 配置文件中的 `target` |
| `--complexity <C1\|C2\|C3\|C4\|mixed>` | 覆盖复杂度等级 | 配置文件中的 `test.complexity` |
| `--rounds <count>` | 覆盖评测轮数 | 配置文件中的 `test.rounds` |

### 示例

```bash
# 使用配置文件的默认参数
req2rank run

# 快捷指定被测模型
req2rank run --target openai/gpt-4o

# 指定复杂度和轮数
req2rank run --complexity C3 --rounds 5
```

### 断点续跑

如果评测中途中断（如网络问题），再次执行 `req2rank run` 会从上次中断的轮次继续，无需重新开始。断点信息保存在 `.req2rank/checkpoints.json`。

### 实时进度

运行时的实时进度会写入 `.req2rank/live-progress.json`，Hub 的 Workbench 页面可读取此文件实现可视化监控。

---

## `req2rank compare`

以相同需求分别评测多个模型，便于横向对比。

```bash
req2rank compare --targets <provider/model,...> [options]
```

| 选项 | 说明 |
|------|------|
| `--targets <list>` | 逗号分隔的模型列表（**必填**） |
| `--complexity <level>` | 复杂度等级 |
| `--rounds <count>` | 评测轮数 |

### 示例

```bash
req2rank compare --targets openai/gpt-4o-mini,anthropic/claude-sonnet-4-20250514 --complexity C2 --rounds 3
```

---

## `req2rank history`

显示所有本地评测记录。

```bash
req2rank history [--output <text|json>]
```

| 选项 | 说明 | 默认值 |
|------|------|--------|
| `--output <format>` | 输出格式 | `text` |

### 示例

```bash
# 人类可读的文本格式
req2rank history

# JSON 格式（便于程序处理）
req2rank history --output json
```

---

## `req2rank report`

查看某次评测的完整报告。

```bash
req2rank report <runId> [options]
```

| 选项 | 说明 | 默认值 |
|------|------|--------|
| `--markdown` | 输出 Markdown 格式 | `false` |
| `--template <default\|compact>` | 报告模板 | `default` |
| `--out <filePath>` | 写入文件（不填则输出到终端） | — |

### 示例

```bash
# 终端查看
req2rank report run-20260220-143000

# 导出为 Markdown 文件
req2rank report run-20260220-143000 --markdown --out report.md
```

---

## `req2rank export`

导出评测结果数据。

```bash
req2rank export [runId] [options]
```

| 选项 | 说明 | 默认值 |
|------|------|--------|
| `--latest` | 导出最近一次评测 | `false` |
| `--format <markdown\|json>` | 导出格式 | `markdown` |
| `--template <default\|compact>` | 报告模板 | `default` |
| `--out <filePath>` | 自定义输出路径 | `.req2rank/exports/` |

### 示例

```bash
# 导出最近一次为 Markdown
req2rank export --latest --format markdown

# 导出指定评测为 JSON
req2rank export run-20260220-143000 --format json --out result.json
```

---

## `req2rank submit`

将评测结果提交到排行榜（需先在配置中启用 Hub）。

```bash
req2rank submit [runId] [--latest]
```

提交流程：
1. 自动向 Hub 申请一次性 Nonce
2. 组装证据链（时间线 + 抽样数据 + 环境指纹）
3. 发送到 Hub 进行校验和入库

### 示例

```bash
# 提交最近一次评测
req2rank submit --latest

# 提交指定评测
req2rank submit run-20260220-143000
```

### Hub 配置命令指南（推荐）

首次提交前，推荐按这组最短路径完成配置：

```bash
# 1) 初始化配置（如尚未初始化）
req2rank init

# 2) 打开登录页，完成 GitHub 登录
# https://req2rank.top/auth

# 3) 在登录页点击“下载 req2rank.config.json”
#    将其中 hub 字段合并到本地配置

# 4) 运行一次评测并提交
req2rank run --rounds 1
req2rank submit --latest

# 5) 查看排行榜确认上榜
req2rank leaderboard --output table
```

如果你不使用下载文件，也可手动在 `req2rank.config.json` 中设置：

```json
{
  "hub": {
    "enabled": true,
    "serverUrl": "https://req2rank.top",
    "token": "<your-token>"
  }
}
```

---

## `req2rank leaderboard`

在终端中查看排行榜。

```bash
req2rank leaderboard [options]
```

| 选项 | 说明 | 默认值 |
|------|------|--------|
| `--limit <count>` | 显示数量 | `10` |
| `--offset <count>` | 偏移量 | `0` |
| `--sort <asc\|desc>` | 排序方向 | `desc` |
| `--complexity <C1\|C2\|C3\|C4\|mixed\|all>` | 复杂度筛选 | `all` |
| `--dimension <functionalCompleteness\|codeQuality\|logicAccuracy\|security\|engineeringPractice>` | 维度筛选 | — |
| `--output <text\|table\|json>` | 输出格式 | `text` |

### 示例

```bash
# 默认查看 Top 10
req2rank leaderboard

# 表格格式查看 Top 20
req2rank leaderboard --limit 20 --output table

# 查看 C2 安全维度排行榜
req2rank leaderboard --complexity C2 --dimension security --output table
```

---

## `req2rank calibrate`

基于历史评测数据进行难度自适应校准。分析不同能力标签与复杂度组合的实际难度偏差。

```bash
req2rank calibrate [--write]
```

| 选项 | 说明 |
|------|------|
| `--write` | 将校准结果写入数据库（不加只预览） |

---

## `req2rank sandbox`

测试代码沙箱执行环境。

```bash
req2rank sandbox [options]
```

| 选项 | 说明 | 默认值 |
|------|------|--------|
| `--image <image>` | Docker 镜像 | `node:20-alpine` |
| `--command <command>` | 执行命令 | — |

---

## 典型工作流

### 场景一：快速验证一个模型

```bash
req2rank init
# 编辑 req2rank.config.json，填入 API Key
req2rank run --complexity C2 --rounds 1
req2rank report --latest
```

### 场景二：多模型对比评测

```bash
req2rank compare \
  --targets openai/gpt-4o,anthropic/claude-sonnet-4-20250514,google/gemini-1.5-pro \
  --complexity C3 --rounds 5
```

### 场景三：评测并提交排行榜

```bash
req2rank run --complexity mixed --rounds 3
req2rank submit --latest
req2rank leaderboard --output table
```
