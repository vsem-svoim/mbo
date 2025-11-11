# ML Models Backend

Production-grade ML infrastructure for trading platform with comprehensive safety controls, configuration management, and real-time inference.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    Telemetry Sources                         │
│  ┌──────────┐  ┌──────────┐  ┌──────────────┐              │
│  │Prometheus│  │ClickHouse│  │Structured Logs│              │
│  └─────┬────┘  └─────┬────┘  └──────┬───────┘              │
└────────┼─────────────┼──────────────┼────────────────────────┘
         │             │              │
         └─────────────┼──────────────┘
                       ▼
         ┌─────────────────────────────┐
         │   Feature Engineering       │
         │   - Feature Store           │
         │   - Rolling Aggregates      │
         │   - Market Calendars        │
         └──────────┬──────────────────┘
                    │
       ┌────────────┼────────────┐
       ▼            ▼            ▼
┌──────────┐ ┌──────────┐ ┌──────────┐
│Forecasting│ │Tail Control│ │Anomaly  │
│- Prophet  │ │- XGBoost  │ │- BOCPD  │
│- TFT      │ │- CQR      │ │- I-Forest│
│- N-BEATS  │ │- EVT-POT  │ │- RRCF   │
└─────┬────┘ └─────┬────┘ └─────┬────┘
      │            │            │
      └────────────┼────────────┘
                   ▼
         ┌─────────────────────────────┐
         │   Safety & Control Layer    │
         │   - Constraint Validation   │
         │   - Emergency Fallbacks     │
         │   - Human Override          │
         └──────────┬──────────────────┘
                    ▼
         ┌─────────────────────────────┐
         │  Configuration Management   │
         │  - Versioned KV Store       │
         │  - Schema Validation        │
         │  - Atomic Updates           │
         └──────────┬──────────────────┘
                    ▼
         ┌─────────────────────────────┐
         │     FastAPI REST API        │
         │     /models/*               │
         │     /safety/*               │
         │     /config/*               │
         └─────────────────────────────┘
```

## Features

### 🔮 Forecasting Models
- **Prophet**: Time series forecasting with seasonal decomposition
- **TFT (Temporal Fusion Transformer)**: Multi-horizon prediction with attention
- **N-BEATS**: Fast pure time-series forecasting

### 📊 Tail Latency Control
- **XGBoost Quantile Regression**: Direct P95/P99/P99.9 prediction
- **CQR (Conformalized Quantile Regression)**: Calibrated prediction intervals
- **EVT-POT**: Extreme value modeling for black swan detection

### 🚨 Anomaly Detection
- **BOCPD**: Bayesian Online Change Point Detection for regime changes
- **Isolation Forest**: Unsupervised anomaly detection
- **RRCF**: Robust Random Cut Forest for streaming anomalies

### ⚙️ Optimization
- **Contextual Bandits**: UCB/Thompson Sampling for config selection
- **Bayesian Optimization**: Efficient parameter tuning with Gaussian Process

### 🛡️ Safety & Control
- Constraint validation
- Emergency fallbacks
- Human override capability
- Violation tracking

### 📝 Configuration Management
- Versioned configurations
- Schema validation
- Impact assessment
- Blue/green deployments
- Rollback support
- Drift detection

## Installation

### Prerequisites
- Python 3.8+
- pip

### Install Dependencies

```bash
cd ml-backend
pip install -r requirements.txt
```

### Optional: Create Virtual Environment

```bash
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
```

## Quick Start

### 1. Start the API Server

```bash
cd ml-backend
python -m api.main
```

The API will be available at `http://localhost:8000`

### 2. View API Documentation

Open your browser to:
- Swagger UI: `http://localhost:8000/docs`
- ReDoc: `http://localhost:8000/redoc`

### 3. Test an Endpoint

```bash
curl -X POST "http://localhost:8000/models/capacity-planning" \
  -H "Content-Type: application/json" \
  -d '{"ingest_rate": 1500, "cpu": 0.7, "p99": 400}'
```

## API Endpoints

### Model Inference

| Endpoint | Description | Model |
|----------|-------------|-------|
| `POST /models/capacity-planning` | Forecast capacity needs | Prophet + TFT |
| `POST /models/tail-slo` | Predict tail latencies | XGBoost + CQR |
| `POST /models/extreme-events` | Detect extreme events | EVT-POT |
| `POST /models/regime-detection` | Detect regime changes | BOCPD |
| `POST /models/bandit` | Select optimal config | Contextual Bandits |
| `POST /models/bayes-opt` | Optimize parameters | Bayesian Optimization |

### Safety & Control

| Endpoint | Description |
|----------|-------------|
| `POST /safety/emergency-mode` | Enable/disable emergency mode |
| `GET /safety/status` | Get safety controller status |

### Configuration

| Endpoint | Description |
|----------|-------------|
| `GET /config/active` | Get active configuration |
| `POST /config/deploy` | Deploy configuration version |

### Management

| Endpoint | Description |
|----------|-------------|
| `GET /health` | Health check |
| `GET /models/list` | List available models |

## Project Structure

```
ml-backend/
├── telemetry/              # Data collection
│   ├── prometheus_client.py
│   ├── clickhouse_client.py
│   └── log_aggregator.py
├── features/               # Feature engineering
│   ├── feature_store.py
│   └── feature_pipeline.py
├── models/                 # ML models
│   ├── forecasting/
│   │   ├── prophet_model.py
│   │   ├── tft_model.py
│   │   └── nbeats_model.py
│   ├── tail_control/
│   │   ├── xgboost_quantile.py
│   │   ├── cqr_model.py
│   │   └── evt_pot.py
│   ├── anomaly/
│   │   ├── bocpd.py
│   │   ├── isolation_forest.py
│   │   └── rrcf_detector.py
│   └── optimization/
│       ├── contextual_bandits.py
│       └── bayesian_opt.py
├── safety/                 # Safety controls
│   └── safety_controller.py
├── config/                 # Configuration management
│   └── config_manager.py
├── api/                    # REST API
│   └── main.py
├── tests/                  # Unit tests
└── requirements.txt
```

## Usage Examples

### Capacity Planning

```python
import requests

response = requests.post(
    "http://localhost:8000/models/capacity-planning",
    json={
        "ingest_rate": 1500,
        "cpu": 0.72,
        "p99": 380,
        "calendar_events": 1
    }
)

result = response.json()
print(f"Next hour workers: {result['data']['next_hour_workers']}")
print(f"Queue capacity: {result['data']['queue_capacity']}")
```

### Tail SLO Control

```python
response = requests.post(
    "http://localhost:8000/models/tail-slo",
    json={
        "load": 0.75,
        "infra": 0.68,
        "request_rate": 1200,
        "error_rate": 0.015
    }
)

result = response.json()
print(f"Predicted P99: {result['data']['p99_pred']} ms")
print(f"Action: {result['data']['action']}")
```

### Safety Controls

```python
# Enable emergency mode
requests.post(
    "http://localhost:8000/safety/emergency-mode",
    params={"enable": True, "reason": "production_incident"}
)

# Check safety status
response = requests.get("http://localhost:8000/safety/status")
print(response.json())
```

## Development

### Running Tests

```bash
pytest tests/
```

### Code Formatting

```bash
black ml-backend/
```

### Type Checking

```bash
mypy ml-backend/
```

## Production Deployment

### Using Docker

```dockerfile
FROM python:3.10-slim

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY ml-backend/ ./ml-backend/
EXPOSE 8000

CMD ["python", "-m", "uvicorn", "ml-backend.api.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

### Using Kubernetes

See `k8s/` directory for Kubernetes manifests.

### Environment Variables

```bash
# Telemetry
PROMETHEUS_URL=http://prometheus:9090
CLICKHOUSE_HOST=clickhouse
CLICKHOUSE_PORT=9000

# API
API_HOST=0.0.0.0
API_PORT=8000
LOG_LEVEL=INFO

# Safety
ENABLE_SAFETY_CHECKS=true
EMERGENCY_MODE=false
```

## Monitoring

### Prometheus Metrics

The API exposes Prometheus metrics at `/metrics`:
- Request latency histograms
- Request count by endpoint
- Model inference time
- Safety check violations

### Logging

Structured JSON logging to stdout:
```json
{
  "timestamp": "2025-11-11T12:00:00Z",
  "level": "INFO",
  "message": "Model inference completed",
  "model": "capacity_planning",
  "latency_ms": 45
}
```

## Troubleshooting

### Models Not Loading

Check that all dependencies are installed:
```bash
pip install -r requirements.txt
```

### Import Errors

Ensure you're running from the project root:
```bash
cd /path/to/mbo
python -m ml-backend.api.main
```

### Permission Errors

On Linux, you may need to install system dependencies:
```bash
sudo apt-get install -y python3-dev build-essential
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

## License

MIT License - See LICENSE file for details

## Support

For issues and questions:
- GitHub Issues: https://github.com/your-repo/issues
- Documentation: https://docs.your-site.com

---

**Built with ❤️ for production ML infrastructure**
