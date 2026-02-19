# Scoring Methodology

Req2Rank aggregates multiple judge model outputs into a final score with reliability signals.

## Dimensions and Weights

- Functional completeness: 30%
- Code quality: 25%
- Logic accuracy: 25%
- Security: 10%
- Engineering practice: 10%

## Reliability Signals

- Inter-judge agreement (IJA): consistency level derived from score spread.
- Confidence interval (CI95): uncertainty range around the aggregated score.

## Aggregation Flow

1. Collect all judge dimension scores.
2. Compute agreement metrics.
3. Aggregate weighted dimension scores.
4. Attach CI95 and warning flags.

## Report Surfaces

- Local CLI report (`req2rank report <run-id>`)
- Export file (`req2rank export ...`)
- Hub leaderboard entries (score + CI + verification status)
