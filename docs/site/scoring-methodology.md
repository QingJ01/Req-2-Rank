# 评分方法

Req2Rank 将多评审模型分数聚合为一个总分，并提供一致性与置信区间，避免单评审偏差。

## 评分维度与权重

- 功能完整性（`functionalCompleteness`）：30%
- 代码质量（`codeQuality`）：25%
- 逻辑正确性（`logicAccuracy`）：25%
- 安全性（`security`）：10%
- 工程实践（`engineeringPractice`）：10%

总分公式：

`overallScore = sum(dimensionScore_i * weight_i)`

## IJA（一致性）计算

当前实现使用“标准差阈值法”估计 Inter-Judge Agreement（IJA）：

1. 对每个维度收集所有评审分数，计算标准差 `sigma`。
2. 等级判定：
   - `sigma <= 8` -> `high`
   - `8 < sigma <= 15` -> `moderate`
   - `sigma > 15` -> `low`
3. `overall agreement` 为各维度 `sigma` 的平均值再按同阈值判定。

当某维度为 `low` 时，报告中会出现 warning（如 `security dimension has low agreement`）。

## 去极值（trimmed mean）策略

只有在满足以下条件时才去极值：

- 评审员数量 `>= 3`
- 总体一致性不是 `low`

去极值方式：

- 对每个维度排序后移除最小值和最大值，再求均值。
- 若未触发条件，直接对原始分数求均值。

这样可以降低极端分对结果的影响，但在评审分歧大时保留全部信息。

## CI95（95% 置信区间）

对每个评审员先计算其加权总分，再计算：

- `stdDev = sample standard deviation`
- `margin = 1.96 * (stdDev / sqrt(n))`
- `ci95 = [overallScore - margin, overallScore + margin]`

其中 `n` 是参与 CI 计算的评审样本数（若启用去极值，使用去极值后的样本）。

## 聚合流程

1. 收集所有评审维度分数。
2. 计算每维 `sigma` 与一致性等级。
3. 判断是否满足去极值条件。
4. 计算维度分和总分。
5. 计算 CI95，生成 warnings。

## 在哪里查看结果

- CLI 报告：`req2rank report <run-id>`
- 导出结果：`req2rank export --latest --format markdown`
- Hub 排行榜：显示 `score + CI95 + verification status`
