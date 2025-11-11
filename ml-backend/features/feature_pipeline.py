"""
Feature Engineering Pipeline
Real-time feature computation with rolling aggregates, market calendars, and system topology
"""
from typing import Dict, List, Optional, Any
from datetime import datetime, timedelta
import logging
import pandas as pd
import numpy as np

from .feature_store import (
    FeatureStore,
    FeatureType,
    get_feature_store
)

logger = logging.getLogger(__name__)


class FeaturePipeline:
    """
    Feature engineering pipeline for ML models
    Computes rolling aggregates, seasonal features, and system topology features
    """

    def __init__(
        self,
        prometheus_client: Any = None,
        clickhouse_client: Any = None,
        log_aggregator: Any = None
    ):
        self.prometheus = prometheus_client
        self.clickhouse = clickhouse_client
        self.logs = log_aggregator
        self.feature_store = get_feature_store()

        # Register all features
        self._register_features()

    def _register_features(self) -> None:
        """Register all features in the feature store"""

        # === Real-time SLI Features ===
        self.feature_store.register_feature(
            name="request_rate",
            feature_type=FeatureType.REAL_TIME,
            description="Current request rate (req/sec)",
            compute_fn=lambda ctx, deps: self._get_prometheus_metric("request_rate")
        )

        self.feature_store.register_feature(
            name="error_rate",
            feature_type=FeatureType.REAL_TIME,
            description="Current error rate",
            compute_fn=lambda ctx, deps: self._get_prometheus_metric("error_rate")
        )

        self.feature_store.register_feature(
            name="p95_latency",
            feature_type=FeatureType.REAL_TIME,
            description="P95 latency in milliseconds",
            compute_fn=lambda ctx, deps: self._get_prometheus_metric("p95_latency")
        )

        self.feature_store.register_feature(
            name="p99_latency",
            feature_type=FeatureType.REAL_TIME,
            description="P99 latency in milliseconds",
            compute_fn=lambda ctx, deps: self._get_prometheus_metric("p99_latency")
        )

        self.feature_store.register_feature(
            name="cpu_usage",
            feature_type=FeatureType.REAL_TIME,
            description="CPU utilization (0-1)",
            compute_fn=lambda ctx, deps: self._get_prometheus_metric("cpu_usage")
        )

        # === Rolling Aggregate Features ===
        self.feature_store.register_feature(
            name="request_rate_rolling_mean",
            feature_type=FeatureType.BATCH,
            description="1-hour rolling mean of request rate",
            compute_fn=lambda ctx, deps: self._compute_rolling_stat("request_rate", "mean")
        )

        self.feature_store.register_feature(
            name="request_rate_rolling_std",
            feature_type=FeatureType.BATCH,
            description="1-hour rolling std of request rate",
            compute_fn=lambda ctx, deps: self._compute_rolling_stat("request_rate", "std")
        )

        self.feature_store.register_feature(
            name="latency_rolling_p95",
            feature_type=FeatureType.BATCH,
            description="1-hour rolling P95 latency",
            compute_fn=lambda ctx, deps: self._compute_rolling_stat("p95_latency", "p95")
        )

        # === Seasonal/Calendar Features ===
        self.feature_store.register_feature(
            name="hour_of_day",
            feature_type=FeatureType.REAL_TIME,
            description="Current hour (0-23)",
            compute_fn=lambda ctx, deps: datetime.now().hour
        )

        self.feature_store.register_feature(
            name="day_of_week",
            feature_type=FeatureType.REAL_TIME,
            description="Day of week (0=Monday, 6=Sunday)",
            compute_fn=lambda ctx, deps: datetime.now().weekday()
        )

        self.feature_store.register_feature(
            name="is_business_hours",
            feature_type=FeatureType.REAL_TIME,
            description="Whether in business hours (9am-5pm Mon-Fri)",
            compute_fn=lambda ctx, deps: self._is_business_hours()
        )

        self.feature_store.register_feature(
            name="market_event_impact",
            feature_type=FeatureType.REAL_TIME,
            description="Impact score from market events (0-1)",
            compute_fn=lambda ctx, deps: ctx.get("calendar_events", 0) * 0.2 if ctx else 0
        )

        # === System Topology Features ===
        self.feature_store.register_feature(
            name="active_workers",
            feature_type=FeatureType.REAL_TIME,
            description="Number of active worker processes",
            compute_fn=lambda ctx, deps: self._get_prometheus_metric("active_workers", default=10)
        )

        self.feature_store.register_feature(
            name="queue_depth",
            feature_type=FeatureType.REAL_TIME,
            description="Current queue depth",
            compute_fn=lambda ctx, deps: self._get_prometheus_metric("queue_depth", default=50)
        )

        # === Derived Features ===
        self.feature_store.register_feature(
            name="load_score",
            feature_type=FeatureType.DERIVED,
            description="Combined load score (0-1)",
            compute_fn=lambda ctx, deps: self._compute_load_score(deps),
            dependencies=["cpu_usage", "request_rate", "p95_latency"]
        )

        self.feature_store.register_feature(
            name="anomaly_score",
            feature_type=FeatureType.DERIVED,
            description="Anomaly detection score (0-1)",
            compute_fn=lambda ctx, deps: self._compute_anomaly_score(deps),
            dependencies=["error_rate", "p99_latency", "request_rate"]
        )

        logger.info(f"Registered {len(self.feature_store.features)} features")

    def get_features_for_model(
        self,
        model_type: str,
        context: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Get feature vector for a specific model type

        Args:
            model_type: Type of model (capacity, tail_slo, etc.)
            context: Additional context data

        Returns:
            Dictionary of features for the model
        """
        feature_map = {
            "capacity_planning": [
                "request_rate", "cpu_usage", "p99_latency",
                "hour_of_day", "day_of_week", "market_event_impact",
                "request_rate_rolling_mean", "active_workers"
            ],
            "tail_slo": [
                "load_score", "request_rate", "error_rate",
                "p95_latency", "p99_latency", "cpu_usage"
            ],
            "extreme_events": [
                "p99_latency", "error_rate", "anomaly_score",
                "latency_rolling_p95"
            ],
            "regime_detection": [
                "p99_latency", "error_rate", "request_rate",
                "anomaly_score", "load_score"
            ],
            "bandit": [
                "error_rate", "p95_latency", "request_rate"
            ],
            "bayes_opt": [
                "request_rate", "p95_latency", "cpu_usage",
                "active_workers", "queue_depth"
            ]
        }

        feature_names = feature_map.get(model_type, [])
        if not feature_names:
            logger.warning(f"No feature mapping for model type: {model_type}")
            return {}

        feature_vector = self.feature_store.get_feature_vector(feature_names, context)
        return feature_vector.features

    def _get_prometheus_metric(self, metric_name: str, default: float = 0.0) -> float:
        """Fetch metric from Prometheus"""
        if self.prometheus:
            try:
                metrics = self.prometheus.get_sli_metrics()
                return metrics.get(metric_name, default)
            except Exception as e:
                logger.error(f"Failed to fetch Prometheus metric '{metric_name}': {e}")
                return default
        return default

    def _compute_rolling_stat(self, metric_name: str, stat_type: str) -> float:
        """Compute rolling statistic from historical data"""
        if self.clickhouse:
            try:
                features = self.clickhouse.get_rolling_features(
                    metric_name,
                    window=timedelta(hours=1)
                )
                key = f"{metric_name}_rolling_{stat_type}"
                return features.get(key, 0.0)
            except Exception as e:
                logger.error(f"Failed to compute rolling stat: {e}")
                return 0.0
        return 0.0

    def _is_business_hours(self) -> bool:
        """Check if current time is during business hours"""
        now = datetime.now()
        is_weekday = now.weekday() < 5  # Monday = 0, Friday = 4
        is_business_time = 9 <= now.hour < 17
        return is_weekday and is_business_time

    def _compute_load_score(self, dependencies: Dict[str, Any]) -> float:
        """Compute combined load score"""
        cpu = dependencies.get("cpu_usage", 0.5)
        request_rate = dependencies.get("request_rate", 1000) / 5000  # Normalize
        latency = dependencies.get("p95_latency", 200) / 1000  # Normalize

        # Weighted average
        load_score = 0.4 * cpu + 0.3 * request_rate + 0.3 * latency
        return min(1.0, max(0.0, load_score))

    def _compute_anomaly_score(self, dependencies: Dict[str, Any]) -> float:
        """Compute anomaly score from multiple signals"""
        error_rate = dependencies.get("error_rate", 0.01)
        p99_latency = dependencies.get("p99_latency", 400)
        request_rate = dependencies.get("request_rate", 1000)

        # Anomaly indicators
        high_errors = min(1.0, error_rate / 0.05)  # Normalize to 5% error threshold
        high_latency = min(1.0, max(0.0, (p99_latency - 500) / 500))  # Above 500ms
        low_traffic = 1.0 if request_rate < 100 else 0.0

        # Combined score
        anomaly_score = 0.5 * high_errors + 0.3 * high_latency + 0.2 * low_traffic
        return min(1.0, max(0.0, anomaly_score))

    def backfill_features(
        self,
        start_time: datetime,
        end_time: datetime,
        feature_names: List[str]
    ) -> pd.DataFrame:
        """
        Backfill historical features for training

        Args:
            start_time: Start time for backfill
            end_time: End time for backfill
            feature_names: List of features to backfill

        Returns:
            DataFrame with backfilled features
        """
        if not self.clickhouse:
            logger.warning("ClickHouse client not configured, cannot backfill")
            return pd.DataFrame()

        logger.info(f"Backfilling {len(feature_names)} features from {start_time} to {end_time}")

        # Fetch historical data
        df = self.clickhouse.get_historical_metrics(
            feature_names,
            start_time,
            end_time,
            aggregation="avg",
            interval="5m"
        )

        return df
