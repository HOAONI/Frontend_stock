# Reserved API Contracts (Frontend First)

## Market

### GET /api/v1/stocks/:code/indicators
Query:
- period=daily
- days=120
- windows=5,10,20,60

Response:
```json
{
  "stock_code": "600519",
  "period": "daily",
  "days": 120,
  "windows": [5, 10, 20, 60],
  "items": [
    {
      "date": "2026-02-25",
      "close": 1789.20,
      "mas": { "ma5": 1775.1, "ma10": 1761.3, "ma20": 1748.2, "ma60": 1690.8 }
    }
  ]
}
```

### GET /api/v1/stocks/:code/factors
Query:
- date=YYYY-MM-DD

Response:
```json
{
  "stock_code": "600519",
  "date": "2026-02-25",
  "factors": {
    "rsi14": 58.2,
    "momentum20": 3.42,
    "vol_ratio5": 1.08,
    "amplitude": 2.19
  }
}
```

## Analysis

### GET /api/v1/analysis/tasks/:task_id/stages
Response:
```json
{
  "task_id": "task_xxx",
  "stages": [
    {
      "code": "data",
      "status": "done",
      "summary": "data loaded",
      "duration_ms": 120,
      "input": {},
      "output": {}
    }
  ]
}
```

### GET /api/v1/analysis/tasks/:task_id/stages/stream
SSE events (optional):
- stage_started
- stage_progress
- stage_completed
- stage_failed

## Backtest

### POST /api/v1/backtest/compare
Request:
```json
{
  "code": "600519",
  "eval_window_days_list": [5, 10, 20]
}
```

Response:
```json
{
  "items": [
    {
      "eval_window_days": 5,
      "total_evaluations": 100,
      "completed_count": 93,
      "direction_accuracy_pct": 56.8,
      "win_rate_pct": 52.2,
      "avg_simulated_return_pct": 1.32,
      "avg_stock_return_pct": 0.77,
      "max_drawdown_pct": -6.1
    }
  ]
}
```

### GET /api/v1/backtest/curves
Query:
- scope=overall|stock
- code(optional)
- eval_window_days

Response:
```json
{
  "scope": "overall",
  "eval_window_days": 10,
  "curves": [
    {
      "label": "2026-02-25",
      "strategy_return_pct": 3.2,
      "benchmark_return_pct": 1.5,
      "drawdown_pct": -1.1
    }
  ]
}
```

### GET /api/v1/backtest/distribution
Query:
- scope=overall|stock
- code(optional)
- eval_window_days

Response:
```json
{
  "scope": "overall",
  "eval_window_days": 10,
  "distribution": {
    "long_count": 71,
    "cash_count": 22,
    "win_count": 38,
    "loss_count": 29,
    "neutral_count": 26
  }
}
```

### GET /api/v1/backtest/report
Query:
- scope=overall|stock
- code(optional)
- eval_window_days
- format=md|json
