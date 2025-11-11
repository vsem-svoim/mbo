import { useEffect, useRef, useState } from "react";
import {
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Area,
  AreaChart,
} from "recharts";
import { Panel, Section, Button, Metric } from "@/components";
import { StrategySignal, StrategyTrade } from "@/types";
import { fmtMoney, fmtPcnt, movingAverage, stdDev } from "@/utils";
import { useSyntheticFeed } from "@/hooks/useSyntheticFeed";

/**
 * HFT (High-Frequency Trading) Page
 *
 * Features:
 * - Strategy backtesting with entry/exit signals
 * - P&L tracking and performance metrics
 * - Multiple strategy algorithms
 * - Real-time signal generation
 * - Risk management and position sizing
 * - Performance analytics and metrics
 */

interface StrategyConfig {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
}

const STRATEGIES: StrategyConfig[] = [
  {
    id: "momentum",
    name: "Momentum Strategy",
    description: "Trades based on price momentum and volume confirmation",
    enabled: true,
  },
  {
    id: "meanReversion",
    name: "Mean Reversion",
    description: "Buys oversold, sells overbought based on Bollinger Bands",
    enabled: false,
  },
  {
    id: "orderFlow",
    name: "Order Flow Imbalance",
    description: "Trades based on buy/sell pressure imbalance",
    enabled: false,
  },
];

export function HFTPage() {
  // State
  const [balance, setBalance] = useState(10000);
  const [position, setPosition] = useState<"long" | "short" | null>(null);
  const [entryPrice, setEntryPrice] = useState(0);
  const [trades, setTrades] = useState<StrategyTrade[]>([]);
  const [signals, setSignals] = useState<StrategySignal[]>([]);
  const [priceHistory, setPriceHistory] = useState<number[]>([]);
  const [deltaHistory, setDeltaHistory] = useState<number[]>([]);
  const [strategies, setStrategies] = useState(STRATEGIES);
  const [isRunning, setIsRunning] = useState(false);
  const [speed, setSpeed] = useState(5);

  // Feed
  const { update, bestBid, bestAsk } = useSyntheticFeed(43250, 12);
  const intervalRef = useRef<number | null>(null);

  // Run strategy
  useEffect(() => {
    if (isRunning && update) {
      const ms = 300 / speed;
      intervalRef.current && clearInterval(intervalRef.current);
      intervalRef.current = window.setInterval(() => {
        tick();
      }, ms);
    } else if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isRunning, speed]);

  function tick() {
    const mid = (bestBid + bestAsk) / 2;

    // Update price history
    setPriceHistory((h) => {
      const next = h.length > 500 ? [...h.slice(-499), mid] : [...h, mid];
      return next;
    });

    // Update delta (simulated)
    const delta = update?.side === "bid" ? update.size : -(update?.size || 0);
    setDeltaHistory((d) => {
      const cumDelta = (d[d.length - 1] || 0) + delta;
      const next = d.length > 500 ? [...d.slice(-499), cumDelta] : [...d, cumDelta];
      return next;
    });

    // Generate signals
    const signal = generateSignal();
    if (signal) {
      setSignals((s) => [signal, ...s].slice(0, 20));
      executeSignal(signal);
    }
  }

  function generateSignal(): StrategySignal | null {
    if (priceHistory.length < 50) return null;

    const activeStrategy = strategies.find((s) => s.enabled);
    if (!activeStrategy) return null;

    const prices = priceHistory.slice(-50);
    const current = prices[prices.length - 1];
    const prev = prices[prices.length - 10];

    switch (activeStrategy.id) {
      case "momentum": {
        const ma = movingAverage(prices, 20);
        const currentMA = ma[ma.length - 1];
        const momentum = current - prev;

        if (momentum > 2 && current > currentMA && !position) {
          return {
            ts: Date.now(),
            kind: "enter-long",
            reason: `Momentum: +${momentum.toFixed(2)}, Above MA`,
          };
        }
        if (momentum < -2 && current < currentMA && !position) {
          return {
            ts: Date.now(),
            kind: "enter-short",
            reason: `Momentum: ${momentum.toFixed(2)}, Below MA`,
          };
        }
        if (position && Math.abs(momentum) < 0.5) {
          return { ts: Date.now(), kind: "exit", reason: "Momentum fading" };
        }
        break;
      }

      case "meanReversion": {
        const ma = movingAverage(prices, 20);
        const sd = stdDev(prices);
        const currentMA = ma[ma.length - 1];
        const upperBand = currentMA + 2 * sd;
        const lowerBand = currentMA - 2 * sd;

        if (current < lowerBand && !position) {
          return { ts: Date.now(), kind: "enter-long", reason: "Oversold (< -2σ)" };
        }
        if (current > upperBand && !position) {
          return { ts: Date.now(), kind: "enter-short", reason: "Overbought (> +2σ)" };
        }
        if (position && Math.abs(current - currentMA) < sd * 0.5) {
          return { ts: Date.now(), kind: "exit", reason: "Reverted to mean" };
        }
        break;
      }

      case "orderFlow": {
        if (deltaHistory.length < 30) return null;
        const deltas = deltaHistory.slice(-30);
        const deltaChange = deltas[deltas.length - 1] - deltas[0];

        if (deltaChange > 100 && !position) {
          return { ts: Date.now(), kind: "enter-long", reason: "Strong buy pressure" };
        }
        if (deltaChange < -100 && !position) {
          return { ts: Date.now(), kind: "enter-short", reason: "Strong sell pressure" };
        }
        if (position && Math.abs(deltaChange) < 20) {
          return { ts: Date.now(), kind: "exit", reason: "Flow normalizing" };
        }
        break;
      }
    }

    return null;
  }

  function executeSignal(signal: StrategySignal) {
    if (signal.kind === "enter-long" && !position) {
      setPosition("long");
      setEntryPrice(bestAsk);
    } else if (signal.kind === "enter-short" && !position) {
      setPosition("short");
      setEntryPrice(bestBid);
    } else if (signal.kind === "exit" && position) {
      const exitPrice = position === "long" ? bestBid : bestAsk;
      const pnl = position === "long" ? exitPrice - entryPrice : entryPrice - exitPrice;

      setBalance((b) => b + pnl);
      setTrades((t) => [
        {
          type: position,
          entry: entryPrice,
          exit: exitPrice,
          pnl,
          tsOpen: Date.now() - 5000,
          tsClose: Date.now(),
        },
        ...t,
      ]);
      setPosition(null);
      setEntryPrice(0);
    }
  }

  function toggleStrategy(id: string) {
    setStrategies((s) =>
      s.map((st) => ({
        ...st,
        enabled: st.id === id ? !st.enabled : false,
      }))
    );
  }

  function onReset() {
    setIsRunning(false);
    setBalance(10000);
    setPosition(null);
    setEntryPrice(0);
    setTrades([]);
    setSignals([]);
    setPriceHistory([]);
    setDeltaHistory([]);
  }

  // Metrics
  const wins = trades.filter((t) => (t.pnl || 0) > 0).length;
  const losses = trades.filter((t) => (t.pnl || 0) < 0).length;
  const winRate = trades.length ? (wins / trades.length) * 100 : 0;
  const totalPnL = trades.reduce((sum, t) => sum + (t.pnl || 0), 0);
  const avgWin = wins > 0 ? trades.filter((t) => (t.pnl || 0) > 0).reduce((sum, t) => sum + (t.pnl || 0), 0) / wins : 0;
  const avgLoss = losses > 0 ? trades.filter((t) => (t.pnl || 0) < 0).reduce((sum, t) => sum + (t.pnl || 0), 0) / losses : 0;
  const profitFactor = avgLoss !== 0 ? Math.abs(avgWin / avgLoss) : 0;
  const unrealizedPnL = position
    ? position === "long"
      ? bestBid - entryPrice
      : entryPrice - bestAsk
    : 0;

  // Chart data
  const balanceHistory = trades.map((_t, i) => ({
    idx: i,
    balance: trades.slice(i).reduce((sum, tr) => sum + (tr.pnl || 0), 10000),
  }));

  const priceData = priceHistory.slice(-100).map((p, i) => ({ i, price: p }));

  return (
    <div className="min-h-screen bg-dark-bg text-zinc-200 flex flex-col">
      {/* Top Bar */}
      <div className="flex items-center justify-between px-5 py-3 bg-dark-panel border-b border-dark-border">
        <div className="flex items-center gap-6">
          <div className="text-white font-extrabold text-lg">HFT - High-Frequency Trading</div>
          <div className="text-xs text-slate-400">
            Active Strategy:{" "}
            <span className="text-slate-300 font-semibold">
              {strategies.find((s) => s.enabled)?.name || "None"}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2 text-sm text-slate-400">
          <span
            className={`w-1.5 h-1.5 rounded-full ${
              isRunning ? "bg-slate-400" : "bg-slate-600"
            }`}
          />
          <span>{isRunning ? "Running" : "Stopped"}</span>
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 xl:grid-cols-[320px_1fr_360px] gap-6 bg-dark-bg flex-1 min-h-0 p-6">
        {/* Left Panel */}
        <Panel>
          <Section title="Control Panel">
            <div className="flex flex-col gap-3">
              <div className="flex gap-2">
                <Button
                  variant={isRunning ? "danger" : "primary"}
                  onClick={() => setIsRunning(!isRunning)}
                  className="flex-1"
                >
                  {isRunning ? "Stop" : "Start"}
                </Button>
                <Button variant="blue" onClick={onReset} className="flex-1">
                  Reset
                </Button>
              </div>
              <div className="flex items-center gap-3 bg-dark-bg rounded-md p-2">
                <div className="text-[11px] text-slate-400 w-12">Speed</div>
                <input
                  type="range"
                  min={1}
                  max={10}
                  value={speed}
                  onChange={(e) => setSpeed(Number(e.target.value))}
                  className="w-full"
                />
                <div className="text-[11px] text-slate-400 w-8 text-right">{speed}x</div>
              </div>
            </div>
          </Section>

          <Section title="Strategy Selection">
            <div className="flex flex-col gap-2">
              {strategies.map((s) => (
                <div
                  key={s.id}
                  onClick={() => toggleStrategy(s.id)}
                  className={`p-3 rounded cursor-pointer transition-colors border ${
                    s.enabled
                      ? "border-slate-500 bg-slate-500/10"
                      : "border-dark-border bg-dark-bg hover:bg-dark-hover"
                  }`}
                >
                  <div className="font-semibold text-sm">{s.name}</div>
                  <div className="text-[11px] text-slate-400 mt-1">{s.description}</div>
                </div>
              ))}
            </div>
          </Section>

          <Section title="Performance Metrics">
            <div className="grid grid-cols-2 gap-2">
              <Metric label="Balance" value={fmtMoney(balance)} />
              <Metric
                label="Total P&L"
                value={fmtMoney(totalPnL)}
                valueClass={totalPnL >= 0 ? "text-trade-buyText" : "text-trade-sellText"}
              />
              <Metric
                label="Unrealized"
                value={fmtMoney(unrealizedPnL)}
                valueClass={unrealizedPnL >= 0 ? "text-trade-buyText" : "text-trade-sellText"}
              />
              <Metric
                label="Position"
                value={position ? position.toUpperCase() : "None"}
                valueClass={position === "long" ? "text-trade-buyText" : position === "short" ? "text-trade-sellText" : ""}
              />
              <Metric label="Trades" value={String(trades.length)} />
              <Metric label="Win Rate" value={fmtPcnt(winRate)} />
              <Metric
                label="Wins"
                value={String(wins)}
                valueClass="text-trade-buyText"
              />
              <Metric
                label="Losses"
                value={String(losses)}
                valueClass="text-trade-sellText"
              />
              <Metric label="Avg Win" value={fmtMoney(avgWin)} valueClass="text-trade-buyText" />
              <Metric label="Avg Loss" value={fmtMoney(avgLoss)} valueClass="text-trade-sellText" />
              <Metric
                label="Profit Factor"
                value={profitFactor.toFixed(2)}
                valueClass={profitFactor > 1 ? "text-trade-buyText" : "text-trade-sellText"}
              />
              <Metric
                label="Return"
                value={fmtPcnt((totalPnL / 10000) * 100)}
                valueClass={totalPnL >= 0 ? "text-trade-buyText" : "text-trade-sellText"}
              />
            </div>
          </Section>
        </Panel>

        {/* Center Panel */}
        <Panel>
          <Section title="Price Chart">
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={priceData} margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
                  <XAxis dataKey="i" hide />
                  <YAxis domain={["auto", "auto"]} tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v) => [Number(v).toFixed(2), "Price"]} />
                  <Line
                    type="monotone"
                    dataKey="price"
                    stroke="#4ade80"
                    strokeWidth={2}
                    dot={false}
                    isAnimationActive={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Section>

          <Section title="Balance History">
            <div className="h-64">
              {balanceHistory.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={balanceHistory} margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
                    <XAxis dataKey="idx" hide />
                    <YAxis domain={["auto", "auto"]} tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(v) => [fmtMoney(Number(v)), "Balance"]} />
                    <Area
                      type="monotone"
                      dataKey="balance"
                      stroke="#94a3b8"
                      fill="#94a3b8"
                      fillOpacity={0.2}
                      isAnimationActive={false}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full text-slate-400">
                  No trade history yet
                </div>
              )}
            </div>
          </Section>

          <Section title="Trade History">
            <div className="max-h-64 overflow-y-auto">
              {trades.length === 0 ? (
                <div className="text-center text-slate-400 py-8">No trades executed yet</div>
              ) : (
                <div className="space-y-1">
                  {trades.map((t, idx) => (
                    <div
                      key={idx}
                      className="grid grid-cols-[80px_80px_80px_1fr] gap-2 px-3 py-2 bg-dark-bg rounded text-xs"
                    >
                      <div>
                        <span
                          className={`font-bold ${
                            t.type === "long" ? "text-trade-buyText" : "text-trade-sellText"
                          }`}
                        >
                          {t.type.toUpperCase()}
                        </span>
                      </div>
                      <div className="text-slate-300">
                        Entry: <span className="font-semibold">{t.entry.toFixed(2)}</span>
                      </div>
                      <div className="text-slate-300">
                        Exit: <span className="font-semibold">{t.exit?.toFixed(2) || "-"}</span>
                      </div>
                      <div className="text-right">
                        P&L:{" "}
                        <span
                          className={`font-bold ${
                            (t.pnl || 0) >= 0 ? "text-trade-buyText" : "text-trade-sellText"
                          }`}
                        >
                          {fmtMoney(t.pnl || 0)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </Section>
        </Panel>

        {/* Right Panel */}
        <Panel>
          <Section title="Recent Signals">
            <div className="max-h-[600px] overflow-y-auto space-y-2">
              {signals.length === 0 ? (
                <div className="text-center text-slate-400 py-8">No signals generated yet</div>
              ) : (
                signals.map((sig) => (
                  <div
                    key={sig.ts}
                    className={`p-3 rounded border-l-2 ${
                      sig.kind === "enter-long"
                        ? "border-trade-buyText bg-trade-buy/10"
                        : sig.kind === "enter-short"
                        ? "border-trade-sellText bg-trade-sell/10"
                        : "border-slate-500 bg-slate-500/10"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className={`font-semibold text-sm ${
                        sig.kind === "enter-long"
                          ? "text-trade-buyText"
                          : sig.kind === "enter-short"
                          ? "text-trade-sellText"
                          : "text-slate-400"
                      }`}>
                        {sig.kind === "enter-long"
                          ? "LONG ENTRY"
                          : sig.kind === "enter-short"
                          ? "SHORT ENTRY"
                          : "EXIT"}
                      </span>
                      <span className="text-[10px] text-slate-400">
                        {new Date(sig.ts).toLocaleTimeString()}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-300">{sig.reason}</div>
                  </div>
                ))
              )}
            </div>
          </Section>
        </Panel>
      </div>
    </div>
  );
}
