"""
FastAPI Main Application
REST API for ML models serving the React frontend
"""
from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import Dict, List, Optional, Any
import logging
from datetime import datetime

# Import model modules (relative imports)
import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(__file__)))

from models.forecasting.prophet_model import ProphetCapacityModel
from models.forecasting.tft_model import TFTCapacityModel
from models.forecasting.nbeats_model import NBEATSModel
from models.tail_control.xgboost_quantile import XGBoostQuantileModel
from models.tail_control.cqr_model import CQRModel
from models.tail_control.evt_pot import EVTModel
from models.anomaly.bocpd import BOCPDModel
from models.anomaly.isolation_forest import IsolationForestAnomalyDetector
from models.anomaly.rrcf_detector import RRCFDetector
from models.optimization.contextual_bandits import OnlineTuningBandit
from models.optimization.bayesian_opt import OfflineOptimizer
from safety.safety_controller import get_safety_controller, register_default_safety_checks
from config.config_manager import get_config_manager

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize FastAPI app
app = FastAPI(
    title="ML Models API",
    description="Production ML models for trading platform infrastructure",
    version="1.0.0"
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify exact origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# === Pydantic Models ===

class MLInput(BaseModel):
    """Input for ML model inference"""
    ingest_rate: Optional[float] = 1200
    cpu: Optional[float] = 0.65
    p99: Optional[float] = 350
    calendar_events: Optional[int] = 0
    load: Optional[float] = 0.7
    infra: Optional[float] = 0.6
    request_rate: Optional[float] = 1000
    error_rate: Optional[float] = 0.01
    exceedances: Optional[int] = 3
    window_size: Optional[int] = 1000
    current_value: Optional[float] = 0.95
    throughput: Optional[float] = 1000
    window_observations: Optional[int] = 100
    canary_metric: Optional[float] = 0.4
    context_features: Optional[int] = 3
    num_configs: Optional[int] = 5
    exploration_factor: Optional[float] = 0.2
    latency: Optional[float] = 250
    success_rate: Optional[float] = 0.95
    iteration: Optional[int] = 1

class MLOutput(BaseModel):
    """Output from ML model"""
    data: Dict[str, Any]
    safety_check: Optional[Dict[str, Any]] = None
    timestamp: str = Field(default_factory=lambda: datetime.now().isoformat())

# === Model Instances ===
# These would typically be loaded from disk or trained on startup

models = {
    "prophet": ProphetCapacityModel(),
    "tft": TFTCapacityModel(),
    "nbeats": NBEATSModel(),
    "xgboost_quantile": XGBoostQuantileModel(),
    "cqr": CQRModel(),
    "evt": EVTModel(),
    "bocpd": BOCPDModel(),
    "isolation_forest": IsolationForestAnomalyDetector(),
    "rrcf": RRCFDetector(),
    "bandit": OnlineTuningBandit(),
    "bayes_opt": OfflineOptimizer()
}

# Safety controller
safety_controller = get_safety_controller()
register_default_safety_checks()

# Config manager
config_manager = get_config_manager()


# === Startup/Shutdown ===

@app.on_event("startup")
async def startup_event():
    """Initialize models and services on startup"""
    logger.info("Starting ML Models API...")
    logger.info(f"Loaded {len(models)} models")
    logger.info("API ready to serve requests")


@app.on_event("shutdown")
async def shutdown_event():
    """Cleanup on shutdown"""
    logger.info("Shutting down ML Models API...")


# === Health Check ===

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "timestamp": datetime.now().isoformat(),
        "models_loaded": len(models)
    }


# === Model Endpoints ===

@app.post("/models/capacity-planning", response_model=MLOutput)
async def capacity_planning(input_data: MLInput):
    """
    Capacity planning using Prophet + TFT
    Forecasts worker and queue requirements
    """
    try:
        # Use Prophet model
        model = models["prophet"]
        metrics = input_data.dict()

        result = model.predict_capacity(metrics, horizon_hours=1)

        # Safety validation
        safety_result = safety_controller.validate("capacity_planning", result, metrics)

        if not safety_result.is_safe:
            logger.warning(f"Capacity planning output failed safety checks: {safety_result.violations}")
            result = safety_controller.get_fallback_output("capacity_planning", metrics)

        return MLOutput(
            data=result,
            safety_check={
                "is_safe": safety_result.is_safe,
                "violations": safety_result.violations,
                "warnings": safety_result.warnings
            }
        )
    except Exception as e:
        logger.error(f"Error in capacity planning: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/models/tail-slo", response_model=MLOutput)
async def tail_slo_control(input_data: MLInput):
    """
    Tail SLO control using XGBoost Quantile + CQR
    Predicts P95/P99 and autoscaling decisions
    """
    try:
        model = models["xgboost_quantile"]
        metrics = input_data.dict()

        result = model.predict_slo_control(metrics)

        # Safety validation
        safety_result = safety_controller.validate("tail_slo", result, metrics)

        if not safety_result.is_safe:
            logger.warning(f"Tail SLO output failed safety checks: {safety_result.violations}")
            result = safety_controller.get_fallback_output("tail_slo", metrics)

        return MLOutput(
            data=result,
            safety_check={
                "is_safe": safety_result.is_safe,
                "violations": safety_result.violations
            }
        )
    except Exception as e:
        logger.error(f"Error in tail SLO control: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/models/extreme-events", response_model=MLOutput)
async def extreme_events(input_data: MLInput):
    """
    Extreme events detection using EVT (POT/GPD)
    Black swan and tail risk detection
    """
    try:
        model = models["evt"]
        metrics = input_data.dict()

        result = model.predict_extreme_events(metrics)

        # Safety validation
        safety_result = safety_controller.validate("extreme_events", result, metrics)

        return MLOutput(
            data=result,
            safety_check={
                "is_safe": safety_result.is_safe,
                "warnings": safety_result.warnings
            }
        )
    except Exception as e:
        logger.error(f"Error in extreme events detection: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/models/regime-detection", response_model=MLOutput)
async def regime_detection(input_data: MLInput):
    """
    Regime detection using BOCPD
    Detects deploy impacts and market shifts
    """
    try:
        model = models["bocpd"]
        metrics = input_data.dict()

        result = model.detect_regime_change(metrics)

        return MLOutput(data=result)
    except Exception as e:
        logger.error(f"Error in regime detection: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/models/bandit", response_model=MLOutput)
async def online_tuning_bandit(input_data: MLInput):
    """
    Online tuning using Contextual Bandits (UCB/TS)
    Config selection for canary deployments
    """
    try:
        model = models["bandit"]
        metrics = input_data.dict()

        result = model.select_config(metrics)

        # Safety validation
        safety_result = safety_controller.validate("bandit", result, metrics)

        if not safety_result.is_safe:
            logger.warning(f"Bandit output failed safety checks: {safety_result.violations}")
            result = safety_controller.get_fallback_output("bandit", metrics)

        return MLOutput(
            data=result,
            safety_check={
                "is_safe": safety_result.is_safe,
                "violations": safety_result.violations
            }
        )
    except Exception as e:
        logger.error(f"Error in bandit selection: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/models/bayes-opt", response_model=MLOutput)
async def bayesian_optimization(input_data: MLInput):
    """
    Offline optimization using Bayesian Optimization
    Nightly parameter tuning
    """
    try:
        model = models["bayes_opt"]
        metrics = input_data.dict()

        result = model.optimize_parameters(metrics)

        return MLOutput(data=result)
    except Exception as e:
        logger.error(f"Error in Bayesian optimization: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# === Safety Endpoints ===

@app.post("/safety/emergency-mode")
async def toggle_emergency_mode(enable: bool, reason: Optional[str] = "manual_trigger"):
    """Enable/disable emergency mode"""
    if enable:
        safety_controller.enable_emergency_mode(reason)
    else:
        safety_controller.disable_emergency_mode()

    return {
        "emergency_mode": enable,
        "reason": reason,
        "timestamp": datetime.now().isoformat()
    }


@app.get("/safety/status")
async def safety_status():
    """Get safety controller status"""
    return {
        "emergency_mode": safety_controller.emergency_mode,
        "human_override": safety_controller.human_override_active,
        "violation_count": len(safety_controller.violation_history),
        "recent_violations": safety_controller.violation_history[-5:] if safety_controller.violation_history else []
    }


# === Configuration Endpoints ===

@app.get("/config/active")
async def get_active_config():
    """Get currently active configuration"""
    config = config_manager.get_active_config()
    if not config:
        raise HTTPException(status_code=404, detail="No active configuration")
    return config


@app.post("/config/deploy")
async def deploy_config(version_id: str, strategy: str = "blue_green"):
    """Deploy a configuration version"""
    try:
        result = config_manager.deploy_version(version_id, strategy)
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


# === Model Management ===

@app.get("/models/list")
async def list_models():
    """List all available models"""
    return {
        "models": [
            {
                "id": "capacityPlanning",
                "name": "Capacity Planning",
                "type": "forecasting",
                "methods": ["Prophet", "TFT", "N-BEATS"]
            },
            {
                "id": "tailSLO",
                "name": "Tail SLO Control",
                "type": "performance",
                "methods": ["XGBoost Quantile", "CQR"]
            },
            {
                "id": "extremeEvents",
                "name": "Extreme Events Detection",
                "type": "risk",
                "methods": ["EVT-POT", "GPD"]
            },
            {
                "id": "regimeDetection",
                "name": "Regime Detection",
                "type": "detection",
                "methods": ["BOCPD"]
            },
            {
                "id": "bandit",
                "name": "Online Tuning (Bandits)",
                "type": "tuning",
                "methods": ["UCB", "Thompson Sampling"]
            },
            {
                "id": "bayesOpt",
                "name": "Offline Optimization",
                "type": "optimization",
                "methods": ["Bayesian Optimization", "BoTorch"]
            }
        ]
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
