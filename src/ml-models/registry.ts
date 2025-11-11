import { ModelFn, MLModelConfig, MLInput, MLOutput } from "@/types";

/**
 * ML Model Registry
 * Central registry for all ML models with their implementations
 */

// ============================================================================
// MODEL IMPLEMENTATIONS
// ============================================================================

// 1. Capacity Planning — Prophet + TFT
export const capacityPlanningModel: ModelFn = async (input: MLInput): Promise<MLOutput> => {
  const { ingest_rate = 1200, cpu = 0.55, p99 = 350, calendar_events = 0 } = input;

  // Simulate Prophet + TFT temporal forecasting
  const seasonality_factor = 1 + Math.sin((Date.now() / (1000 * 60 * 60)) * 2 * Math.PI) * 0.15;
  const event_multiplier = 1 + (calendar_events * 0.2);

  const nextHourWorkers = Math.max(
    1,
    Math.round((ingest_rate / 1000) * (1 + cpu) * seasonality_factor * event_multiplier + p99 / 500)
  );

  const nextDayTarget = Math.round(nextHourWorkers * 24 * 0.85);
  const queueCapacity = Math.max(100, Math.round(ingest_rate * 1.5));

  return {
    nextHourWorkers,
    nextDayTarget,
    queueCapacity,
    seasonality_factor: Number(seasonality_factor.toFixed(3)),
    guardrail: "schedule_apply_cap_deltas_approval",
    confidence: 0.87,
  };
};

// 2. Tail SLO Control — XGBoost Quantile + CQR
export const tailSLOModel: ModelFn = async (input: MLInput): Promise<MLOutput> => {
  const { load = 0.7, infra = 0.6, request_rate = 1000, error_rate = 0.01 } = input;

  // Simulate XGBoost Quantile Regression with Conformalized Quantile Regression
  const base_p95 = 200 + 400 * load * infra;
  const base_p99 = base_p95 * 1.5;

  // CQR calibration adjustment
  const cqr_adjustment = 1 + (error_rate * 10);

  const p95_pred = Math.round(base_p95 * cqr_adjustment);
  const p99_pred = Math.round(base_p99 * cqr_adjustment);
  const p99_9_pred = Math.round(p99_pred * 1.3);

  const action = p99_pred > 500 ? "autoscale" : p95_pred > 350 ? "admit_throttle" : "admit";
  const autoscale_workers = action === "autoscale" ? Math.ceil(request_rate / 800) : 0;

  return {
    p95_pred,
    p99_pred,
    p99_9_pred,
    action,
    autoscale_workers,
    historic_comparison: p99_pred > 450 ? "above_historic" : "within_historic",
    confidence_interval_width: Math.round((p99_pred - p95_pred) * 0.8),
  };
};

// 3. Extreme Events — EVT (POT/GPD)
export const extremeEventsModel: ModelFn = async (input: MLInput): Promise<MLOutput> => {
  const { exceedances = 3, window_size = 1000 } = input;

  // Simulate Peaks Over Threshold with Generalized Pareto Distribution
  const base_threshold = 0.98;
  const gpd_shape = 0.1; // tail heaviness
  const gpd_scale = 0.05;

  const threshold = Number((base_threshold - Math.min(0.15, exceedances * 0.015)).toFixed(3));
  const extreme_prob = Number((1 - Math.exp(-exceedances / 10)).toFixed(4));

  // Calculate return period (how often we expect this extreme event)
  const return_period = Math.round(window_size / Math.max(1, exceedances));

  const alert_level = extreme_prob > 0.5 ? "critical" : extreme_prob > 0.3 ? "warning" : "normal";

  return {
    extreme_threshold: threshold,
    extreme_probability: extreme_prob,
    return_period,
    gpd_shape,
    gpd_scale,
    alert_level,
    persistence_required: exceedances >= 5 ? "yes" : "no",
  };
};

// 4. Regime Detection — BOCPD (Bayesian Online Changepoint Detection)
export const regimeDetectionModel: ModelFn = async (input: MLInput): Promise<MLOutput> => {
  const { p99 = 300, error_rate = 0.02, window_observations = 100 } = input;

  // Simulate BOCPD algorithm
  const hazard_rate = 1 / 250; // expected changepoint every 250 observations
  const observation_likelihood = Math.exp(-Math.abs(p99 - 300) / 100);

  const change_prob = Number((Math.min(0.99, (p99 / 1000) + (error_rate * 5))).toFixed(3));
  const run_length = Math.round(window_observations * (1 - change_prob));

  const regime_state = change_prob > 0.7 ? "transitioning" : change_prob > 0.3 ? "unstable" : "stable";
  const freeze_exploration = change_prob > 0.5;

  return {
    change_probability: change_prob,
    regime_state,
    run_length,
    freeze_exploration: freeze_exploration ? "yes" : "no",
    hazard_rate,
    observation_likelihood: Number(observation_likelihood.toFixed(4)),
    action: freeze_exploration ? "freeze_unsafe_exploration" : "continue_monitoring",
  };
};

// 5. Online Tuning — Contextual Bandits (UCB/TS)
export const banditModel: ModelFn = async (input: MLInput): Promise<MLOutput> => {
  const { canary_metric = 0.4, context_features = 3, num_configs = 5, exploration_factor = 0.2 } = input;

  // Simulate Thompson Sampling with UCB fallback
  const ts_samples = Array.from({ length: num_configs }, (_, i) => {
    const base_reward = 0.3 + (i * 0.1);
    const noise = (Math.random() - 0.5) * 0.2;
    return base_reward + noise + (canary_metric * 0.3);
  });

  const bestConfigId = ts_samples.indexOf(Math.max(...ts_samples)) + 1;
  const ucb_bound = Number((Math.max(...ts_samples) + exploration_factor).toFixed(3));

  const exploit_prob = canary_metric > 0.6 ? 0.9 : 0.7;
  const explore_prob = 1 - exploit_prob;

  const canary_percentage = Math.min(5, Math.max(1, Math.round(canary_metric * 10)));

  return {
    best_config_id: bestConfigId,
    expected_reward: Number(ts_samples[bestConfigId - 1].toFixed(3)),
    ucb_bound,
    exploit_probability: exploit_prob,
    explore_probability: Number(explore_prob.toFixed(2)),
    canary_percentage,
    freeze_on_anomaly: canary_metric < 0.3 ? "yes" : "no",
    context_features_used: context_features,
  };
};

// 6. Offline Optimization — Bayesian Optimization
export const bayesOptModel: ModelFn = async (input: MLInput): Promise<MLOutput> => {
  const { throughput = 1200, latency = 250, iteration = 1 } = input;

  // Simulate Bayesian Optimization with Gaussian Process
  const gp_mean = throughput / 500;
  const gp_variance = Math.sqrt(latency / 100);

  // Acquisition function (Expected Improvement)
  const ei_value = Number((gp_mean + gp_variance * 0.5).toFixed(3));

  const threads_default = Math.max(1, Math.round(throughput / 500));
  const queue_size = Math.max(50, Math.round(throughput / 10));
  const batch_size = Math.max(10, Math.round(throughput / 100));

  // Expected improvement from optimization
  const expected_improvement_pct = Number(((ei_value / gp_mean - 1) * 100).toFixed(1));

  const converged = iteration > 20 && expected_improvement_pct < 2;

  return {
    threads_default,
    queue_size,
    batch_size,
    gp_mean: Number(gp_mean.toFixed(2)),
    gp_variance: Number(gp_variance.toFixed(2)),
    expected_improvement: ei_value,
    expected_improvement_pct,
    converged: converged ? "yes" : "no",
    iterations_completed: iteration,
    recommendation: converged ? "deploy_optimized_config" : "continue_search",
  };
};

// ============================================================================
// MODEL CONFIGURATIONS
// ============================================================================

export const modelConfigs: Record<string, MLModelConfig> = {
  capacityPlanning: {
    id: "capacityPlanning",
    name: "Capacity Planning",
    description: "Prophet + TFT for forecasting infrastructure needs with seasonality detection",
    category: "capacity",
    inputs: [
      { key: "ingest_rate", label: "Ingest Rate (msg/sec)", type: "slider", min: 100, max: 5000, step: 100, default: 1400 },
      { key: "cpu", label: "CPU Utilization", type: "slider", min: 0, max: 1, step: 0.05, default: 0.62 },
      { key: "p99", label: "P99 Latency (ms)", type: "slider", min: 50, max: 1000, step: 10, default: 380 },
      { key: "calendar_events", label: "Calendar Events Impact", type: "slider", min: 0, max: 5, step: 1, default: 0 },
    ],
    outputLabels: {
      nextHourWorkers: "Next Hour Workers",
      nextDayTarget: "Next Day Target",
      queueCapacity: "Queue Capacity",
      seasonality_factor: "Seasonality Factor",
      guardrail: "Guardrail",
      confidence: "Confidence",
    },
    guardrails: ["schedule_apply", "cap_deltas", "approval_window"],
    useCases: [
      "Forecast worker/queue requirements",
      "Seasonal traffic planning",
      "Event-driven capacity scaling",
      "Cost optimization",
    ],
  },

  tailSLO: {
    id: "tailSLO",
    name: "Tail SLO Control",
    description: "XGBoost Quantile + CQR for p95/p99 predictions and autoscaling decisions",
    category: "performance",
    inputs: [
      { key: "load", label: "System Load", type: "slider", min: 0, max: 1, step: 0.05, default: 0.72 },
      { key: "infra", label: "Infrastructure Score", type: "slider", min: 0, max: 1, step: 0.05, default: 0.65 },
      { key: "request_rate", label: "Request Rate (req/sec)", type: "slider", min: 100, max: 5000, step: 100, default: 1000 },
      { key: "error_rate", label: "Error Rate", type: "slider", min: 0, max: 0.1, step: 0.001, default: 0.01 },
    ],
    outputLabels: {
      p95_pred: "Predicted P95 (ms)",
      p99_pred: "Predicted P99 (ms)",
      p99_9_pred: "Predicted P99.9 (ms)",
      action: "Action",
      autoscale_workers: "Autoscale Workers",
      historic_comparison: "Historic Comparison",
      confidence_interval_width: "Confidence Interval",
    },
    guardrails: ["start_conservative", "compare_historic_quantiles"],
    useCases: [
      "SLO breach prediction",
      "Autoscaling triggers",
      "Admission control",
      "Performance gating",
    ],
  },

  extremeEvents: {
    id: "extremeEvents",
    name: "Extreme Events Detection",
    description: "EVT (POT/GPD) for black-swan tail risk modeling and alerting",
    category: "risk",
    inputs: [
      { key: "exceedances", label: "Exceedances Count", type: "slider", min: 0, max: 20, step: 1, default: 5 },
      { key: "window_size", label: "Window Size", type: "slider", min: 100, max: 10000, step: 100, default: 1000 },
      { key: "current_value", label: "Current Percentile", type: "slider", min: 0, max: 1, step: 0.01, default: 0.95 },
    ],
    outputLabels: {
      extreme_threshold: "Extreme Threshold",
      extreme_probability: "Extreme Probability",
      return_period: "Return Period",
      gpd_shape: "GPD Shape",
      gpd_scale: "GPD Scale",
      alert_level: "Alert Level",
      persistence_required: "Persistence Required",
    },
    guardrails: ["pick_threshold", "decluster", "persistence_checks"],
    useCases: [
      "Black swan detection",
      "Tail risk alerting",
      "Rare event modeling",
      "Crisis prediction",
    ],
  },

  regimeDetection: {
    id: "regimeDetection",
    name: "Regime Detection",
    description: "BOCPD for detecting deploy/market shifts in streaming metrics",
    category: "detection",
    inputs: [
      { key: "p99", label: "P99 Latency (ms)", type: "slider", min: 50, max: 1000, step: 10, default: 300 },
      { key: "error_rate", label: "Error Rate", type: "slider", min: 0, max: 0.1, step: 0.001, default: 0.02 },
      { key: "throughput", label: "Throughput (ops/sec)", type: "slider", min: 100, max: 5000, step: 100, default: 1000 },
      { key: "window_observations", label: "Window Size (obs)", type: "slider", min: 10, max: 500, step: 10, default: 100 },
    ],
    outputLabels: {
      change_probability: "Change Probability",
      regime_state: "Regime State",
      run_length: "Run Length",
      freeze_exploration: "Freeze Exploration",
      hazard_rate: "Hazard Rate",
      observation_likelihood: "Observation Likelihood",
      action: "Action",
    },
    guardrails: ["require_persistence", "before_action"],
    useCases: [
      "Deploy impact detection",
      "Market shift detection",
      "Freeze unsafe exploration",
      "Anomaly gating",
    ],
  },

  bandit: {
    id: "bandit",
    name: "Online Tuning (Bandits)",
    description: "Contextual Bandits (UCB/TS) for selecting optimal configs on canary traffic",
    category: "tuning",
    inputs: [
      { key: "canary_metric", label: "Canary Metric Score", type: "slider", min: 0, max: 1, step: 0.05, default: 0.46 },
      { key: "context_features", label: "Context Features", type: "slider", min: 1, max: 10, step: 1, default: 3 },
      { key: "num_configs", label: "Number of Configs", type: "slider", min: 2, max: 10, step: 1, default: 5 },
      { key: "exploration_factor", label: "Exploration Factor", type: "slider", min: 0, max: 1, step: 0.05, default: 0.2 },
    ],
    outputLabels: {
      best_config_id: "Best Config ID",
      expected_reward: "Expected Reward",
      ucb_bound: "UCB Bound",
      exploit_probability: "Exploit Probability",
      explore_probability: "Explore Probability",
      canary_percentage: "Canary %",
      freeze_on_anomaly: "Freeze on Anomaly",
      context_features_used: "Context Features Used",
    },
    guardrails: ["canary_1_5_percent", "freeze_on_anomaly"],
    useCases: [
      "A/B test optimization",
      "Config selection",
      "Canary analysis",
      "Online parameter tuning",
    ],
  },

  bayesOpt: {
    id: "bayesOpt",
    name: "Offline Optimization",
    description: "Bayesian Optimization for nightly load-test parameter tuning",
    category: "optimization",
    inputs: [
      { key: "throughput", label: "Throughput (ops/sec)", type: "slider", min: 100, max: 5000, step: 100, default: 1500 },
      { key: "latency", label: "Latency (ms)", type: "slider", min: 50, max: 1000, step: 10, default: 250 },
      { key: "success_rate", label: "Success Rate", type: "slider", min: 0, max: 1, step: 0.01, default: 0.95 },
      { key: "iteration", label: "Iteration", type: "slider", min: 1, max: 50, step: 1, default: 1 },
    ],
    outputLabels: {
      threads_default: "Threads (Default)",
      queue_size: "Queue Size",
      batch_size: "Batch Size",
      gp_mean: "GP Mean",
      gp_variance: "GP Variance",
      expected_improvement: "Expected Improvement",
      expected_improvement_pct: "Expected Improvement %",
      converged: "Converged",
      iterations_completed: "Iterations",
      recommendation: "Recommendation",
    },
    guardrails: ["bound_search_space", "verify_wins"],
    useCases: [
      "Nightly tuning runs",
      "Load test optimization",
      "Default parameter discovery",
      "Performance maximization",
    ],
  },
};

// ============================================================================
// MODEL REGISTRY
// ============================================================================

export const ModelRegistry: Record<string, ModelFn> = {
  capacityPlanning: capacityPlanningModel,
  tailSLO: tailSLOModel,
  extremeEvents: extremeEventsModel,
  regimeDetection: regimeDetectionModel,
  bandit: banditModel,
  bayesOpt: bayesOptModel,
};

// Helper to get all model IDs
export const getModelIds = (): string[] => Object.keys(ModelRegistry);

// Helper to get model config
export const getModelConfig = (modelId: string): MLModelConfig | undefined => {
  return modelConfigs[modelId];
};

// Helper to run a model
export const runModel = async (modelId: string, input: MLInput): Promise<MLOutput> => {
  const model = ModelRegistry[modelId];
  if (!model) {
    throw new Error(`Model ${modelId} not found in registry`);
  }
  return await model(input);
};
