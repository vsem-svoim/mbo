"""
Structured Log Aggregator
Processes structured logs for event correlation and feature extraction
"""
from typing import Dict, List, Optional, Any
from datetime import datetime, timedelta
from dataclasses import dataclass
from collections import defaultdict
import logging
import json

logger = logging.getLogger(__name__)


@dataclass
class LogEvent:
    """Represents a structured log event"""
    timestamp: datetime
    level: str
    message: str
    service: str
    trace_id: Optional[str] = None
    fields: Dict[str, Any] = None


class LogAggregator:
    """Aggregates and analyzes structured logs"""

    def __init__(self, log_source: str = "file"):
        self.log_source = log_source
        self.event_cache: List[LogEvent] = []

    def fetch_logs(
        self,
        start_time: datetime,
        end_time: datetime,
        service: Optional[str] = None,
        level: Optional[str] = None
    ) -> List[LogEvent]:
        """
        Fetch logs from the log source

        Args:
            start_time: Start of time range
            end_time: End of time range
            service: Filter by service name
            level: Filter by log level (ERROR, WARN, INFO, etc.)

        Returns:
            List of LogEvent objects
        """
        logger.info(f"Fetching logs from {start_time} to {end_time}")
        return self._mock_log_events(start_time, end_time)

    def get_error_rate(
        self,
        window: timedelta = timedelta(minutes=5),
        service: Optional[str] = None
    ) -> float:
        """
        Calculate error rate from logs

        Args:
            window: Time window for calculation
            service: Filter by service

        Returns:
            Error rate (0.0 to 1.0)
        """
        end_time = datetime.now()
        start_time = end_time - window

        logs = self.fetch_logs(start_time, end_time, service=service)

        if not logs:
            return 0.0

        error_count = sum(1 for log in logs if log.level in ["ERROR", "CRITICAL"])
        total_count = len(logs)

        return error_count / total_count if total_count > 0 else 0.0

    def detect_anomalous_patterns(
        self,
        window: timedelta = timedelta(minutes=15)
    ) -> Dict[str, Any]:
        """
        Detect anomalous log patterns

        Args:
            window: Time window to analyze

        Returns:
            Dictionary with anomaly indicators
        """
        end_time = datetime.now()
        start_time = end_time - window

        logs = self.fetch_logs(start_time, end_time)

        # Count by level
        level_counts = defaultdict(int)
        for log in logs:
            level_counts[log.level] += 1

        # Count by service
        service_counts = defaultdict(int)
        for log in logs:
            service_counts[log.service] += 1

        # Detect spikes
        error_spike = level_counts.get("ERROR", 0) > 10
        critical_spike = level_counts.get("CRITICAL", 0) > 0

        return {
            "error_spike": error_spike,
            "critical_spike": critical_spike,
            "total_errors": level_counts.get("ERROR", 0),
            "total_warnings": level_counts.get("WARN", 0),
            "affected_services": list(service_counts.keys()),
            "anomaly_score": min(1.0, (level_counts.get("ERROR", 0) / 100)),
        }

    def correlate_events(
        self,
        trace_id: str,
        window: timedelta = timedelta(minutes=5)
    ) -> List[LogEvent]:
        """
        Correlate events by trace ID

        Args:
            trace_id: Distributed trace ID
            window: Time window to search

        Returns:
            List of correlated log events
        """
        end_time = datetime.now()
        start_time = end_time - window

        logs = self.fetch_logs(start_time, end_time)

        return [log for log in logs if log.trace_id == trace_id]

    def extract_features(
        self,
        window: timedelta = timedelta(minutes=5)
    ) -> Dict[str, float]:
        """
        Extract ML features from log data

        Args:
            window: Time window for feature extraction

        Returns:
            Dictionary of log-based features
        """
        end_time = datetime.now()
        start_time = end_time - window

        logs = self.fetch_logs(start_time, end_time)

        if not logs:
            return {}

        level_counts = defaultdict(int)
        for log in logs:
            level_counts[log.level] += 1

        total = len(logs)

        return {
            "log_total_count": float(total),
            "log_error_rate": level_counts["ERROR"] / total if total > 0 else 0.0,
            "log_warn_rate": level_counts["WARN"] / total if total > 0 else 0.0,
            "log_info_rate": level_counts["INFO"] / total if total > 0 else 0.0,
            "log_anomaly_score": min(1.0, level_counts["ERROR"] / 50),
        }

    def _mock_log_events(
        self,
        start_time: datetime,
        end_time: datetime
    ) -> List[LogEvent]:
        """Generate mock log events for development"""
        import random

        logs = []
        current_time = start_time

        while current_time < end_time:
            # Generate random log event
            level = random.choices(
                ["INFO", "WARN", "ERROR", "CRITICAL"],
                weights=[0.7, 0.2, 0.08, 0.02]
            )[0]

            service = random.choice([
                "orderbook", "ingestor", "storage-sink", "api-gateway"
            ])

            logs.append(LogEvent(
                timestamp=current_time,
                level=level,
                message=f"Sample log message from {service}",
                service=service,
                trace_id=f"trace-{random.randint(1000, 9999)}",
                fields={"request_id": f"req-{random.randint(1000, 9999)}"}
            ))

            current_time += timedelta(seconds=random.randint(1, 10))

        return logs
