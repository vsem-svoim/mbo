import React from "react";
import { useNavigate } from "react-router-dom";
import { TrendingUp, Zap, Brain, ArrowRight } from "lucide-react";
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
      title: "MBO - Market By Order",
      description: "Real-time order book analysis with imbalance tracking, volume profiling, and liquidity detection",
      icon: <TrendingUp className="w-12 h-12" />,
      color: "from-emerald-500 to-emerald-600",
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
      title: "HFT - High-Frequency Trading",
      description: "Advanced backtesting framework with multiple strategy algorithms and performance analytics",
      icon: <Zap className="w-12 h-12" />,
      color: "from-yellow-500 to-amber-600",
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
      title: "ML Models Integration",
      description: "Pre-configured UIs for 6 production ML models including capacity planning, SLO control, and optimization",
      icon: <Brain className="w-12 h-12" />,
      color: "from-purple-500 to-purple-600",
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
      <div className="relative overflow-hidden bg-gradient-to-br from-dark-panel via-dark-bg to-dark-panel border-b border-dark-border">
        <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 via-transparent to-purple-500/5" />
        <div className="relative max-w-7xl mx-auto px-6 py-20">
          <div className="text-center">
            <h1 className="text-5xl font-extrabold mb-4 bg-gradient-to-r from-emerald-400 via-blue-400 to-purple-400 bg-clip-text text-transparent">
              Order Flow Pro
            </h1>
            <p className="text-xl text-slate-300 mb-8 max-w-2xl mx-auto">
              Professional trading platform with Market By Order analysis, High-Frequency Trading strategies, and ML model integration
            </p>
            <div className="flex items-center justify-center gap-4 text-sm text-slate-400">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span>Real-time Data</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                <span>Advanced Analytics</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-purple-500 animate-pulse" />
                <span>ML Integration</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Features Grid */}
      <div className="max-w-7xl mx-auto px-6 py-16">
        <h2 className="text-3xl font-bold mb-12 text-center">Choose Your Trading Module</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feature) => (
            <div
              key={feature.id}
              className="group relative bg-dark-panel border border-dark-border rounded-lg overflow-hidden hover:border-emerald-500/50 transition-all duration-300 hover:shadow-lg hover:shadow-emerald-500/10"
            >
              {/* Gradient Header */}
              <div className={`h-32 bg-gradient-to-br ${feature.color} p-6 flex items-center justify-center`}>
                <div className="text-white">{feature.icon}</div>
              </div>

              {/* Content */}
              <div className="p-6">
                <h3 className="text-xl font-bold mb-2">{feature.title}</h3>
                <p className="text-sm text-slate-400 mb-4">{feature.description}</p>

                {/* Features List */}
                <div className="space-y-1 mb-6">
                  {feature.features.map((f, idx) => (
                    <div key={idx} className="flex items-center gap-2 text-xs text-slate-300">
                      <ArrowRight className="w-3 h-3 text-emerald-400" />
                      <span>{f}</span>
                    </div>
                  ))}
                </div>

                {/* CTA Button */}
                <Button
                  variant="primary"
                  onClick={() => navigate(feature.route)}
                  className="w-full group-hover:scale-105 transition-transform"
                >
                  Launch Module
                </Button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Tech Stack */}
      <div className="bg-dark-panel border-t border-dark-border py-12">
        <div className="max-w-7xl mx-auto px-6">
          <h3 className="text-center text-lg font-semibold mb-6 text-slate-400">
            Built With Modern Technologies
          </h3>
          <div className="flex flex-wrap justify-center gap-6 text-sm">
            {["React 18", "Vite 5", "TypeScript", "Tailwind CSS", "Recharts", "Zustand", "React Router"].map((tech) => (
              <div
                key={tech}
                className="px-4 py-2 rounded bg-dark-bg border border-dark-border text-slate-300"
              >
                {tech}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="border-t border-dark-border py-6">
        <div className="max-w-7xl mx-auto px-6 text-center text-xs text-slate-500">
          Order Flow Pro — Professional Trading Platform © {new Date().getFullYear()}
        </div>
      </div>
    </div>
  );
}
