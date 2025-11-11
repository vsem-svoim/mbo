import { useNavigate } from "react-router-dom";
import { Button } from "@/components";

/**
 * Home/Landing Page
 * Navigation hub for all features
 */

export function HomePage() {
  const navigate = useNavigate();

  const features = [
    {
      id: "mbo",
      title: "Market By Order",
      description: "Real-time order book analysis with imbalance tracking, volume profiling, and liquidity detection",
      route: "/mbo",
      features: [
        "Order book visualization",
        "Cumulative delta analysis",
        "Volume profile",
        "Liquidity absorption detection",
        "Order flow divergence",
        "Time & Sales tape",
      ],
    },
    {
      id: "hft",
      title: "High-Frequency Trading",
      description: "Advanced backtesting framework with multiple strategy algorithms and performance analytics",
      route: "/hft",
      features: [
        "Multiple trading strategies",
        "Real-time signal generation",
        "P&L tracking",
        "Performance metrics",
        "Win rate analysis",
        "Risk management",
      ],
    },
    {
      id: "ml",
      title: "ML Models",
      description: "Pre-configured UIs for 6 production ML models including capacity planning, SLO control, and optimization",
      route: "/ml-models",
      features: [
        "Capacity Planning (Prophet + TFT)",
        "Tail SLO Control (XGBoost)",
        "Extreme Events (EVT)",
        "Regime Detection (BOCPD)",
        "Online Tuning (Bandits)",
        "Offline Optimization (Bayes)",
      ],
    },
  ];

  return (
    <div className="min-h-screen bg-dark-bg text-zinc-200">
      {/* Hero Section */}
      <div className="bg-dark-panel border-b border-dark-border">
        <div className="max-w-7xl mx-auto px-6 py-12">
          <div className="text-center">
            <h1 className="text-4xl font-bold mb-3 text-slate-200">
              Trading Platform
            </h1>
            <p className="text-base text-slate-400 mb-6 max-w-2xl mx-auto">
              Professional trading platform with Market By Order analysis, High-Frequency Trading strategies, and ML model integration
            </p>
            <div className="flex items-center justify-center gap-6 text-xs text-slate-500">
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-slate-500" />
                <span>Real-time Data</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-slate-500" />
                <span>Advanced Analytics</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-slate-500" />
                <span>ML Integration</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Features Grid */}
      <div className="max-w-7xl mx-auto px-6 py-12">
        <h2 className="text-xl font-semibold mb-12 text-slate-300">Trading Modules</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {features.map((feature) => (
            <div
              key={feature.id}
              className="bg-dark-panel border border-dark-border hover:border-slate-600 transition-colors"
            >
              {/* Content */}
              <div className="p-8">
                <h3 className="text-base font-semibold mb-4 text-slate-200">{feature.title}</h3>
                <p className="text-xs text-slate-500 mb-6 leading-relaxed">{feature.description}</p>

                {/* Features List */}
                <div className="space-y-2 mb-8">
                  {feature.features.map((f, idx) => (
                    <div key={idx} className="flex items-start gap-3 text-xs text-slate-400">
                      <span className="text-slate-600 mt-0.5">•</span>
                      <span>{f}</span>
                    </div>
                  ))}
                </div>

                {/* CTA Button */}
                <Button
                  variant="dark"
                  onClick={() => navigate(feature.route)}
                  className="w-full text-xs"
                >
                  Open Module
                </Button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Footer */}
      <div className="border-t border-dark-border py-4 mt-auto">
        <div className="max-w-7xl mx-auto px-6 text-center text-xs text-slate-600">
          Trading Platform © {new Date().getFullYear()}
        </div>
      </div>
    </div>
  );
}
