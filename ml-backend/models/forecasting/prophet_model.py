"""
Prophet Forecasting Model
Time series forecasting with seasonal decomposition and holiday adjustments
"""
from typing import Dict, List, Optional, Any, Tuple
from datetime import datetime, timedelta
import logging
import pandas as pd
import numpy as np

logger = logging.getLogger(__name__)

# Prophet will be imported lazily to avoid import errors in environments without it
try:
    from prophet import Prophet
    PROPHET_AVAILABLE = True
except ImportError:
    PROPHET_AVAILABLE = False
    logger.warning("Prophet not available. Install with: pip install prophet")


class ProphetCapacityModel:
    """
    Prophet-based capacity forecasting model
    Handles seasonality, trends, and calendar events
    """

    def __init__(self):
        self.model: Optional[Any] = None
        self.fitted = False
        self.last_train_time: Optional[datetime] = None

    def train(
        self,
        historical_data: pd.DataFrame,
        target_column: str = "request_rate",
        holidays: Optional[pd.DataFrame] = None
    ) -> None:
        """
        Train Prophet model on historical data

        Args:
            historical_data: DataFrame with 'timestamp' and target column
            target_column: Name of column to forecast
            holidays: Optional DataFrame with holiday dates
        """
        if not PROPHET_AVAILABLE:
            raise ImportError("Prophet not installed")

        # Prepare data in Prophet format (ds, y columns)
        df = pd.DataFrame({
            'ds': pd.to_datetime(historical_data['timestamp']),
            'y': historical_data[target_column]
        })

        # Initialize Prophet with custom parameters
        self.model = Prophet(
            daily_seasonality=True,
            weekly_seasonality=True,
            yearly_seasonality=True,
            seasonality_mode='multiplicative',  # For traffic patterns
            changepoint_prior_scale=0.05,  # Flexibility for trend changes
            seasonality_prior_scale=10.0,  # Strength of seasonality
            holidays=holidays
        )

        # Add custom seasonalities
        self.model.add_seasonality(
            name='hourly',
            period=1,  # 1 day
            fourier_order=8
        )

        # Fit model
        logger.info(f"Training Prophet model on {len(df)} data points")
        self.model.fit(df)
        self.fitted = True
        self.last_train_time = datetime.now()

        logger.info("Prophet model trained successfully")

    def predict(
        self,
        horizon_hours: int = 1,
        include_history: bool = False
    ) -> Dict[str, Any]:
        """
        Generate forecasts for future time periods

        Args:
            horizon_hours: Number of hours to forecast
            include_history: Include historical fitted values

        Returns:
            Dictionary with forecast results
        """
        if not self.fitted:
            logger.warning("Model not trained, returning mock predictions")
            return self._mock_prediction(horizon_hours)

        # Create future dataframe
        future = self.model.make_future_dataframe(
            periods=horizon_hours,
            freq='H',
            include_history=include_history
        )

        # Generate forecast
        forecast = self.model.predict(future)

        # Extract key predictions
        if not include_history:
            forecast = forecast.tail(horizon_hours)

        return {
            "predictions": forecast['yhat'].tolist(),
            "lower_bound": forecast['yhat_lower'].tolist(),
            "upper_bound": forecast['yhat_upper'].tolist(),
            "trend": forecast['trend'].tolist(),
            "seasonal": forecast.get('seasonal', [0] * len(forecast)),
            "timestamps": forecast['ds'].dt.strftime('%Y-%m-%d %H:%M:%S').tolist(),
            "horizon_hours": horizon_hours
        }

    def predict_capacity(
        self,
        current_metrics: Dict[str, float],
        horizon_hours: int = 1
    ) -> Dict[str, Any]:
        """
        Predict capacity requirements

        Args:
            current_metrics: Current system metrics
            horizon_hours: Forecast horizon in hours

        Returns:
            Capacity predictions
        """
        forecast = self.predict(horizon_hours=horizon_hours)

        if not forecast.get("predictions"):
            return self._mock_capacity_prediction(current_metrics)

        # Calculate worker requirements based on forecast
        predicted_rate = forecast["predictions"][0]

        # Worker calculation formula
        # workers = (request_rate / throughput_per_worker) * safety_margin
        throughput_per_worker = 100  # requests/sec per worker
        safety_margin = 1.2

        next_hour_workers = max(1, int(predicted_rate / throughput_per_worker * safety_margin))

        # Queue capacity sizing
        queue_capacity = max(100, int(predicted_rate * 1.5))

        # Calculate seasonality factor
        seasonality_factor = forecast.get("seasonal", [1.0])[0] if forecast.get("seasonal") else 1.0

        return {
            "next_hour_workers": next_hour_workers,
            "predicted_request_rate": round(predicted_rate, 2),
            "queue_capacity": queue_capacity,
            "seasonality_factor": round(seasonality_factor, 3),
            "confidence_lower": round(forecast["lower_bound"][0], 2),
            "confidence_upper": round(forecast["upper_bound"][0], 2),
            "trend": round(forecast["trend"][0], 2),
            "guardrail": "schedule_apply_cap_deltas_approval"
        }

    def _mock_prediction(self, horizon_hours: int) -> Dict[str, Any]:
        """Generate mock predictions when model isn't trained"""
        now = datetime.now()
        timestamps = [
            (now + timedelta(hours=i)).strftime('%Y-%m-%d %H:%M:%S')
            for i in range(horizon_hours)
        ]

        base = 1000
        predictions = [
            base + 200 * np.sin(i * 2 * np.pi / 24) + np.random.normal(0, 50)
            for i in range(horizon_hours)
        ]

        return {
            "predictions": predictions,
            "lower_bound": [p * 0.9 for p in predictions],
            "upper_bound": [p * 1.1 for p in predictions],
            "trend": [base] * horizon_hours,
            "seasonal": [0] * horizon_hours,
            "timestamps": timestamps,
            "horizon_hours": horizon_hours
        }

    def _mock_capacity_prediction(self, current_metrics: Dict[str, float]) -> Dict[str, Any]:
        """Generate mock capacity predictions"""
        ingest_rate = current_metrics.get("ingest_rate", 1200)
        cpu = current_metrics.get("cpu", 0.65)
        p99 = current_metrics.get("p99", 350)

        seasonality_factor = 1 + np.sin((datetime.now().hour / 24) * 2 * np.pi) * 0.15

        next_hour_workers = max(1, int((ingest_rate / 1000) * (1 + cpu) * seasonality_factor))
        queue_capacity = max(100, int(ingest_rate * 1.5))

        return {
            "next_hour_workers": next_hour_workers,
            "predicted_request_rate": ingest_rate * seasonality_factor,
            "queue_capacity": queue_capacity,
            "seasonality_factor": round(seasonality_factor, 3),
            "confidence_lower": ingest_rate * 0.85,
            "confidence_upper": ingest_rate * 1.15,
            "trend": ingest_rate,
            "guardrail": "schedule_apply_cap_deltas_approval"
        }
