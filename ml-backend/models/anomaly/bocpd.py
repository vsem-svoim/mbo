"""
Bayesian Online Change Point Detection (BOCPD)
Online detection of regime changes and deploy impacts in streaming metrics
"""
from typing import Dict, List, Optional, Any, Tuple
import logging
import numpy as np
from datetime import datetime

logger = logging.getLogger(__name__)

try:
    from scipy import stats
    SCIPY_AVAILABLE = True
except ImportError:
    SCIPY_AVAILABLE = False


class BOCPDModel:
    """
    Bayesian Online Change Point Detection
    Detects regime changes in streaming time series data
    """

    def __init__(
        self,
        hazard_rate: float = 1/250,  # Expected changepoint every 250 observations
        threshold: float = 0.5,  # Changepoint probability threshold
        observation_model: str = "gaussian"  # gaussian or student_t
    ):
        """
        Initialize BOCPD model

        Args:
            hazard_rate: Prior probability of changepoint at each step
            threshold: Probability threshold for declaring changepoint
            observation_model: Model for observations (gaussian, student_t)
        """
        self.hazard_rate = hazard_rate
        self.threshold = threshold
        self.observation_model = observation_model

        # State variables
        self.run_length_dist: Optional[np.ndarray] = None
        self.observation_params: List[Dict[str, float]] = []
        self.changepoints: List[int] = []
        self.step = 0

    def update(
        self,
        observation: float
    ) -> Tuple[float, int]:
        """
        Process new observation and update changepoint beliefs

        Args:
            observation: New data point

        Returns:
            Tuple of (changepoint_probability, most_likely_run_length)
        """
        if not SCIPY_AVAILABLE:
            return self._simple_update(observation)

        # Initialize on first observation
        if self.run_length_dist is None:
            self.run_length_dist = np.array([1.0])
            self.observation_params = [{"mean": observation, "var": 1.0, "n": 1}]
            self.step = 0
            return 0.0, 0

        # Compute observation likelihood for each run length
        n_run_lengths = len(self.run_length_dist)
        likelihoods = np.zeros(n_run_lengths)

        for r in range(n_run_lengths):
            params = self.observation_params[r]

            if self.observation_model == "gaussian":
                # Use predictive distribution (Student's t)
                mu = params["mean"]
                var = params["var"]
                n = params["n"]

                # Student's t predictive distribution
                df = max(1, n - 1)
                scale = np.sqrt(var * (n + 1) / n)
                likelihoods[r] = stats.t.pdf(observation, df=df, loc=mu, scale=scale)
            else:
                # Simple Gaussian likelihood
                mu = params["mean"]
                std = max(0.1, np.sqrt(params["var"]))
                likelihoods[r] = stats.norm.pdf(observation, loc=mu, scale=std)

        # Avoid numerical issues
        likelihoods = np.maximum(likelihoods, 1e-10)

        # Update run length distribution
        # P(r_t | x_1:t) ∝ P(x_t | r_{t-1}) * P(r_t | r_{t-1})

        # Growth probabilities (no changepoint)
        growth_probs = self.run_length_dist * likelihoods * (1 - self.hazard_rate)

        # Changepoint probability
        changepoint_prob = np.sum(self.run_length_dist * likelihoods * self.hazard_rate)

        # New run length distribution
        new_run_length_dist = np.zeros(n_run_lengths + 1)
        new_run_length_dist[0] = changepoint_prob
        new_run_length_dist[1:] = growth_probs

        # Normalize
        new_run_length_dist = new_run_length_dist / np.sum(new_run_length_dist)

        # Update observation parameters
        new_params = [{"mean": observation, "var": 1.0, "n": 1}]  # For r=0

        for r in range(n_run_lengths):
            params = self.observation_params[r]
            n = params["n"] + 1
            mean = params["mean"] + (observation - params["mean"]) / n

            # Update variance
            if n > 1:
                var = ((n - 2) * params["var"] + (observation - params["mean"]) ** 2 / n) / (n - 1)
            else:
                var = 1.0

            new_params.append({"mean": mean, "var": max(0.1, var), "n": n})

        # Update state
        self.run_length_dist = new_run_length_dist
        self.observation_params = new_params

        # Most likely run length
        most_likely_run_length = int(np.argmax(new_run_length_dist))

        # Changepoint detection
        if changepoint_prob > self.threshold:
            self.changepoints.append(self.step)
            logger.info(f"Changepoint detected at step {self.step} (prob={changepoint_prob:.3f})")

        self.step += 1

        return float(changepoint_prob), most_likely_run_length

    def detect_regime_change(
        self,
        current_metrics: Dict[str, float]
    ) -> Dict[str, Any]:
        """
        Detect regime changes from current metrics

        Args:
            current_metrics: Current system metrics

        Returns:
            Regime detection results
        """
        p99 = current_metrics.get("p99", 300)
        error_rate = current_metrics.get("error_rate", 0.02)
        throughput = current_metrics.get("throughput", 1000)

        # Simulate changepoint detection
        # In practice, you would call update() for each observation
        change_prob, run_length = self.update(p99)

        # Alternative: use heuristic when model isn't initialized
        if self.run_length_dist is None:
            change_prob = min(0.99, (p99 / 1000) + (error_rate * 5))
            run_length = int(current_metrics.get("window_observations", 100) * (1 - change_prob))

        # Determine regime state
        if change_prob > 0.7:
            regime_state = "transitioning"
        elif change_prob > 0.3:
            regime_state = "unstable"
        else:
            regime_state = "stable"

        # Freeze exploration if unstable
        freeze_exploration = change_prob > 0.5

        # Recommended action
        if freeze_exploration:
            action = "freeze_unsafe_exploration"
        else:
            action = "continue_monitoring"

        return {
            "change_probability": round(change_prob, 3),
            "regime_state": regime_state,
            "run_length": run_length,
            "freeze_exploration": "yes" if freeze_exploration else "no",
            "hazard_rate": self.hazard_rate,
            "observation_likelihood": round(np.random.random(), 4),  # Mock for now
            "action": action,
            "changepoints_detected": len(self.changepoints)
        }

    def _simple_update(
        self,
        observation: float
    ) -> Tuple[float, int]:
        """
        Simple changepoint detection without scipy

        Args:
            observation: New observation

        Returns:
            Tuple of (changepoint_probability, run_length)
        """
        # Simple heuristic-based detection
        if not hasattr(self, 'recent_values'):
            self.recent_values = []

        self.recent_values.append(observation)

        # Keep window of recent values
        if len(self.recent_values) > 100:
            self.recent_values = self.recent_values[-100:]

        if len(self.recent_values) < 10:
            return 0.0, len(self.recent_values)

        # Detect change using mean shift
        recent_mean = np.mean(self.recent_values[-10:])
        overall_mean = np.mean(self.recent_values)
        overall_std = np.std(self.recent_values)

        if overall_std > 0:
            z_score = abs(recent_mean - overall_mean) / overall_std
            change_prob = min(0.99, z_score / 3.0)  # Normalize to [0, 1]
        else:
            change_prob = 0.0

        run_length = len(self.recent_values)

        return change_prob, run_length

    def reset(self) -> None:
        """Reset the model state"""
        self.run_length_dist = None
        self.observation_params = []
        self.changepoints = []
        self.step = 0
