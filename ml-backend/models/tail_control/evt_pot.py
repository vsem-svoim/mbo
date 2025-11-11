"""
Extreme Value Theory - Peaks Over Threshold (EVT-POT)
Black swan detection and tail risk modeling using Generalized Pareto Distribution
"""
from typing import Dict, List, Optional, Any, Tuple
import logging
import numpy as np
import pandas as pd
from datetime import datetime, timedelta

logger = logging.getLogger(__name__)

try:
    from scipy import stats
    SCIPY_AVAILABLE = True
except ImportError:
    SCIPY_AVAILABLE = False
    logger.warning("SciPy not available")


class EVTModel:
    """
    Extreme Value Theory model using Peaks Over Threshold
    Models tail distribution with Generalized Pareto Distribution (GPD)
    """

    def __init__(
        self,
        threshold_percentile: float = 0.95,
        declustering_window: int = 10,
        min_exceedances: int = 10
    ):
        """
        Initialize EVT-POT model

        Args:
            threshold_percentile: Percentile for threshold selection (e.g., 0.95)
            declustering_window: Window size for declustering exceedances
            min_exceedances: Minimum exceedances required for fitting
        """
        self.threshold_percentile = threshold_percentile
        self.declustering_window = declustering_window
        self.min_exceedances = min_exceedances

        self.threshold: Optional[float] = None
        self.gpd_shape: Optional[float] = None  # xi parameter
        self.gpd_scale: Optional[float] = None  # sigma parameter
        self.fitted = False

    def fit(
        self,
        data: np.ndarray,
        auto_threshold: bool = True,
        threshold: Optional[float] = None
    ) -> None:
        """
        Fit GPD to exceedances over threshold

        Args:
            data: Historical data
            auto_threshold: Automatically select threshold
            threshold: Manual threshold (if auto_threshold=False)
        """
        if not SCIPY_AVAILABLE:
            logger.warning("SciPy not available, using fallback")
            self.fitted = False
            return

        # Select threshold
        if auto_threshold:
            self.threshold = np.percentile(data, self.threshold_percentile * 100)
        else:
            self.threshold = threshold

        logger.info(f"Using threshold: {self.threshold}")

        # Extract exceedances
        exceedances = data[data > self.threshold] - self.threshold

        # Decluster exceedances
        exceedances = self._decluster(exceedances)

        if len(exceedances) < self.min_exceedances:
            logger.warning(f"Only {len(exceedances)} exceedances, minimum is {self.min_exceedances}")
            self.fitted = False
            return

        logger.info(f"Fitting GPD to {len(exceedances)} exceedances")

        # Fit Generalized Pareto Distribution
        self.gpd_shape, _, self.gpd_scale = stats.genpareto.fit(exceedances, floc=0)

        self.fitted = True
        logger.info(f"GPD fitted: shape={self.gpd_shape:.4f}, scale={self.gpd_scale:.4f}")

    def predict_extreme_probability(
        self,
        value: float,
        total_observations: int = 1000
    ) -> float:
        """
        Calculate probability of observing extreme value

        Args:
            value: Value to evaluate
            total_observations: Total number of observations

        Returns:
            Probability of extreme event
        """
        if not self.fitted or value <= self.threshold:
            return 0.0

        # Exceedance
        excess = value - self.threshold

        # Probability from GPD
        prob_exceed_threshold = stats.genpareto.sf(
            excess,
            self.gpd_shape,
            loc=0,
            scale=self.gpd_scale
        )

        return float(prob_exceed_threshold)

    def calculate_return_period(
        self,
        n_exceedances: int,
        window_size: int = 1000
    ) -> int:
        """
        Calculate return period for extreme events

        Args:
            n_exceedances: Number of exceedances observed
            window_size: Observation window size

        Returns:
            Return period (how often event occurs)
        """
        if n_exceedances == 0:
            return window_size * 10  # Very rare

        return max(1, window_size // n_exceedances)

    def predict_extreme_events(
        self,
        current_metrics: Dict[str, float],
        window_data: Optional[np.ndarray] = None
    ) -> Dict[str, Any]:
        """
        Detect extreme events and tail risk

        Args:
            current_metrics: Current system metrics
            window_data: Recent historical data

        Returns:
            Extreme event detection results
        """
        current_value = current_metrics.get("current_value", 0.95)
        exceedances_count = int(current_metrics.get("exceedances", 3))
        window_size = int(current_metrics.get("window_size", 1000))

        # If model is fitted, use real calculations
        if self.fitted and self.threshold is not None:
            threshold = self.threshold
            gpd_shape = self.gpd_shape
            gpd_scale = self.gpd_scale

            # Calculate extreme probability
            extreme_prob = self.predict_extreme_probability(
                current_value,
                window_size
            )
        else:
            # Use heuristic calculations
            threshold = 0.98 - min(0.15, exceedances_count * 0.015)
            gpd_shape = 0.1  # Moderate tail heaviness
            gpd_scale = 0.05
            extreme_prob = 1 - np.exp(-exceedances_count / 10)

        # Calculate return period
        return_period = self.calculate_return_period(exceedances_count, window_size)

        # Determine alert level
        if extreme_prob > 0.5:
            alert_level = "critical"
        elif extreme_prob > 0.3:
            alert_level = "warning"
        else:
            alert_level = "normal"

        # Persistence requirement (avoid false alarms)
        persistence_required = "yes" if exceedances_count >= 5 else "no"

        return {
            "extreme_threshold": round(threshold, 3),
            "extreme_probability": round(extreme_prob, 4),
            "return_period": return_period,
            "gpd_shape": round(gpd_shape, 3),
            "gpd_scale": round(gpd_scale, 3),
            "alert_level": alert_level,
            "persistence_required": persistence_required,
            "exceedances_count": exceedances_count,
            "model_fitted": self.fitted
        }

    def _decluster(self, exceedances: np.ndarray) -> np.ndarray:
        """
        Decluster exceedances to ensure independence

        Args:
            exceedances: Raw exceedances

        Returns:
            Declustered exceedances
        """
        if len(exceedances) == 0:
            return exceedances

        # Simple declustering: keep only local maxima
        declustered = []
        i = 0

        while i < len(exceedances):
            # Find local maximum in window
            window_end = min(i + self.declustering_window, len(exceedances))
            window = exceedances[i:window_end]
            max_idx = i + np.argmax(window)

            declustered.append(exceedances[max_idx])
            i = max_idx + self.declustering_window

        return np.array(declustered)

    def estimate_var_cvar(
        self,
        confidence: float = 0.99
    ) -> Tuple[float, float]:
        """
        Estimate Value at Risk (VaR) and Conditional VaR (CVaR)

        Args:
            confidence: Confidence level (e.g., 0.99 for 99%)

        Returns:
            Tuple of (VaR, CVaR)
        """
        if not self.fitted:
            return (0.0, 0.0)

        # VaR: quantile of the distribution
        var = self.threshold + stats.genpareto.ppf(
            confidence,
            self.gpd_shape,
            loc=0,
            scale=self.gpd_scale
        )

        # CVaR: expected value beyond VaR
        # For GPD: CVaR = VaR / (1 - shape) + scale / (1 - shape)
        if self.gpd_shape < 1:
            cvar = var / (1 - self.gpd_shape)
        else:
            cvar = var * 1.5  # Approximation for heavy tails

        return (float(var), float(cvar))
