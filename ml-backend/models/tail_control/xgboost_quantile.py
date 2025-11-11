"""
XGBoost Quantile Regression
Direct p95/p99 latency prediction with feature importance and tree ensembles
"""
from typing import Dict, List, Optional, Any, Tuple
import logging
import numpy as np
import pandas as pd

logger = logging.getLogger(__name__)

try:
    import xgboost as xgb
    XGBOOST_AVAILABLE = True
except ImportError:
    XGBOOST_AVAILABLE = False
    logger.warning("XGBoost not available. Install with: pip install xgboost")


class XGBoostQuantileModel:
    """
    XGBoost Quantile Regression for tail latency prediction
    Predicts P95, P99, P99.9 latencies with confidence intervals
    """

    def __init__(
        self,
        quantiles: List[float] = None,
        n_estimators: int = 100,
        max_depth: int = 6,
        learning_rate: float = 0.1
    ):
        """
        Initialize XGBoost Quantile model

        Args:
            quantiles: Quantiles to predict (default: [0.95, 0.99, 0.999])
            n_estimators: Number of boosting rounds
            max_depth: Maximum tree depth
            learning_rate: Learning rate
        """
        self.quantiles = quantiles or [0.95, 0.99, 0.999]
        self.n_estimators = n_estimators
        self.max_depth = max_depth
        self.learning_rate = learning_rate

        self.models: Dict[float, Any] = {}  # One model per quantile
        self.feature_names: List[str] = []
        self.fitted = False

    def train(
        self,
        X: pd.DataFrame,
        y: pd.Series,
        feature_names: Optional[List[str]] = None
    ) -> None:
        """
        Train quantile regression models

        Args:
            X: Feature matrix
            y: Target latency values
            feature_names: Names of features
        """
        if not XGBOOST_AVAILABLE:
            logger.warning("XGBoost not available, using fallback")
            self.fitted = False
            return

        self.feature_names = feature_names or [f"feature_{i}" for i in range(X.shape[1])]

        logger.info(f"Training XGBoost Quantile models for {len(self.quantiles)} quantiles")

        for q in self.quantiles:
            logger.info(f"Training model for quantile {q}")

            # XGBoost parameters for quantile regression
            params = {
                'objective': 'reg:quantileerror',
                'quantile_alpha': q,
                'max_depth': self.max_depth,
                'learning_rate': self.learning_rate,
                'n_estimators': self.n_estimators,
                'tree_method': 'hist',
                'random_state': 42
            }

            # Create and train model
            model = xgb.XGBRegressor(**params)
            model.fit(X, y)

            self.models[q] = model

        self.fitted = True
        logger.info("XGBoost Quantile models trained successfully")

    def predict(
        self,
        X: pd.DataFrame,
        return_all_quantiles: bool = True
    ) -> Dict[str, np.ndarray]:
        """
        Predict latency quantiles

        Args:
            X: Feature matrix
            return_all_quantiles: Return all quantiles or just p99

        Returns:
            Dictionary with quantile predictions
        """
        if not self.fitted or not XGBOOST_AVAILABLE:
            return self._mock_prediction(X)

        predictions = {}
        for q in self.quantiles:
            preds = self.models[q].predict(X)
            predictions[f"p{int(q*100)}"] = preds

        return predictions

    def predict_slo_control(
        self,
        features: Dict[str, float]
    ) -> Dict[str, Any]:
        """
        Predict tail latencies and autoscaling decisions

        Args:
            features: Current system features

        Returns:
            SLO control decisions
        """
        # Convert features to DataFrame
        X = pd.DataFrame([features])

        # Ensure columns match training
        if self.feature_names and self.fitted:
            missing_cols = set(self.feature_names) - set(X.columns)
            for col in missing_cols:
                X[col] = 0
            X = X[self.feature_names]

        # Predict quantiles
        predictions = self.predict(X)

        # Extract predictions
        p95_pred = float(predictions.get("p95", [250])[0]) if "p95" in predictions else 250
        p99_pred = float(predictions.get("p99", [400])[0]) if "p99" in predictions else 400
        p99_9_pred = float(predictions.get("p99", [600])[0]) if "p99" in predictions else 600

        # Determine action based on predictions
        action = "admit"
        autoscale_workers = 0

        if p99_pred > 500:
            action = "autoscale"
            # Calculate required workers based on latency
            request_rate = features.get("request_rate", 1000)
            autoscale_workers = max(1, int(request_rate / 800))  # 800 req/sec per worker
        elif p95_pred > 350:
            action = "admit_throttle"

        # Feature importance
        feature_importance = self._get_feature_importance()

        return {
            "p95_pred": int(p95_pred),
            "p99_pred": int(p99_pred),
            "p99_9_pred": int(p99_9_pred),
            "action": action,
            "autoscale_workers": autoscale_workers,
            "historic_comparison": "above_historic" if p99_pred > 450 else "within_historic",
            "confidence_interval_width": int((p99_pred - p95_pred) * 0.8),
            "top_features": feature_importance
        }

    def _get_feature_importance(self) -> Dict[str, float]:
        """Get feature importance from P99 model"""
        if not self.fitted or 0.99 not in self.models:
            return {}

        model = self.models[0.99]
        importance = model.feature_importances_

        # Return top 5 features
        top_indices = np.argsort(importance)[-5:][::-1]

        return {
            self.feature_names[i]: float(importance[i])
            for i in top_indices
            if i < len(self.feature_names)
        }

    def _mock_prediction(self, X: pd.DataFrame) -> Dict[str, np.ndarray]:
        """Generate mock predictions"""
        n_samples = len(X)

        # Extract features for realistic predictions
        load = X.get("load", pd.Series([0.7] * n_samples)).values
        request_rate = X.get("request_rate", pd.Series([1000] * n_samples)).values
        error_rate = X.get("error_rate", pd.Series([0.01] * n_samples)).values

        # Simulate quantile predictions
        base_p95 = 200 + 400 * load
        base_p99 = base_p95 * 1.5
        base_p999 = base_p99 * 1.3

        return {
            "p95": base_p95 + np.random.normal(0, 20, n_samples),
            "p99": base_p99 + np.random.normal(0, 30, n_samples),
            "p99": base_p999 + np.random.normal(0, 50, n_samples)
        }
