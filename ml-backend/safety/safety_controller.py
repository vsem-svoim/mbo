"""
Safety Controller
Validates ML model outputs and enforces safety constraints
Provides emergency fallbacks and human override capabilities
"""
from typing import Dict, List, Optional, Any, Callable
from enum import Enum
import logging
from datetime import datetime
from dataclasses import dataclass

logger = logging.getLogger(__name__)


class SafetyLevel(Enum):
    """Safety levels for model outputs"""
    SAFE = "safe"
    WARNING = "warning"
    UNSAFE = "unsafe"
    CRITICAL = "critical"


@dataclass
class SafetyCheck:
    """Represents a safety validation check"""
    name: str
    check_fn: Callable
    severity: SafetyLevel
    description: str
    enabled: bool = True


@dataclass
class SafetyValidationResult:
    """Result of safety validation"""
    is_safe: bool
    safety_level: SafetyLevel
    violations: List[str]
    warnings: List[str]
    metadata: Dict[str, Any]


class SafetyController:
    """
    Safety controller for ML model outputs
    Validates predictions and enforces safety constraints
    """

    def __init__(self):
        self.checks: Dict[str, List[SafetyCheck]] = {}
        self.human_override_active = False
        self.emergency_mode = False
        self.violation_history: List[Dict[str, Any]] = []

    def register_check(
        self,
        model_type: str,
        check_name: str,
        check_fn: Callable,
        severity: SafetyLevel,
        description: str
    ) -> None:
        """
        Register a safety check for a model type

        Args:
            model_type: Type of model (capacity, tail_slo, etc.)
            check_name: Name of the check
            check_fn: Function that validates output (returns bool)
            severity: Severity level if check fails
            description: Human-readable description
        """
        if model_type not in self.checks:
            self.checks[model_type] = []

        check = SafetyCheck(
            name=check_name,
            check_fn=check_fn,
            severity=severity,
            description=description
        )

        self.checks[model_type].append(check)
        logger.info(f"Registered safety check '{check_name}' for {model_type}")

    def validate(
        self,
        model_type: str,
        model_output: Dict[str, Any],
        context: Optional[Dict[str, Any]] = None
    ) -> SafetyValidationResult:
        """
        Validate model output against safety checks

        Args:
            model_type: Type of model
            model_output: Model predictions/outputs
            context: Additional context for validation

        Returns:
            SafetyValidationResult
        """
        if self.emergency_mode:
            logger.warning("Emergency mode active - rejecting all outputs")
            return SafetyValidationResult(
                is_safe=False,
                safety_level=SafetyLevel.CRITICAL,
                violations=["emergency_mode_active"],
                warnings=[],
                metadata={"emergency_mode": True}
            )

        if self.human_override_active:
            logger.info("Human override active - bypassing safety checks")
            return SafetyValidationResult(
                is_safe=True,
                safety_level=SafetyLevel.SAFE,
                violations=[],
                warnings=["human_override_active"],
                metadata={"human_override": True}
            )

        # Run all checks for this model type
        violations = []
        warnings = []
        highest_severity = SafetyLevel.SAFE

        checks = self.checks.get(model_type, [])

        for check in checks:
            if not check.enabled:
                continue

            try:
                passed = check.check_fn(model_output, context)

                if not passed:
                    if check.severity in [SafetyLevel.UNSAFE, SafetyLevel.CRITICAL]:
                        violations.append(f"{check.name}: {check.description}")

                        # Update highest severity
                        if check.severity.value == SafetyLevel.CRITICAL.value:
                            highest_severity = SafetyLevel.CRITICAL
                        elif highest_severity != SafetyLevel.CRITICAL:
                            highest_severity = SafetyLevel.UNSAFE

                    elif check.severity == SafetyLevel.WARNING:
                        warnings.append(f"{check.name}: {check.description}")
                        if highest_severity == SafetyLevel.SAFE:
                            highest_severity = SafetyLevel.WARNING

            except Exception as e:
                logger.error(f"Safety check '{check.name}' failed with error: {e}")
                violations.append(f"{check.name}: check_error")
                highest_severity = SafetyLevel.UNSAFE

        # Record violations
        if violations:
            self.violation_history.append({
                "timestamp": datetime.now().isoformat(),
                "model_type": model_type,
                "violations": violations,
                "output": model_output
            })

        is_safe = len(violations) == 0

        return SafetyValidationResult(
            is_safe=is_safe,
            safety_level=highest_severity,
            violations=violations,
            warnings=warnings,
            metadata={
                "model_type": model_type,
                "checks_run": len(checks),
                "timestamp": datetime.now().isoformat()
            }
        )

    def get_fallback_output(
        self,
        model_type: str,
        context: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Get safe fallback output when model output is rejected

        Args:
            model_type: Type of model
            context: Context for fallback generation

        Returns:
            Safe fallback output
        """
        logger.warning(f"Using fallback output for {model_type}")

        # Model-specific fallbacks
        fallbacks = {
            "capacity_planning": {
                "next_hour_workers": 5,  # Conservative worker count
                "queue_capacity": 200,
                "action": "maintain_current",
                "guardrail": "safety_fallback"
            },
            "tail_slo": {
                "action": "admit_throttle",  # Conservative admission control
                "autoscale_workers": 0,
                "recommendation": "manual_review_required"
            },
            "bandit": {
                "best_config_id": 1,  # Default/safest config
                "action": "exploit",
                "reason": "safety_fallback"
            },
            "extreme_events": {
                "alert_level": "warning",
                "persistence_required": "yes"
            }
        }

        return fallbacks.get(model_type, {"action": "no_action", "reason": "safety_fallback"})

    def enable_emergency_mode(self, reason: str) -> None:
        """
        Activate emergency mode (blocks all model outputs)

        Args:
            reason: Reason for emergency mode
        """
        self.emergency_mode = True
        logger.critical(f"Emergency mode activated: {reason}")

    def disable_emergency_mode(self) -> None:
        """Deactivate emergency mode"""
        self.emergency_mode = False
        logger.info("Emergency mode deactivated")

    def enable_human_override(self) -> None:
        """Enable human override (bypasses safety checks)"""
        self.human_override_active = True
        logger.warning("Human override enabled - safety checks bypassed")

    def disable_human_override(self) -> None:
        """Disable human override"""
        self.human_override_active = False
        logger.info("Human override disabled")


# Global safety controller instance
_safety_controller = SafetyController()


def get_safety_controller() -> SafetyController:
    """Get global safety controller"""
    return _safety_controller


def register_default_safety_checks() -> None:
    """Register default safety checks for all model types"""
    controller = get_safety_controller()

    # === Capacity Planning Safety Checks ===
    controller.register_check(
        "capacity_planning",
        "worker_count_reasonable",
        lambda out, ctx: 1 <= out.get("next_hour_workers", 0) <= 100,
        SafetyLevel.UNSAFE,
        "Worker count must be between 1 and 100"
    )

    controller.register_check(
        "capacity_planning",
        "queue_capacity_reasonable",
        lambda out, ctx: 50 <= out.get("queue_capacity", 0) <= 10000,
        SafetyLevel.WARNING,
        "Queue capacity should be between 50 and 10000"
    )

    # === Tail SLO Safety Checks ===
    controller.register_check(
        "tail_slo",
        "latency_predictions_reasonable",
        lambda out, ctx: out.get("p99_pred", 0) < 5000,
        SafetyLevel.WARNING,
        "P99 prediction seems unreasonably high (>5s)"
    )

    controller.register_check(
        "tail_slo",
        "autoscale_within_limits",
        lambda out, ctx: out.get("autoscale_workers", 0) <= 50,
        SafetyLevel.UNSAFE,
        "Autoscale recommendation exceeds limit (50 workers)"
    )

    # === Bandit Safety Checks ===
    controller.register_check(
        "bandit",
        "canary_percentage_safe",
        lambda out, ctx: 0 <= out.get("canary_percentage", 0) <= 10,
        SafetyLevel.CRITICAL,
        "Canary percentage must be between 0-10%"
    )

    controller.register_check(
        "bandit",
        "freeze_on_low_metric",
        lambda out, ctx: not (ctx.get("canary_metric", 1.0) < 0.2 and out.get("freeze_on_anomaly") != "yes"),
        SafetyLevel.UNSAFE,
        "Should freeze exploration when canary metric is very low"
    )

    # === Extreme Events Safety Checks ===
    controller.register_check(
        "extreme_events",
        "require_persistence",
        lambda out, ctx: out.get("alert_level") != "critical" or out.get("persistence_required") == "yes",
        SafetyLevel.WARNING,
        "Critical alerts should require persistence checks"
    )

    logger.info("Default safety checks registered")
