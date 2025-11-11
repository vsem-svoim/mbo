# ML Models Architecture

Comprehensive architecture documentation for the production ML infrastructure.

## System Overview

This ML infrastructure implements a complete production-grade machine learning platform for trading systems with:
- Real-time telemetry ingestion
- Feature engineering pipeline
- Multiple specialized ML models
- Safety and control layers
- Configuration management
- REST API for frontend integration

## Core Components

### 1. Telemetry Layer

**Purpose**: Collect metrics from multiple sources for ML feature engineering

**Components**:
- `PrometheusClient`: Real-time SLI metrics (latency, throughput, errors)
- `ClickHouseClient`: Historical analytics data with rolling aggregates
- `LogAggregator`: Structured log processing for event correlation

**Data Flow**:
```
Production Systems → Prometheus/ClickHouse/Logs → Telemetry Clients → Feature Store
```

### 2. Feature Engineering Pipeline

**Purpose**: Transform raw telemetry into ML-ready features

**Components**:
- `FeatureStore`: Centralized feature registry with caching
- `FeaturePipeline`: Real-time and batch feature computation

**Features**:
- Real-time SLI features (request_rate, p99_latency, cpu_usage)
- Rolling aggregates (1-hour means, stds, quantiles)
- Seasonal/calendar features (hour_of_day, is_business_hours)
- System topology features (active_workers, queue_depth)
- Derived features (load_score, anomaly_score)

**Feature Types**:
- `REAL_TIME`: Computed from live metrics
- `BATCH`: Pre-computed from historical data
- `DERIVED`: Computed from other features

### 3. ML Models

#### 3.1 Forecasting Models (Capacity Planning)

**Prophet**:
- Time series forecasting with seasonal decomposition
- Holiday adjustments for market events
- Trend + seasonality + residuals decomposition

**TFT (Temporal Fusion Transformer)**:
- Multi-horizon predictions (1-24 hours)
- Attention mechanisms for complex dependencies
- Market event awareness

**N-BEATS**:
- Pure time-series forecasting
- Fast inference (<10ms)
- Trend/seasonality decomposition

**Use Cases**:
- Worker/queue capacity planning
- Seasonal traffic forecasting
- Event-driven scaling

#### 3.2 Tail Latency Control

**XGBoost Quantile Regression**:
- Direct P95/P99/P99.9 prediction
- Tree-based ensemble with feature importance
- Gradient boosting for accuracy

**CQR (Conformalized Quantile Regression)**:
- Calibrated prediction intervals
- Distribution-free coverage guarantees
- Finite-sample validity

**EVT-POT (Extreme Value Theory - Peaks Over Threshold)**:
- Models tail distribution with GPD
- Black swan detection
- Return period estimation
- VaR/CVaR calculation

**Use Cases**:
- SLO breach prediction
- Autoscaling triggers
- Admission control
- Extreme event alerting

#### 3.3 Anomaly Detection

**BOCPD (Bayesian Online Change Point Detection)**:
- Online regime change detection
- Bayesian inference with run-length distribution
- Deploy impact detection
- Market shift detection

**Isolation Forest**:
- Unsupervised anomaly detection
- Tree-based isolation scoring
- Fast training and inference

**RRCF (Robust Random Cut Forest)**:
- Streaming anomaly detection
- Point deletion capability
- Online learning
- Low memory footprint

**Use Cases**:
- Deploy anomaly gating
- Performance regression detection
- Unusual traffic patterns
- System health monitoring

#### 3.4 Optimization

**Contextual Bandits (UCB/Thompson Sampling)**:
- Multi-armed bandit for config selection
- UCB: Upper Confidence Bound exploration
- Thompson Sampling: Bayesian posterior sampling
- Safe exploration bounds

**Bayesian Optimization**:
- Efficient parameter tuning
- Gaussian Process surrogate model
- Acquisition functions (EI, UCB)
- Convergence detection

**Use Cases**:
- A/B test optimization
- Canary config selection (1-5% traffic)
- Nightly parameter tuning
- Load test optimization

### 4. Safety & Control Layer

**Purpose**: Validate ML outputs and enforce safety constraints

**Components**:
- `SafetyController`: Validation orchestrator
- `SafetyCheck`: Individual constraint validators
- `SafetyValidationResult`: Validation outcome

**Safety Levels**:
- `SAFE`: Output is safe to use
- `WARNING`: Output has warnings but is usable
- `UNSAFE`: Output violates constraints
- `CRITICAL`: Severe violation, emergency mode

**Features**:
- Constraint validation (ranges, relationships)
- Emergency fallback outputs
- Human override capability
- Violation history tracking
- Emergency mode (blocks all outputs)

**Example Checks**:
```python
# Capacity planning
worker_count_reasonable: 1 <= workers <= 100
queue_capacity_reasonable: 50 <= queue <= 10000

# Tail SLO
autoscale_within_limits: autoscale_workers <= 50

# Bandit
canary_percentage_safe: 0 <= canary_pct <= 10
```

### 5. Configuration Management

**Purpose**: Manage versioned configurations with safe deployment

**Components**:
- `ConfigManager`: Version orchestrator
- `ConfigValidator`: Schema and impact validation
- `ConfigVersion`: Immutable config snapshot

**Features**:
- Versioned KV store
- Schema validation
- Impact assessment (before/after comparison)
- Atomic updates
- Deployment strategies (blue/green, canary, rolling)
- Rollback support
- Drift detection

**Config Lifecycle**:
```
DRAFT → VALIDATING → APPROVED → DEPLOYING → ACTIVE
                                               ↓
                                         DEPRECATED/ROLLED_BACK
```

### 6. REST API

**Purpose**: Expose ML models to React frontend and other clients

**Framework**: FastAPI (async, auto-docs, Pydantic validation)

**Endpoints**:

**Model Inference**:
- `POST /models/capacity-planning`: Capacity forecasting
- `POST /models/tail-slo`: Tail latency control
- `POST /models/extreme-events`: Extreme event detection
- `POST /models/regime-detection`: Regime change detection
- `POST /models/bandit`: Config selection
- `POST /models/bayes-opt`: Parameter optimization

**Safety & Control**:
- `POST /safety/emergency-mode`: Emergency controls
- `GET /safety/status`: Safety system status

**Configuration**:
- `GET /config/active`: Active configuration
- `POST /config/deploy`: Deploy config version

**Management**:
- `GET /health`: Health check
- `GET /models/list`: List available models

## Data Flow

### End-to-End Request Flow

```
1. Frontend Request
   ↓
2. FastAPI Endpoint
   ↓
3. Feature Pipeline (fetch features from telemetry)
   ↓
4. ML Model Inference
   ↓
5. Safety Validation
   ↓
6. [If unsafe] → Fallback Output
   [If safe] → Model Output
   ↓
7. Response to Frontend
```

### Telemetry → Features → Models

```
Production System
    ↓
Prometheus (real-time metrics)
    ↓
ClickHouse (historical data)
    ↓
Feature Pipeline
    ├─ Real-time features (cpu, latency, etc.)
    ├─ Rolling aggregates (1h mean, std, p95)
    ├─ Seasonal features (hour, day_of_week)
    └─ Derived features (load_score, anomaly_score)
    ↓
Feature Store (cached)
    ↓
ML Models (capacity, tail-slo, anomaly, etc.)
    ↓
Safety Layer
    ↓
Config Manager (optional deployment)
    ↓
REST API Response
```

## Deployment Architecture

### Development

```
Developer Machine
├── Python 3.8+
├── Virtual Environment
├── FastAPI (localhost:8000)
└── Mock Telemetry Sources
```

### Production

```
Kubernetes Cluster
├── ML API Pods (FastAPI)
│   ├── Replicas: 3+
│   ├── Resources: 2 CPU, 4GB RAM
│   └── Autoscaling: HPA
├── Redis (Feature Cache)
├── Prometheus (Metrics)
├── ClickHouse (Analytics)
├── etcd (Config Store)
└── LoadBalancer
```

### High Availability

- Multi-replica deployment (3+ pods)
- Health checks and readiness probes
- Circuit breakers for telemetry sources
- Fallback outputs when models fail
- Emergency mode for incidents

## Model Training & Updates

### Offline Training

```bash
# Prophet
python scripts/train_prophet.py --data historical_metrics.csv

# XGBoost Quantile
python scripts/train_xgboost.py --data labeled_latencies.csv

# Isolation Forest
python scripts/train_isolation_forest.py --data normal_behavior.csv
```

### Online Learning

- BOCPD: Updates online with each observation
- RRCF: Streaming updates
- Contextual Bandits: Real-time feedback incorporation

### Model Registry

```python
models = {
    "prophet": load_model("models/prophet_v1.pkl"),
    "xgboost_quantile": load_model("models/xgboost_q_v2.json"),
    # ...
}
```

## Monitoring & Observability

### API Metrics (Prometheus)

```
http_requests_total{endpoint="/models/capacity-planning", status="200"}
http_request_duration_seconds{endpoint="/models/tail-slo", quantile="0.99"}
model_inference_duration_seconds{model="prophet"}
safety_violations_total{model_type="bandit", severity="unsafe"}
```

### Logs (Structured JSON)

```json
{
  "timestamp": "2025-11-11T12:00:00Z",
  "level": "INFO",
  "message": "Model inference completed",
  "model": "capacity_planning",
  "input": {"ingest_rate": 1500, "cpu": 0.7},
  "output": {"next_hour_workers": 8},
  "safety_check": {"is_safe": true},
  "latency_ms": 45
}
```

### Alerts

- Safety violations (Severity: Critical)
- Emergency mode activated
- Model inference failures (>1% error rate)
- High API latency (p99 > 1s)
- Configuration drift detected

## Security

### Authentication

- API Key authentication (production)
- JWT tokens (optional)
- mTLS for inter-service communication

### Authorization

- Role-based access control (RBAC)
- Safety override requires admin role
- Config deployment requires approval

### Data Privacy

- No PII in logs
- Metric anonymization
- Secure credential storage (environment variables, secrets)

## Performance

### Latency Targets

| Model | p50 | p99 | p99.9 |
|-------|-----|-----|-------|
| Capacity Planning | 30ms | 80ms | 150ms |
| Tail SLO | 20ms | 60ms | 120ms |
| Extreme Events | 15ms | 40ms | 80ms |
| BOCPD | 10ms | 30ms | 60ms |
| Bandit | 5ms | 15ms | 30ms |
| Bayes Opt | 50ms | 150ms | 300ms |

### Throughput

- 1000+ requests/second per API pod
- Feature cache hit rate: >95%
- Model inference batching for efficiency

### Scalability

- Horizontal scaling (add more API pods)
- Feature store caching (Redis)
- Asynchronous telemetry fetching
- Connection pooling for databases

## Future Enhancements

1. **Model A/B Testing**: Test new model versions on subset of traffic
2. **AutoML Pipeline**: Automated model selection and hyperparameter tuning
3. **Explainability**: SHAP values for model interpretability
4. **Distributed Training**: Train large models across multiple GPUs
5. **Real-time Feature Store**: Stream processing with Kafka/Flink
6. **Model Serving Optimization**: TensorRT, ONNX runtime for faster inference
7. **Multi-tenancy**: Support multiple customers/environments

## References

- **Prophet**: [facebook/prophet](https://github.com/facebook/prophet)
- **PyTorch Forecasting**: [pytorch-forecasting](https://pytorch-forecasting.readthedocs.io/)
- **XGBoost**: [xgboost.readthedocs.io](https://xgboost.readthedocs.io/)
- **MAPIE (CQR)**: [mapie.readthedocs.io](https://mapie.readthedocs.io/)
- **RRCF**: [kLabUM/rrcf](https://github.com/kLabUM/rrcf)
- **BoTorch**: [botorch.org](https://botorch.org/)
- **FastAPI**: [fastapi.tiangolo.com](https://fastapi.tiangolo.com/)

---

**Architecture Version**: 1.0
**Last Updated**: 2025-11-11
**Maintained by**: ML Infrastructure Team
