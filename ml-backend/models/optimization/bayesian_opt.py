"""
Bayesian Optimization
Efficient parameter tuning using Gaussian Process and acquisition functions
Ideal for nightly load test optimization and parameter discovery
"""
from typing import Dict, List, Optional, Any, Tuple, Callable
import logging
import numpy as np

logger = logging.getLogger(__name__)

try:
    import torch
    from botorch.models import SingleTaskGP
    from botorch.fit import fit_gpytorch_mll
    from botorch.acquisition import ExpectedImprovement, UpperConfidenceBound
    from gpytorch.mlls import ExactMarginalLogLikelihood
    from botorch.optim import optimize_acqf
    BOTORCH_AVAILABLE = True
except ImportError:
    BOTORCH_AVAILABLE = False
    logger.warning("BoTorch not available. Install with: pip install botorch")

try:
    import optuna
    OPTUNA_AVAILABLE = True
except ImportError:
    OPTUNA_AVAILABLE = False
    logger.warning("Optuna not available. Install with: pip install optuna")


class BayesianOptimizer:
    """
    Bayesian Optimization using Gaussian Process
    For efficient hyperparameter tuning with limited evaluations
    """

    def __init__(
        self,
        bounds: Dict[str, Tuple[float, float]],
        acquisition_function: str = "ei",  # ei, ucb, poi
        explore_weight: float = 2.0
    ):
        """
        Initialize Bayesian Optimizer

        Args:
            bounds: Parameter bounds {param_name: (min, max)}
            acquisition_function: Type of acquisition function
            explore_weight: Exploration weight for UCB
        """
        self.bounds = bounds
        self.param_names = list(bounds.keys())
        self.acquisition_function = acquisition_function
        self.explore_weight = explore_weight

        # Observations
        self.X_observed: List[np.ndarray] = []
        self.y_observed: List[float] = []

        self.model = None
        self.iteration = 0

    def suggest_next(self) -> Dict[str, float]:
        """
        Suggest next parameter configuration to evaluate

        Returns:
            Dictionary of parameter values
        """
        if len(self.X_observed) < 3:
            # Random sampling for initial points
            return self._random_sample()

        if not BOTORCH_AVAILABLE:
            return self._random_sample()

        # Fit GP model
        X_train = torch.tensor(self.X_observed, dtype=torch.float64)
        y_train = torch.tensor(self.y_observed, dtype=torch.float64).unsqueeze(-1)

        gp = SingleTaskGP(X_train, y_train)
        mll = ExactMarginalLogLikelihood(gp.likelihood, gp)
        fit_gpytorch_mll(mll)

        self.model = gp

        # Define acquisition function
        if self.acquisition_function == "ei":
            acq_func = ExpectedImprovement(gp, best_f=y_train.max())
        else:  # ucb
            acq_func = UpperConfidenceBound(gp, beta=self.explore_weight)

        # Optimize acquisition function
        bounds_tensor = torch.tensor(
            [[self.bounds[name][0] for name in self.param_names],
             [self.bounds[name][1] for name in self.param_names]],
            dtype=torch.float64
        )

        candidate, acq_value = optimize_acqf(
            acq_func,
            bounds=bounds_tensor,
            q=1,
            num_restarts=10,
            raw_samples=20
        )

        # Convert to dictionary
        x_next = candidate.squeeze().numpy()
        return {
            name: float(x_next[i])
            for i, name in enumerate(self.param_names)
        }

    def observe(
        self,
        params: Dict[str, float],
        objective_value: float
    ) -> None:
        """
        Record observation from experiment

        Args:
            params: Parameter configuration
            objective_value: Measured objective (higher is better)
        """
        # Convert params to array
        x = np.array([params[name] for name in self.param_names])

        self.X_observed.append(x)
        self.y_observed.append(objective_value)
        self.iteration += 1

        logger.info(f"Iteration {self.iteration}: objective={objective_value:.4f}")

    def get_best(self) -> Tuple[Dict[str, float], float]:
        """
        Get best configuration observed so far

        Returns:
            Tuple of (best_params, best_value)
        """
        if not self.y_observed:
            return {}, 0.0

        best_idx = int(np.argmax(self.y_observed))
        best_x = self.X_observed[best_idx]
        best_y = self.y_observed[best_idx]

        best_params = {
            name: float(best_x[i])
            for i, name in enumerate(self.param_names)
        }

        return best_params, best_y

    def _random_sample(self) -> Dict[str, float]:
        """Generate random sample within bounds"""
        return {
            name: np.random.uniform(low, high)
            for name, (low, high) in self.bounds.items()
        }

    def is_converged(
        self,
        patience: int = 5,
        threshold: float = 0.01
    ) -> bool:
        """
        Check if optimization has converged

        Args:
            patience: Number of iterations without improvement
            threshold: Relative improvement threshold

        Returns:
            True if converged
        """
        if len(self.y_observed) < patience + 1:
            return False

        recent = self.y_observed[-patience:]
        best_recent = max(recent)
        best_overall = max(self.y_observed)

        relative_improvement = (best_overall - best_recent) / abs(best_overall + 1e-6)

        return relative_improvement < threshold


class OfflineOptimizer:
    """
    Offline Bayesian Optimization for nightly parameter tuning
    Optimizes system parameters based on load test results
    """

    def __init__(self):
        self.optimizer: Optional[BayesianOptimizer] = None
        self.objective_func: Optional[Callable] = None

    def setup_optimization(
        self,
        param_bounds: Dict[str, Tuple[float, float]],
        objective_func: Optional[Callable] = None
    ) -> None:
        """
        Setup optimization problem

        Args:
            param_bounds: Parameter search space
            objective_func: Function to evaluate configurations
        """
        self.optimizer = BayesianOptimizer(
            bounds=param_bounds,
            acquisition_function="ei",
            explore_weight=2.0
        )

        self.objective_func = objective_func

    def optimize_parameters(
        self,
        current_metrics: Dict[str, float],
        max_iterations: int = 50
    ) -> Dict[str, Any]:
        """
        Run optimization to find best parameters

        Args:
            current_metrics: Current system metrics
            max_iterations: Maximum optimization iterations

        Returns:
            Optimization results
        """
        # Extract metrics
        throughput = current_metrics.get("throughput", 1200)
        latency = current_metrics.get("latency", 250)
        success_rate = current_metrics.get("success_rate", 0.95)
        iteration = int(current_metrics.get("iteration", 1))

        # Simulate Bayesian optimization results
        # In practice, would run actual evaluations

        # Mock GP statistics
        gp_mean = throughput / 500
        gp_variance = np.sqrt(latency / 100)

        # Expected improvement
        ei_value = gp_mean + gp_variance * 0.5

        # Recommended parameters
        threads_default = max(1, int(throughput / 500))
        queue_size = max(50, int(throughput / 10))
        batch_size = max(10, int(throughput / 100))

        # Improvement estimation
        expected_improvement_pct = ((ei_value / max(gp_mean, 0.1)) - 1) * 100

        # Convergence check
        converged = iteration > 20 and expected_improvement_pct < 2

        return {
            "threads_default": threads_default,
            "queue_size": queue_size,
            "batch_size": batch_size,
            "gp_mean": round(gp_mean, 2),
            "gp_variance": round(gp_variance, 2),
            "expected_improvement": round(ei_value, 3),
            "expected_improvement_pct": round(expected_improvement_pct, 1),
            "converged": "yes" if converged else "no",
            "iterations_completed": iteration,
            "recommendation": "deploy_optimized_config" if converged else "continue_search"
        }

    def run_single_iteration(
        self,
        throughput: float,
        latency: float,
        success_rate: float
    ) -> Dict[str, float]:
        """
        Run single optimization iteration

        Args:
            throughput: Measured throughput
            latency: Measured latency
            success_rate: Success rate

        Returns:
            Next parameter configuration to try
        """
        if self.optimizer is None:
            # Default parameter bounds for system tuning
            self.setup_optimization({
                "threads": (1, 32),
                "queue_size": (50, 1000),
                "batch_size": (10, 200),
                "timeout_ms": (100, 5000)
            })

        # Calculate objective (higher is better)
        # Objective: maximize throughput while keeping latency low
        objective = (throughput / 1000) * success_rate - (latency / 1000)

        # If we have previous suggestions, record the result
        if hasattr(self, '_last_suggestion'):
            self.optimizer.observe(self._last_suggestion, objective)

        # Get next suggestion
        next_params = self.optimizer.suggest_next()
        self._last_suggestion = next_params

        return next_params
