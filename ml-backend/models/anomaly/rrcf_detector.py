"""
Robust Random Cut Forest (RRCF)
Streaming anomaly detection with point deletion capability
Ideal for real-time monitoring of time series data
"""
from typing import Dict, List, Optional, Any, Deque
from collections import deque
import logging
import numpy as np

logger = logging.getLogger(__name__)

try:
    import rrcf
    RRCF_AVAILABLE = True
except ImportError:
    RRCF_AVAILABLE = False
    logger.warning("RRCF not available. Install with: pip install rrcf")


class RRCFDetector:
    """
    Robust Random Cut Forest for streaming anomaly detection
    Maintains a forest of random cut trees for online anomaly scoring
    """

    def __init__(
        self,
        num_trees: int = 40,
        shingle_size: int = 4,
        tree_size: int = 256,
        threshold_percentile: float = 0.95
    ):
        """
        Initialize RRCF detector

        Args:
            num_trees: Number of trees in the forest
            shingle_size: Window size for streaming context
            tree_size: Maximum points per tree
            threshold_percentile: Percentile for anomaly threshold
        """
        self.num_trees = num_trees
        self.shingle_size = shingle_size
        self.tree_size = tree_size
        self.threshold_percentile = threshold_percentile

        self.forest: List[Any] = []
        self.shingle: Deque = deque(maxlen=shingle_size)
        self.scores_history: List[float] = []
        self.threshold: Optional[float] = None
        self.initialized = False

    def initialize(self) -> None:
        """Initialize the forest"""
        if not RRCF_AVAILABLE:
            logger.warning("RRCF not available, using fallback")
            self.initialized = False
            return

        self.forest = []
        for _ in range(self.num_trees):
            tree = rrcf.RCTree()
            self.forest.append(tree)

        self.initialized = True
        logger.info(f"Initialized RRCF with {self.num_trees} trees")

    def update(
        self,
        point: np.ndarray,
        index: Optional[int] = None
    ) -> float:
        """
        Process new point and calculate anomaly score

        Args:
            point: New data point (can be multi-dimensional)
            index: Optional index for the point

        Returns:
            Anomaly score (higher = more anomalous)
        """
        if not self.initialized:
            if RRCF_AVAILABLE:
                self.initialize()
            else:
                return self._simple_anomaly_score(point)

        # Add point to shingle (sliding window)
        self.shingle.append(point)

        if len(self.shingle) < self.shingle_size:
            return 0.0  # Not enough context yet

        # Convert shingle to feature vector
        shingle_vector = np.concatenate(list(self.shingle))

        # Use current timestamp as index if not provided
        if index is None:
            index = len(self.scores_history)

        # Insert point into trees and compute CoDisp
        codisp_scores = []

        for tree in self.forest:
            # Insert point
            tree.insert_point(shingle_vector, index=index)

            # If tree is full, forget oldest point
            if len(tree.leaves) > self.tree_size:
                oldest_index = index - self.tree_size
                if oldest_index in tree.leaves:
                    tree.forget_point(oldest_index)

            # Compute collusive displacement (CoDisp)
            if index in tree.leaves:
                codisp = tree.codisp(index)
                codisp_scores.append(codisp)

        # Average CoDisp across trees
        if codisp_scores:
            avg_codisp = np.mean(codisp_scores)
        else:
            avg_codisp = 0.0

        # Update score history
        self.scores_history.append(avg_codisp)

        # Update threshold
        if len(self.scores_history) > 50:
            self.threshold = np.percentile(
                self.scores_history[-1000:],  # Use recent history
                self.threshold_percentile * 100
            )

        return float(avg_codisp)

    def detect_anomaly(
        self,
        features: Dict[str, float],
        index: Optional[int] = None
    ) -> Dict[str, Any]:
        """
        Detect anomalies in streaming metrics

        Args:
            features: Current metric values
            index: Optional time index

        Returns:
            Anomaly detection results
        """
        # Convert features to array
        point = np.array([
            features.get("p99_latency", 400),
            features.get("error_rate", 0.01) * 1000,  # Scale up
            features.get("throughput", 1000) / 1000,  # Scale down
            features.get("cpu_usage", 0.7) * 100  # Convert to percentage
        ])

        # Get anomaly score
        codisp_score = self.update(point, index)

        # Determine if anomalous
        is_anomaly = False
        if self.threshold is not None:
            is_anomaly = codisp_score > self.threshold
        elif codisp_score > 3.0:  # Default heuristic
            is_anomaly = True

        # Classify severity
        if is_anomaly:
            if codisp_score > 10.0:
                severity = "critical"
            elif codisp_score > 5.0:
                severity = "high"
            else:
                severity = "medium"
        else:
            severity = "normal"

        return {
            "is_anomaly": is_anomaly,
            "codisp_score": round(codisp_score, 3),
            "threshold": round(self.threshold, 3) if self.threshold else None,
            "severity": severity,
            "num_trees": self.num_trees,
            "shingle_size": self.shingle_size,
            "method": "rrcf"
        }

    def _simple_anomaly_score(
        self,
        point: np.ndarray
    ) -> float:
        """
        Simple anomaly scoring when RRCF is not available

        Args:
            point: Data point

        Returns:
            Anomaly score
        """
        # Use simple statistical method
        if not hasattr(self, '_history'):
            self._history = []

        self._history.append(point)

        if len(self._history) < 10:
            return 0.0

        # Keep window
        if len(self._history) > 100:
            self._history = self._history[-100:]

        # Calculate z-score
        history_array = np.array(self._history)
        mean = np.mean(history_array, axis=0)
        std = np.std(history_array, axis=0)

        if np.any(std == 0):
            return 0.0

        z_scores = np.abs((point - mean) / std)
        anomaly_score = np.max(z_scores)

        return float(anomaly_score)

    def reset(self) -> None:
        """Reset the detector state"""
        self.forest = []
        self.shingle.clear()
        self.scores_history = []
        self.threshold = None
        self.initialized = False
