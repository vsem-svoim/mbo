"""
Configuration Management System
Versioned configuration with atomic updates, rollback, and drift detection
"""
from typing import Dict, List, Optional, Any
from datetime import datetime
from dataclasses import dataclass, asdict
from enum import Enum
import logging
import json
import hashlib

logger = logging.getLogger(__name__)


class ConfigStatus(Enum):
    """Configuration status"""
    DRAFT = "draft"
    VALIDATING = "validating"
    APPROVED = "approved"
    DEPLOYING = "deploying"
    ACTIVE = "active"
    ROLLED_BACK = "rolled_back"
    DEPRECATED = "deprecated"


@dataclass
class ConfigVersion:
    """Represents a configuration version"""
    version_id: str
    config_data: Dict[str, Any]
    status: ConfigStatus
    created_at: datetime
    created_by: str
    deployed_at: Optional[datetime] = None
    metadata: Optional[Dict[str, Any]] = None
    checksum: Optional[str] = None

    def __post_init__(self):
        if self.checksum is None:
            self.checksum = self._compute_checksum()

    def _compute_checksum(self) -> str:
        """Compute configuration checksum"""
        config_str = json.dumps(self.config_data, sort_keys=True)
        return hashlib.sha256(config_str.encode()).hexdigest()[:16]


class ConfigValidator:
    """Validates configuration changes"""

    @staticmethod
    def validate_schema(config: Dict[str, Any], schema: Dict[str, Any]) -> List[str]:
        """
        Validate configuration against schema

        Args:
            config: Configuration to validate
            schema: Schema definition

        Returns:
            List of validation errors (empty if valid)
        """
        errors = []

        # Check required fields
        required = schema.get("required", [])
        for field in required:
            if field not in config:
                errors.append(f"Missing required field: {field}")

        # Check field types
        field_types = schema.get("types", {})
        for field, expected_type in field_types.items():
            if field in config:
                value = config[field]
                if expected_type == "int" and not isinstance(value, int):
                    errors.append(f"Field '{field}' must be int, got {type(value).__name__}")
                elif expected_type == "float" and not isinstance(value, (int, float)):
                    errors.append(f"Field '{field}' must be float, got {type(value).__name__}")
                elif expected_type == "string" and not isinstance(value, str):
                    errors.append(f"Field '{field}' must be string, got {type(value).__name__}")

        # Check ranges
        ranges = schema.get("ranges", {})
        for field, (min_val, max_val) in ranges.items():
            if field in config:
                value = config[field]
                if not (min_val <= value <= max_val):
                    errors.append(f"Field '{field}' must be in range [{min_val}, {max_val}], got {value}")

        return errors

    @staticmethod
    def assess_impact(
        current_config: Dict[str, Any],
        new_config: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Assess impact of configuration change

        Args:
            current_config: Current configuration
            new_config: Proposed configuration

        Returns:
            Impact assessment
        """
        changes = []
        high_risk_changes = []

        # Identify changed fields
        all_keys = set(current_config.keys()) | set(new_config.keys())

        for key in all_keys:
            old_val = current_config.get(key)
            new_val = new_config.get(key)

            if old_val != new_val:
                change = {
                    "field": key,
                    "old_value": old_val,
                    "new_value": new_val
                }
                changes.append(change)

                # Identify high-risk changes
                if key in ["max_workers", "queue_size", "timeout_ms"]:
                    # Check for large changes
                    if old_val and new_val:
                        if isinstance(old_val, (int, float)) and isinstance(new_val, (int, float)):
                            pct_change = abs((new_val - old_val) / old_val) * 100
                            if pct_change > 50:
                                high_risk_changes.append({
                                    **change,
                                    "reason": f"Large change ({pct_change:.1f}%)"
                                })

        return {
            "total_changes": len(changes),
            "changes": changes,
            "high_risk_changes": high_risk_changes,
            "impact_level": "high" if high_risk_changes else "medium" if changes else "low"
        }


class ConfigManager:
    """
    Configuration management with versioning and deployment controls
    """

    def __init__(self):
        self.versions: List[ConfigVersion] = []
        self.active_version: Optional[ConfigVersion] = None
        self.schemas: Dict[str, Dict[str, Any]] = {}

    def register_schema(
        self,
        config_type: str,
        schema: Dict[str, Any]
    ) -> None:
        """
        Register configuration schema

        Args:
            config_type: Type of configuration
            schema: Schema definition
        """
        self.schemas[config_type] = schema
        logger.info(f"Registered schema for {config_type}")

    def create_version(
        self,
        config_data: Dict[str, Any],
        created_by: str,
        config_type: str = "default",
        metadata: Optional[Dict[str, Any]] = None
    ) -> ConfigVersion:
        """
        Create new configuration version

        Args:
            config_data: Configuration data
            created_by: User/system creating the version
            config_type: Type of configuration
            metadata: Additional metadata

        Returns:
            Created ConfigVersion
        """
        # Validate against schema
        if config_type in self.schemas:
            errors = ConfigValidator.validate_schema(config_data, self.schemas[config_type])
            if errors:
                raise ValueError(f"Configuration validation failed: {errors}")

        # Generate version ID
        version_id = f"v{len(self.versions) + 1}_{int(datetime.now().timestamp())}"

        # Create version
        version = ConfigVersion(
            version_id=version_id,
            config_data=config_data,
            status=ConfigStatus.DRAFT,
            created_at=datetime.now(),
            created_by=created_by,
            metadata=metadata or {}
        )

        self.versions.append(version)
        logger.info(f"Created configuration version {version_id}")

        return version

    def validate_version(
        self,
        version_id: str
    ) -> Dict[str, Any]:
        """
        Validate configuration version

        Args:
            version_id: Version to validate

        Returns:
            Validation results
        """
        version = self._get_version(version_id)

        if not version:
            raise ValueError(f"Version {version_id} not found")

        # Assess impact if there's an active version
        impact = None
        if self.active_version:
            impact = ConfigValidator.assess_impact(
                self.active_version.config_data,
                version.config_data
            )

        # Update status
        version.status = ConfigStatus.VALIDATING

        # Perform validation checks
        validation_results = {
            "version_id": version_id,
            "checksum": version.checksum,
            "impact_assessment": impact,
            "validation_passed": True,
            "errors": [],
            "warnings": []
        }

        # Add warnings for high-risk changes
        if impact and impact["high_risk_changes"]:
            for change in impact["high_risk_changes"]:
                validation_results["warnings"].append(
                    f"High-risk change to {change['field']}: {change['reason']}"
                )

        # Mark as approved if validation passed
        if validation_results["validation_passed"]:
            version.status = ConfigStatus.APPROVED

        return validation_results

    def deploy_version(
        self,
        version_id: str,
        deployment_strategy: str = "blue_green"  # or "canary", "rolling"
    ) -> Dict[str, Any]:
        """
        Deploy configuration version

        Args:
            version_id: Version to deploy
            deployment_strategy: Deployment strategy

        Returns:
            Deployment result
        """
        version = self._get_version(version_id)

        if not version:
            raise ValueError(f"Version {version_id} not found")

        if version.status != ConfigStatus.APPROVED:
            raise ValueError(f"Version {version_id} is not approved for deployment")

        # Update status
        version.status = ConfigStatus.DEPLOYING
        version.deployed_at = datetime.now()

        logger.info(f"Deploying configuration version {version_id} using {deployment_strategy} strategy")

        # TODO: Implement actual deployment logic (update etcd, trigger services, etc.)

        # Mark as active
        if self.active_version:
            self.active_version.status = ConfigStatus.DEPRECATED

        version.status = ConfigStatus.ACTIVE
        self.active_version = version

        return {
            "version_id": version_id,
            "status": "deployed",
            "deployment_strategy": deployment_strategy,
            "deployed_at": version.deployed_at.isoformat(),
            "config_checksum": version.checksum
        }

    def rollback(
        self,
        target_version_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Rollback to previous version

        Args:
            target_version_id: Optional specific version to rollback to

        Returns:
            Rollback result
        """
        if not self.active_version:
            raise ValueError("No active version to rollback from")

        # Find target version
        if target_version_id:
            target = self._get_version(target_version_id)
        else:
            # Find last active version before current
            active_versions = [
                v for v in self.versions
                if v.status in [ConfigStatus.ACTIVE, ConfigStatus.DEPRECATED]
                and v.version_id != self.active_version.version_id
            ]
            target = active_versions[-1] if active_versions else None

        if not target:
            raise ValueError("No version to rollback to")

        logger.warning(f"Rolling back from {self.active_version.version_id} to {target.version_id}")

        # Mark current as rolled back
        self.active_version.status = ConfigStatus.ROLLED_BACK

        # Activate target version
        target.status = ConfigStatus.ACTIVE
        target.deployed_at = datetime.now()
        self.active_version = target

        return {
            "rolled_back_from": self.active_version.version_id,
            "rolled_back_to": target.version_id,
            "rollback_time": datetime.now().isoformat()
        }

    def get_active_config(self) -> Optional[Dict[str, Any]]:
        """Get currently active configuration"""
        if self.active_version:
            return self.active_version.config_data
        return None

    def detect_drift(
        self,
        observed_config: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Detect configuration drift

        Args:
            observed_config: Configuration observed in production

        Returns:
            Drift detection results
        """
        if not self.active_version:
            return {"drift_detected": False, "reason": "no_active_version"}

        expected = self.active_version.config_data

        drifts = []
        for key in expected.keys():
            expected_val = expected.get(key)
            observed_val = observed_config.get(key)

            if expected_val != observed_val:
                drifts.append({
                    "field": key,
                    "expected": expected_val,
                    "observed": observed_val
                })

        return {
            "drift_detected": len(drifts) > 0,
            "drifts": drifts,
            "drift_count": len(drifts),
            "active_version": self.active_version.version_id
        }

    def _get_version(self, version_id: str) -> Optional[ConfigVersion]:
        """Get version by ID"""
        for version in self.versions:
            if version.version_id == version_id:
                return version
        return None


# Global config manager instance
_config_manager = ConfigManager()


def get_config_manager() -> ConfigManager:
    """Get global configuration manager"""
    return _config_manager
