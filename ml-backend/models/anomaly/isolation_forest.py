"""
Isolation Forest
Unsupervised anomaly detection using tree-based isolation
Real-time detection of unusual system behavior
"""
from typing import Dict, List, Optional, Any
import logging
import numpy as np
import pandas as pd

logger = logging.getLogger(__name__)

try:
    from sklearn.ensemble import IsolationForest as SklearnIsolationForest
    SKLEARN_AVAILABLE = True
except ImportError:
    SKLEARN_AVAILABLE = False
    logger.warning("scikit-learn not available")


class IsolationForestAnomalyDetector:
    """
    Isolation Forest for anomaly detection
    Detects anomalies by isolating outliers using random trees
    """

    def __init__(
        self,
        contamination: float = 0.1,  # Expected proportion of outliers
        n_estimators: int = 100,
        max_samples: int = 256,
        random_state: int = 42
    ):
        """
        Initialize Isolation Forest

        Args:
            contamination: Expected fraction of anomalies
            n_estimators: Number of trees
            max_samples: Samples per tree
            random_state: Random seed
        """
        self.contamination = contamination
        self.n_estimators = n_estimators
        self.max_samples = max_samples
        self.random_state = random_state

        self.model: Optional[Any] = None
        self.feature_names: List[str] = []
        self.fitted = False

    def train(
        self,
        X: pd.DataFrame,
        feature_names: Optional[List[str]] = None
    ) -> None:
        """
        Train Isolation Forest on normal data

        Args:
            X: Training data (should be mostly normal)
            feature_names: Names of features
        """
        if not SKLEARN_AVAILABLE:
            logger.warning("scikit-learn not available, using fallback")
            self.fitted = False
            return

        self.feature_names = feature_names or list(X.columns) if isinstance(X, pd.DataFrame) else []

        logger.info(f"Training Isolation Forest with {len(X)} samples")

        self.model = SklearnIsolationForest(
            contamination=self.contamination,
            n_estimators=self.n_estimators,
            max_samples=min(self.max_samples, len(X)),
            random_state=self.random_state,
            n_jobs=-1
        )

        self.model.fit(X)
        self.fitted = True
        logger.info("Isolation Forest trained successfully")

    def predict(
        self,
        X: pd.DataFrame
    ) -> Tuple[np.ndarray, np.ndarray]:
        """
        Predict anomalies

        Args:
            X: Data to score

        Returns:
            Tuple of (predictions, anomaly_scores)
            predictions: 1 for normal, -1 for anomaly
            anomaly_scores: Lower scores = more anomalous
        """
        if not self.fitted or not SKLEARN_AVAILABLE:
            return self._mock_prediction(X)

        predictions = self.model.predict(X)
        scores = self.model.score_samples(X)

        return predictions, scores

    def detect_anomalies(
        self,
        features: Dict[str, float]
    ) -> Dict[str, Any]:
        """
        Detect anomalies in current metrics

        Args:
            features: Current system features

        Returns:
            Anomaly detection results
        """
        # Convert to DataFrame
        X = pd.DataFrame([features])

        # Ensure column order matches training
        if self.feature_names:
            missing_cols = set(self.feature_names) - set(X.columns)
            for col in missing_cols:
                X[col] = 0
            X = X[self.feature_names]

        # Predict
        predictions, scores = self.predict(X)

        is_anomaly = predictions[0] == -1 if len(predictions) > 0 else False
        anomaly_score = float(scores[0]) if len(scores) > 0 else 0.0

        # Normalize score to [0, 1] (lower = more anomalous)
        # Isolation Forest scores are typically in [-0.5, 0.5]
        normalized_score = max(0.0, min(1.0, (anomaly_score + 0.5)))

        # Determine severity
        if is_anomaly:
            if normalized_score < 0.2:
                severity = "critical"
            elif normalized_score < 0.4:
                severity = "high"
            else:
                severity = "medium"
        else:
            severity = "normal"

        return {
            "is_anomaly": is_anomaly,
            "anomaly_score": round(1 - normalized_score, 3),  # Higher = more anomalous
            "severity": severity,
            "raw_score": round(anomaly_score, 4),
            "threshold": round(-0.05, 4),  # Typical threshold for IF
            "method": "isolation_forest"
        }

    def _mock_prediction(
        self,
        X: pd.DataFrame
    ) -> Tuple[np.ndarray, np.ndarray]:
        """Generate mock predictions"""
        n_samples = len(X)

        # Simulate anomaly detection
        # Most samples are normal, few are anomalies
        predictions = np.ones(n_samples, dtype=int)

        # Mark some as anomalies based on features
        error_rate = X.get("error_rate", pd.Series([0.01] * n_samples)).values
        p99_latency = X.get("p99_latency", pd.Series([400] * n_samples)).values

        anomaly_mask = (error_rate > 0.05) | (p99_latency > 800)
        predictions[anomaly_mask] = -1

        # Generate scores (lower = more anomalous)
        scores = np.random.uniform(-0.1, 0.3, n_samples)
        scores[anomaly_mask] = np.random.uniform(-0.5, -0.1, anomaly_mask.sum())

        return predictions, scores
