"""
Feature Store
Centralized feature management with real-time compute and batch backfill
"""
from typing import Dict, List, Optional, Any, Callable
from datetime import datetime, timedelta
from dataclasses import dataclass, field
from enum import Enum
import logging
import pandas as pd
import numpy as np

logger = logging.getLogger(__name__)


class FeatureType(Enum):
    """Types of features in the store"""
    REAL_TIME = "real_time"  # Computed from live metrics
    BATCH = "batch"  # Pre-computed from historical data
    DERIVED = "derived"  # Computed from other features


@dataclass
class Feature:
    """Represents a single feature"""
    name: str
    feature_type: FeatureType
    description: str
    compute_fn: Optional[Callable] = None
    dependencies: List[str] = field(default_factory=list)
    ttl_seconds: int = 300  # Cache TTL
    last_updated: Optional[datetime] = None
    cached_value: Optional[Any] = None


@dataclass
class FeatureVector:
    """A collection of features with metadata"""
    features: Dict[str, Any]
    timestamp: datetime
    entity_id: Optional[str] = None


class FeatureStore:
    """
    Centralized feature store for ML models
    Handles feature engineering, caching, and real-time computation
    """

    def __init__(self):
        self.features: Dict[str, Feature] = {}
        self.feature_cache: Dict[str, Any] = {}

    def register_feature(
        self,
        name: str,
        feature_type: FeatureType,
        description: str,
        compute_fn: Optional[Callable] = None,
        dependencies: Optional[List[str]] = None
    ) -> None:
        """
        Register a new feature in the store

        Args:
            name: Unique feature name
            feature_type: Type of feature
            description: Human-readable description
            compute_fn: Function to compute feature value
            dependencies: List of feature names this feature depends on
        """
        self.features[name] = Feature(
            name=name,
            feature_type=feature_type,
            description=description,
            compute_fn=compute_fn,
            dependencies=dependencies or []
        )
        logger.info(f"Registered feature: {name} ({feature_type.value})")

    def get_feature(self, name: str, context: Optional[Dict[str, Any]] = None) -> Any:
        """
        Get feature value, computing if necessary

        Args:
            name: Feature name
            context: Context data for computation

        Returns:
            Feature value
        """
        if name not in self.features:
            raise ValueError(f"Feature '{name}' not registered")

        feature = self.features[name]

        # Check cache
        if self._is_cache_valid(feature):
            logger.debug(f"Cache hit for feature: {name}")
            return feature.cached_value

        # Compute feature value
        if feature.compute_fn:
            # Resolve dependencies first
            dep_values = {}
            for dep_name in feature.dependencies:
                dep_values[dep_name] = self.get_feature(dep_name, context)

            # Compute feature
            value = feature.compute_fn(context, dep_values)

            # Update cache
            feature.cached_value = value
            feature.last_updated = datetime.now()

            logger.debug(f"Computed feature: {name} = {value}")
            return value
        else:
            logger.warning(f"Feature '{name}' has no compute function")
            return None

    def get_feature_vector(
        self,
        feature_names: List[str],
        context: Optional[Dict[str, Any]] = None
    ) -> FeatureVector:
        """
        Get multiple features as a vector

        Args:
            feature_names: List of feature names to fetch
            context: Context data for computation

        Returns:
            FeatureVector with all requested features
        """
        features = {}
        for name in feature_names:
            try:
                features[name] = self.get_feature(name, context)
            except Exception as e:
                logger.error(f"Failed to compute feature '{name}': {e}")
                features[name] = None

        return FeatureVector(
            features=features,
            timestamp=datetime.now()
        )

    def _is_cache_valid(self, feature: Feature) -> bool:
        """Check if cached feature value is still valid"""
        if feature.cached_value is None or feature.last_updated is None:
            return False

        age = (datetime.now() - feature.last_updated).total_seconds()
        return age < feature.ttl_seconds

    def invalidate_cache(self, feature_name: Optional[str] = None) -> None:
        """
        Invalidate feature cache

        Args:
            feature_name: Specific feature to invalidate, or None for all
        """
        if feature_name:
            if feature_name in self.features:
                self.features[feature_name].cached_value = None
                self.features[feature_name].last_updated = None
                logger.info(f"Invalidated cache for: {feature_name}")
        else:
            for feature in self.features.values():
                feature.cached_value = None
                feature.last_updated = None
            logger.info("Invalidated all feature caches")

    def list_features(self) -> List[Dict[str, Any]]:
        """List all registered features"""
        return [
            {
                "name": f.name,
                "type": f.feature_type.value,
                "description": f.description,
                "dependencies": f.dependencies,
                "cached": f.cached_value is not None
            }
            for f in self.features.values()
        ]


# Global feature store instance
_feature_store = FeatureStore()


def get_feature_store() -> FeatureStore:
    """Get the global feature store instance"""
    return _feature_store
