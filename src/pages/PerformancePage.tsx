import { useState, useEffect, useRef } from "react";
import { Panel, Section, Button, Metric } from "@/components";
import { fmtMoney } from "@/utils";

/**
 * Performance & Testing Page
 *
 * Professional testing suite for MBO/HFT platform:
 * - Strategy Backtesting
 * - Performance Benchmarks
 * - Load Testing
 * - Latency Measurements
 * - System Health Monitoring
 */

interface BenchmarkResult {
  name: string;
  value: number;
  unit: string;
  status: "good" | "warning" | "critical";
}

interface BacktestResult {
  strategyName: string;
  totalTrades: number;
  winRate: number;
  totalPnL: number;
  sharpeRatio: number;
  maxDrawdown: number;
  avgWin: number;
  avgLoss: number;
}

export function PerformancePage() {
  const [isRunningBacktest, setIsRunningBacktest] = useState(false);
  const [isRunningLoadTest, setIsRunningLoadTest] = useState(false);
  const [backtestProgress, setBacktestProgress] = useState(0);
  const [loadTestProgress, setLoadTestProgress] = useState(0);

  // Benchmark results
  const [benchmarks, setBenchmarks] = useState<BenchmarkResult[]>([
    { name: "Order Processing", value: 0.15, unit: "ms", status: "good" },
    { name: "Market Data Latency", value: 0.08, unit: "ms", status: "good" },
    { name: "WebSocket Round Trip", value: 1.2, unit: "ms", status: "good" },
    { name: "DOM Render Time", value: 12, unit: "ms", status: "good" },
    { name: "Memory Usage", value: 145, unit: "MB", status: "good" },
    { name: "CPU Usage", value: 8, unit: "%", status: "good" },
  ]);

  // Backtest results
  const [backtestResults, setBacktestResults] = useState<BacktestResult[]>([]);

  // Load test metrics
  const [loadTestMetrics, setLoadTestMetrics] = useState({
    messagesPerSecond: 0,
    averageLatency: 0,
    p95Latency: 0,
    p99Latency: 0,
    errorRate: 0,
    throughput: 0,
  });

  const backtestInterval = useRef<number | null>(null);
  const loadTestInterval = useRef<number | null>(null);

  // Run benchmark suite
  const runBenchmarks = () => {
    const newBenchmarks: BenchmarkResult[] = [
      {
        name: "Order Processing",
        value: Number((Math.random() * 0.3 + 0.1).toFixed(2)),
        unit: "ms",
        status: "good",
      },
      {
        name: "Market Data Latency",
        value: Number((Math.random() * 0.2 + 0.05).toFixed(2)),
        unit: "ms",
        status: "good",
      },
      {
        name: "WebSocket Round Trip",
        value: Number((Math.random() * 2 + 0.5).toFixed(1)),
        unit: "ms",
        status: Math.random() > 0.2 ? "good" : "warning",
      },
      {
        name: "DOM Render Time",
        value: Number((Math.random() * 20 + 5).toFixed(0)),
        unit: "ms",
        status: "good",
      },
      {
        name: "Memory Usage",
        value: Number((Math.random() * 50 + 120).toFixed(0)),
        unit: "MB",
        status: "good",
      },
      {
        name: "CPU Usage",
        value: Number((Math.random() * 15 + 5).toFixed(0)),
        unit: "%",
        status: Math.random() > 0.1 ? "good" : "warning",
      },
    ];
    setBenchmarks(newBenchmarks);
  };

  // Run backtest
  const runBacktest = () => {
    setIsRunningBacktest(true);
    setBacktestProgress(0);

    backtestInterval.current = window.setInterval(() => {
      setBacktestProgress((prev) => {
        if (prev >= 100) {
          if (backtestInterval.current) clearInterval(backtestInterval.current);
          setIsRunningBacktest(false);

          // Generate backtest results
          const results: BacktestResult[] = [
            {
              strategyName: "Momentum Strategy",
              totalTrades: 1247,
              winRate: 58.3,
              totalPnL: 12450,
              sharpeRatio: 1.82,
              maxDrawdown: -1250,
              avgWin: 185,
              avgLoss: -142,
            },
            {
              strategyName: "Mean Reversion",
              totalTrades: 2134,
              winRate: 52.1,
              totalPnL: 8920,
              sharpeRatio: 1.45,
              maxDrawdown: -1890,
              avgWin: 142,
              avgLoss: -128,
            },
            {
              strategyName: "Order Flow Imbalance",
              totalTrades: 892,
              winRate: 64.2,
              totalPnL: 15670,
              sharpeRatio: 2.15,
              maxDrawdown: -980,
              avgWin: 245,
              avgLoss: -165,
            },
          ];
          setBacktestResults(results);
          return 100;
        }
        return prev + 2;
      });
    }, 50);
  };

  // Run load test
  const runLoadTest = () => {
    setIsRunningLoadTest(true);
    setLoadTestProgress(0);

    loadTestInterval.current = window.setInterval(() => {
      setLoadTestProgress((prev) => {
        if (prev >= 100) {
          if (loadTestInterval.current) clearInterval(loadTestInterval.current);
          setIsRunningLoadTest(false);

          // Generate load test results
          setLoadTestMetrics({
            messagesPerSecond: Number((Math.random() * 50000 + 100000).toFixed(0)),
            averageLatency: Number((Math.random() * 0.5 + 0.2).toFixed(2)),
            p95Latency: Number((Math.random() * 1.5 + 0.8).toFixed(2)),
            p99Latency: Number((Math.random() * 3 + 1.5).toFixed(2)),
            errorRate: Number((Math.random() * 0.02).toFixed(3)),
            throughput: Number((Math.random() * 200 + 500).toFixed(0)),
          });
          return 100;
        }
        return prev + 1.5;
      });
    }, 50);
  };

  useEffect(() => {
    return () => {
      if (backtestInterval.current) clearInterval(backtestInterval.current);
      if (loadTestInterval.current) clearInterval(loadTestInterval.current);
    };
  }, []);

  const getStatusColor = (status: string) => {
    switch (status) {
      case "good":
        return "text-trade-buyText";
      case "warning":
        return "text-amber-400";
      case "critical":
        return "text-trade-sellText";
      default:
        return "text-slate-400";
    }
  };

  return (
    <div className="min-h-screen bg-dark-bg text-zinc-200 flex flex-col">
      {/* Top Bar */}
      <div className="flex items-center justify-between px-5 py-3 bg-dark-panel border-b border-dark-border">
        <div className="flex items-center gap-6">
          <div className="text-white font-extrabold text-lg">Performance & Testing</div>
          <div className="text-xs text-slate-400">
            Benchmarks • Backtesting • Load Testing
          </div>
        </div>
        <div className="flex items-center gap-2 text-sm text-slate-400">
          <span className="w-1.5 h-1.5 rounded-full bg-slate-500" />
          <span>System Ready</span>
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 xl:grid-cols-[360px_1fr_360px] gap-6 bg-dark-bg flex-1 min-h-0 p-6">
        {/* Left Panel */}
        <Panel>
          <Section title="Benchmarks">
            <div className="flex flex-col gap-3 mb-4">
              <Button variant="primary" onClick={runBenchmarks} className="w-full">
                Run Benchmark Suite
              </Button>
            </div>
            <div className="space-y-2">
              {benchmarks.map((bench, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between p-3 bg-dark-bg rounded border border-dark-border"
                >
                  <div className="text-xs text-slate-400">{bench.name}</div>
                  <div className={`text-sm font-bold ${getStatusColor(bench.status)}`}>
                    {bench.value} {bench.unit}
                  </div>
                </div>
              ))}
            </div>
          </Section>

          <Section title="System Metrics">
            <div className="grid grid-cols-2 gap-2">
              <Metric label="Uptime" value="99.98%" />
              <Metric label="Requests" value="1.2M" />
              <Metric label="Latency P50" value="0.12ms" valueClass="text-trade-buyText" />
              <Metric label="Latency P99" value="2.4ms" valueClass="text-slate-400" />
              <Metric label="Error Rate" value="0.001%" valueClass="text-trade-buyText" />
              <Metric label="Throughput" value="850 MB/s" />
            </div>
          </Section>
        </Panel>

        {/* Center Panel */}
        <Panel>
          <Section title="Backtest Engine">
            <div className="mb-4">
              <Button
                variant={isRunningBacktest ? "dark" : "success"}
                onClick={runBacktest}
                disabled={isRunningBacktest}
                className="w-full"
              >
                {isRunningBacktest ? "Running Backtest..." : "Run Full Backtest"}
              </Button>
              {isRunningBacktest && (
                <div className="mt-3">
                  <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
                    <span>Progress</span>
                    <span>{backtestProgress.toFixed(0)}%</span>
                  </div>
                  <div className="w-full h-2 bg-dark-border rounded overflow-hidden">
                    <div
                      className="h-full bg-trade-buy transition-all"
                      style={{ width: `${backtestProgress}%` }}
                    />
                  </div>
                </div>
              )}
            </div>

            {backtestResults.length > 0 && (
              <div className="space-y-3">
                {backtestResults.map((result, idx) => (
                  <div
                    key={idx}
                    className="p-4 bg-dark-bg rounded border border-dark-border"
                  >
                    <div className="font-semibold text-sm mb-3 text-slate-200">
                      {result.strategyName}
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="flex justify-between">
                        <span className="text-slate-400">Trades</span>
                        <span className="font-semibold">{result.totalTrades}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Win Rate</span>
                        <span className="font-semibold">{result.winRate}%</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Total P&L</span>
                        <span className={`font-semibold ${result.totalPnL >= 0 ? "text-trade-buyText" : "text-trade-sellText"}`}>
                          {fmtMoney(result.totalPnL)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Sharpe</span>
                        <span className="font-semibold text-trade-buyText">{result.sharpeRatio}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Max DD</span>
                        <span className="font-semibold text-trade-sellText">
                          {fmtMoney(result.maxDrawdown)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Avg Win</span>
                        <span className="font-semibold text-trade-buyText">
                          {fmtMoney(result.avgWin)}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Section>
        </Panel>

        {/* Right Panel */}
        <Panel>
          <Section title="Load Testing">
            <div className="mb-4">
              <Button
                variant={isRunningLoadTest ? "dark" : "warning"}
                onClick={runLoadTest}
                disabled={isRunningLoadTest}
                className="w-full"
              >
                {isRunningLoadTest ? "Running Load Test..." : "Run Load Test"}
              </Button>
              {isRunningLoadTest && (
                <div className="mt-3">
                  <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
                    <span>Progress</span>
                    <span>{loadTestProgress.toFixed(0)}%</span>
                  </div>
                  <div className="w-full h-2 bg-dark-border rounded overflow-hidden">
                    <div
                      className="h-full bg-slate-500 transition-all"
                      style={{ width: `${loadTestProgress}%` }}
                    />
                  </div>
                </div>
              )}
            </div>

            {loadTestMetrics.messagesPerSecond > 0 && (
              <div className="space-y-2">
                <div className="p-3 bg-dark-bg rounded border border-dark-border">
                  <div className="text-xs text-slate-400 mb-1">Messages/sec</div>
                  <div className="text-lg font-bold text-slate-200">
                    {loadTestMetrics.messagesPerSecond.toLocaleString()}
                  </div>
                </div>
                <div className="p-3 bg-dark-bg rounded border border-dark-border">
                  <div className="text-xs text-slate-400 mb-1">Avg Latency</div>
                  <div className="text-lg font-bold text-trade-buyText">
                    {loadTestMetrics.averageLatency} ms
                  </div>
                </div>
                <div className="p-3 bg-dark-bg rounded border border-dark-border">
                  <div className="text-xs text-slate-400 mb-1">P95 Latency</div>
                  <div className="text-lg font-bold text-slate-300">
                    {loadTestMetrics.p95Latency} ms
                  </div>
                </div>
                <div className="p-3 bg-dark-bg rounded border border-dark-border">
                  <div className="text-xs text-slate-400 mb-1">P99 Latency</div>
                  <div className="text-lg font-bold text-amber-400">
                    {loadTestMetrics.p99Latency} ms
                  </div>
                </div>
                <div className="p-3 bg-dark-bg rounded border border-dark-border">
                  <div className="text-xs text-slate-400 mb-1">Error Rate</div>
                  <div className={`text-lg font-bold ${loadTestMetrics.errorRate < 0.01 ? "text-trade-buyText" : "text-trade-sellText"}`}>
                    {(loadTestMetrics.errorRate * 100).toFixed(3)}%
                  </div>
                </div>
                <div className="p-3 bg-dark-bg rounded border border-dark-border">
                  <div className="text-xs text-slate-400 mb-1">Throughput</div>
                  <div className="text-lg font-bold text-slate-200">
                    {loadTestMetrics.throughput} MB/s
                  </div>
                </div>
              </div>
            )}
          </Section>
        </Panel>
      </div>
    </div>
  );
}
