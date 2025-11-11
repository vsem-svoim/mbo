"""
Contextual Bandits (UCB/Thompson Sampling)
Online configuration selection with safe exploration bounds
Ideal for A/B testing and canary analysis
"""
from typing import Dict, List, Optional, Any, Tuple
import logging
import numpy as np
from dataclasses import dataclass

logger = logging.getLogger(__name__)


@dataclass
class BanditArm:
    """Represents a configuration/arm in the bandit"""
    config_id: int
    name: str
    rewards: List[float]
    contexts: List[np.ndarray]
    n_pulls: int = 0

    @property
    def mean_reward(self) -> float:
        """Average reward"""
        return np.mean(self.rewards) if self.rewards else 0.0

    @property
    def std_reward(self) -> float:
        """Standard deviation of rewards"""
        return np.std(self.rewards) if len(self.rewards) > 1 else 1.0


class ContextualBanditUCB:
    """
    Upper Confidence Bound (UCB) Contextual Bandit
    Balances exploitation and exploration with confidence bounds
    """

    def __init__(
        self,
        num_arms: int,
        exploration_factor: float = 2.0,
        context_dim: Optional[int] = None
    ):
        """
        Initialize UCB bandit

        Args:
            num_arms: Number of configurations
            exploration_factor: UCB exploration parameter (c)
            context_dim: Dimension of context features
        """
        self.num_arms = num_arms
        self.exploration_factor = exploration_factor
        self.context_dim = context_dim

        # Initialize arms
        self.arms: List[BanditArm] = [
            BanditArm(
                config_id=i,
                name=f"config_{i}",
                rewards=[],
                contexts=[]
            )
            for i in range(num_arms)
        ]

        self.total_pulls = 0

    def select_arm(
        self,
        context: Optional[np.ndarray] = None
    ) -> int:
        """
        Select arm using UCB algorithm

        Args:
            context: Optional context features

        Returns:
            Selected arm index
        """
        # Ensure all arms have been pulled at least once
        for i, arm in enumerate(self.arms):
            if arm.n_pulls == 0:
                return i

        # Compute UCB for each arm
        ucb_scores = []
        for arm in self.arms:
            mean_reward = arm.mean_reward

            # UCB formula: mean + c * sqrt(log(total_pulls) / arm_pulls)
            exploration_bonus = self.exploration_factor * np.sqrt(
                np.log(self.total_pulls + 1) / (arm.n_pulls + 1)
            )

            ucb = mean_reward + exploration_bonus
            ucb_scores.append(ucb)

        # Select arm with highest UCB
        return int(np.argmax(ucb_scores))

    def update(
        self,
        arm_id: int,
        reward: float,
        context: Optional[np.ndarray] = None
    ) -> None:
        """
        Update arm statistics with observed reward

        Args:
            arm_id: Arm that was pulled
            reward: Observed reward
            context: Context features
        """
        arm = self.arms[arm_id]
        arm.rewards.append(reward)
        arm.n_pulls += 1
        self.total_pulls += 1

        if context is not None:
            arm.contexts.append(context)

    def get_best_arm(self) -> int:
        """Get arm with highest mean reward"""
        mean_rewards = [arm.mean_reward for arm in self.arms]
        return int(np.argmax(mean_rewards))

    def get_statistics(self) -> Dict[str, Any]:
        """Get bandit statistics"""
        return {
            "total_pulls": self.total_pulls,
            "arms": [
                {
                    "config_id": arm.config_id,
                    "name": arm.name,
                    "n_pulls": arm.n_pulls,
                    "mean_reward": round(arm.mean_reward, 4),
                    "std_reward": round(arm.std_reward, 4)
                }
                for arm in self.arms
            ]
        }


class ThompsonSamplingBandit:
    """
    Thompson Sampling Contextual Bandit
    Bayesian approach using posterior sampling
    """

    def __init__(
        self,
        num_arms: int,
        prior_alpha: float = 1.0,
        prior_beta: float = 1.0
    ):
        """
        Initialize Thompson Sampling bandit

        Args:
            num_arms: Number of configurations
            prior_alpha: Beta prior alpha (successes)
            prior_beta: Beta prior beta (failures)
        """
        self.num_arms = num_arms

        # Beta distribution parameters for each arm
        self.alpha = np.ones(num_arms) * prior_alpha
        self.beta = np.ones(num_arms) * prior_beta

        self.n_pulls = np.zeros(num_arms)

    def select_arm(self) -> int:
        """
        Select arm using Thompson Sampling

        Returns:
            Selected arm index
        """
        # Sample from posterior Beta distribution for each arm
        samples = np.random.beta(self.alpha, self.beta)

        # Select arm with highest sample
        return int(np.argmax(samples))

    def update(
        self,
        arm_id: int,
        reward: float
    ) -> None:
        """
        Update posterior distributions

        Args:
            arm_id: Arm that was pulled
            reward: Observed reward (assumed to be in [0, 1])
        """
        # Update Beta distribution parameters
        self.alpha[arm_id] += reward
        self.beta[arm_id] += (1 - reward)
        self.n_pulls[arm_id] += 1

    def get_statistics(self) -> Dict[str, Any]:
        """Get bandit statistics"""
        return {
            "arms": [
                {
                    "config_id": i,
                    "alpha": float(self.alpha[i]),
                    "beta": float(self.beta[i]),
                    "mean_reward": float(self.alpha[i] / (self.alpha[i] + self.beta[i])),
                    "n_pulls": int(self.n_pulls[i])
                }
                for i in range(self.num_arms)
            ]
        }


class OnlineTuningBandit:
    """
    Combined UCB + Thompson Sampling for online configuration tuning
    Includes safety features for canary deployments
    """

    def __init__(
        self,
        num_configs: int = 5,
        method: str = "thompson_sampling",  # or "ucb"
        exploration_factor: float = 0.2
    ):
        """
        Initialize online tuning bandit

        Args:
            num_configs: Number of configurations to evaluate
            method: Selection method (thompson_sampling or ucb)
            exploration_factor: Exploration parameter
        """
        self.num_configs = num_configs
        self.method = method

        if method == "ucb":
            self.bandit = ContextualBanditUCB(
                num_arms=num_configs,
                exploration_factor=exploration_factor * 10
            )
        else:  # thompson_sampling
            self.bandit = ThompsonSamplingBandit(num_arms=num_configs)

    def select_config(
        self,
        current_metrics: Dict[str, float],
        freeze_on_anomaly: bool = True
    ) -> Dict[str, Any]:
        """
        Select best configuration for canary deployment

        Args:
            current_metrics: Current system metrics
            freeze_on_anomaly: Freeze exploration if anomaly detected

        Returns:
            Configuration selection with exploration/exploitation balance
        """
        canary_metric = current_metrics.get("canary_metric", 0.4)

        # Check if we should freeze exploration
        if freeze_on_anomaly and canary_metric < 0.3:
            # Return safest known configuration
            if hasattr(self.bandit, 'get_best_arm'):
                best_config_id = self.bandit.get_best_arm()
            else:
                best_config_id = 0  # Default to first config

            return {
                "best_config_id": best_config_id + 1,  # 1-indexed
                "action": "exploit",
                "reason": "anomaly_detected_frozen",
                "freeze_on_anomaly": "yes",
                "canary_percentage": 0,
                "expected_reward": 0.0
            }

        # Select configuration
        if self.method == "ucb":
            selected_arm = self.bandit.select_arm()
            stats = self.bandit.get_statistics()

            # Calculate exploit vs explore probability
            mean_rewards = [arm['mean_reward'] for arm in stats['arms']]
            best_arm = int(np.argmax(mean_rewards))

            exploit_prob = 0.9 if selected_arm == best_arm else 0.1
            explore_prob = 1 - exploit_prob

            # Expected reward
            expected_reward = mean_rewards[selected_arm] if mean_rewards else 0.5

        else:  # thompson_sampling
            selected_arm = self.bandit.select_arm()
            stats = self.bandit.get_statistics()

            # TS naturally balances exploration/exploitation
            mean_reward = stats['arms'][selected_arm]['mean_reward']
            exploit_prob = min(0.95, canary_metric + 0.3)
            explore_prob = 1 - exploit_prob
            expected_reward = mean_reward

        # Determine canary percentage based on confidence
        canary_percentage = min(5, max(1, int(canary_metric * 10)))

        return {
            "best_config_id": selected_arm + 1,  # 1-indexed
            "expected_reward": round(expected_reward, 3),
            "ucb_bound": round(expected_reward + 0.1, 3),  # Approximate UCB
            "exploit_probability": round(exploit_prob, 2),
            "explore_probability": round(explore_prob, 2),
            "canary_percentage": canary_percentage,
            "freeze_on_anomaly": "no",
            "context_features_used": len(current_metrics),
            "method": self.method
        }

    def update_feedback(
        self,
        config_id: int,
        reward: float
    ) -> None:
        """
        Update bandit with observed reward from canary

        Args:
            config_id: Configuration ID (1-indexed)
            reward: Observed reward metric
        """
        arm_id = config_id - 1  # Convert to 0-indexed

        # Normalize reward to [0, 1] if needed
        normalized_reward = max(0.0, min(1.0, reward))

        self.bandit.update(arm_id, normalized_reward)
