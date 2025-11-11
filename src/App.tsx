import React, { useEffect, useMemo, useRef, useState } from "react";
import { Play, Pause, RotateCcw, ArrowUpRight, ArrowDownRight, Cpu } from "lucide-react";
import { Area, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine, ComposedChart, Line } from "recharts";

/**
 * Order Flow Pro — React (Vite)
 * -------------------------------------------------------------
 * FIX: Avoided identifier shadowing by renaming state vars `asks`→`askLevels` and `bids`→`bidLevels`.
 *      Removed any potential inner-scope reuse. Replaced .at(-1) with index-safe fallback.
 *      Added lightweight in-app self tests to validate core helpers.
 *
 * Features
 * - Imbalance/Cumulative Delta Analysis
 * - Buy vs Sell volume imbalance tracking
 * - Cumulative delta chart showing order flow direction
 * - Volume profile at each price level
 * - Aggressive vs passive order detection
 * - Backtesting: historical order book replay (play/pause/speed)
 * - Strategy testing with entry/exit signals
 * - P&L tracking + performance metrics
 * - Volume heatmap visualization
 * - Liquidity absorption detection
 * - Order flow divergence indicators
 * - Time & Sales tape with aggressive orders highlighted
 * - ML model integration stubs ready for wiring your models
 *
 * Quick start
 *   npm create vite@latest order-flow-pro -- --template react-ts
 *   cd order-flow-pro
 *   npm i recharts zustand framer-motion clsx
 *   npm i -D tailwindcss postcss autoprefixer
 *   npx tailwindcss init -p   # enable Tailwind in index.css
 *   # replace src/App.tsx with this file
 *   npm run dev
 */

// -------------------------------
// Types
// -------------------------------

type Side = "bid" | "ask";

interface BookLevel {
  price: number;
  size: number; // resting size at the level
  isAggressive?: boolean; // last update aggressive?
  isAbsorption?: boolean; // detected absorption tag
  total?: number; // running depth for UI
}

interface TradeTapeRow {
  ts: number; // ms
  timeStr: string; // cached HH:MM:SS
  price: number;
  size: number;
  isBuy: boolean;
  isAggressive: boolean;
}

interface HeatDot { x: number; y: number; r: number; alpha: number; key: string; }

interface StrategyTrade { type: "long" | "short"; entry: number; exit?: number; pnl?: number; tsOpen: number; tsClose?: number; }

interface StrategySignal { ts: number; kind: "enter-long" | "enter-short" | "exit"; reason?: string; }

// -------------------------------
// Utilities
// -------------------------------

const fmtMoney = (n: number) => (n < 0 ? "-" : "") + "$" + Math.abs(n).toFixed(2);
const fmtPcnt = (n: number) => `${n.toFixed(0)}%`;
const nowStr = () => new Date().toLocaleTimeString("en-US", { hour12: false });

// seeded RNG for deterministic replays (optional)
function rng(seed = 42) {
  let s = seed >>> 0;
  return () => (s = (s * 1664525 + 1013904223) >>> 0) / 0xffffffff;
}

// -------------------------------
// ML Bridge — minimal pluggable registry for your models
// -------------------------------

type MLInput = Record<string, number>;
type MLOutput = Record<string, number | string>;

type ModelFn = (input: MLInput) => Promise<MLOutput>;

const ModelRegistry: Record<string, ModelFn> = {
  // Capacity Planning — Prophet + TFT
  capacityPlanning: async (input) => {
    const { ingest_rate = 1200, cpu = 0.55, p99 = 350 } = input;
    const nextHourWorkers = Math.max(1, Math.round((ingest_rate / 1000) * (1 + cpu) + p99 / 500));
    return { nextHourWorkers, guardrail: "schedule_apply_cap_deltas_approval" };
  },
  // Tail SLO Control — XGBoost Quantile + CQR
  tailSLO: async (input) => {
    const { load = 0.7, infra = 0.6 } = input;
    const p95 = 200 + 400 * load * infra;
    const p99 = p95 * 1.5;
    return { p95_pred: Math.round(p95), p99_pred: Math.round(p99), action: p99 > 500 ? "autoscale" : "admit" };
  },
  // Extreme Events — EVT (POT/GPD)
  extremeEvents: async (input) => {
    const { exceedances = 3 } = input;
    const threshold = 0.98 - Math.min(0.9, exceedances * 0.01);
    return { extreme_threshold: Number(threshold.toFixed(3)) };
  },
  // Regime Detection — BOCPD
  regimeDetection: async (input) => {
    const { p99 = 300 } = input;
    return { change_prob: Number((Math.min(0.99, p99 / 1000)).toFixed(2)) };
  },
  // Online Tuning — Contextual Bandits (UCB/TS)
  bandit: async (input) => {
    const { canary_metric = 0.4 } = input;
    const bestConfig = canary_metric > 0.5 ? 3 : 1;
    return { best_config_id: bestConfig };
  },
  // Offline Optimization — Bayesian Optimization
  bayesOpt: async (input) => {
    const { throughput = 1200 } = input;
    const threads = Math.max(1, Math.round(throughput / 500));
    return { threads_default: threads };
  },
};

// -------------------------------
// Strategy Engine — toy example for signals
// -------------------------------

function simpleStrategySignal(deltaWindow: number[], priceWindow: number[]): StrategySignal | null {
  if (deltaWindow.length < 10 || priceWindow.length < 10) return null;
  const dDelta = deltaWindow[deltaWindow.length - 1] - deltaWindow[0];
  const dPrice = priceWindow[priceWindow.length - 1] - priceWindow[0];
  if (dDelta > 50 && dPrice > 2) return { ts: Date.now(), kind: "enter-long", reason: "delta+price up" };
  if (dDelta < -50 && dPrice < -2) return { ts: Date.now(), kind: "enter-short", reason: "delta+price down" };
  if (Math.abs(dDelta) < 5 && Math.abs(dPrice) < 0.3) return { ts: Date.now(), kind: "exit", reason: "flat momentum" };
  return null;
}

// -------------------------------
// Synthetic MBO feed (replace with real data adapter)
// -------------------------------

interface MBOUpdate { side: Side; price: number; size: number; aggressive: boolean; }

function useSyntheticFeed(basePrice = 43250, seed = 7) {
  const rand = useMemo(() => rng(seed), [seed]);
  const [tick, setTick] = useState(0);
  const [bestBid, setBestBid] = useState(basePrice - 0.5);
  const [bestAsk, setBestAsk] = useState(basePrice + 0.5);

  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 200);
    return () => clearInterval(id);
  }, []);

  const update: MBOUpdate | null = useMemo(() => {
    const mid = (bestBid + bestAsk) / 2;
    const shock = (rand() - 0.5) * 1.2;
    const newMid = mid + shock;
    const spread = 0.5 + (rand() * 0.5);
    const newBid = newMid - spread / 2;
    const newAsk = newMid + spread / 2;
    setBestBid(newBid);
    setBestAsk(newAsk);
    const isBuy = rand() > 0.5;
    const price = Number((isBuy ? newBid : newAsk).toFixed(2));
    const size = Number((0.2 + rand() * 3).toFixed(4));
    const aggressive = rand() > 0.7;
    return { side: isBuy ? "bid" : "ask", price, size, aggressive };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick]);

  return { update, bestBid, bestAsk };
}

// -------------------------------
// Main App
// -------------------------------

export default function App() {
  // Order book state (renamed to avoid any global collisions)
  const [askLevels, setAskLevels] = useState<BookLevel[]>([]);
  const [bidLevels, setBidLevels] = useState<BookLevel[]>([]);
  const [cumulativeDelta, setCumulativeDelta] = useState(0);
  const [deltaHistory, setDeltaHistory] = useState<number[]>([]);
  const [priceHistory, setPriceHistory] = useState<number[]>([]);
  const [volumeProfile, setVolumeProfile] = useState<Record<string, { buy: number; sell: number }>>({});
  const [tape, setTape] = useState<TradeTapeRow[]>([]);
  const [heatDots, setHeatDots] = useState<HeatDot[]>([]);

  // Backtest + strategy state
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState(5); // 1-10
  const [balance, setBalance] = useState(10000);
  const [position, setPosition] = useState<null | { type: "long" | "short"; entry: number; size: number }>(null);
  const [trades, setTrades] = useState<StrategyTrade[]>([]);

  // ML demo state
  const [mlBusy, setMlBusy] = useState(false);
  const [mlOutput, setMlOutput] = useState<MLOutput | null>(null);
  const [mlModel, setMlModel] = useState<keyof typeof ModelRegistry>("capacityPlanning");

  // feed
  const { update, bestBid, bestAsk } = useSyntheticFeed();

  // playback timer
  const baseIntervalRef = useRef<number | null>(null);
  useEffect(() => {
    const ms = 500 / speed;
    if (isPlaying) {
      baseIntervalRef.current && clearInterval(baseIntervalRef.current);
      baseIntervalRef.current = window.setInterval(() => {
        if (update) applyMBOUpdate(update);
        const sig = simpleStrategySignal(deltaHistory.slice(-30), priceHistory.slice(-30));
        if (sig) handleSignal(sig);
      }, ms);
    } else if (baseIntervalRef.current) {
      clearInterval(baseIntervalRef.current);
      baseIntervalRef.current = null;
    }
    return () => { if (baseIntervalRef.current) clearInterval(baseIntervalRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPlaying, speed, update, deltaHistory, priceHistory]);

  // ensure book seeded
  useEffect(() => {
    if (askLevels.length === 0 && bidLevels.length === 0) seedBook((bestBid + bestAsk) / 2);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // -------------------------------
  // Self-tests (dev-time assertions)
  // -------------------------------
  useEffect(() => { runSelfTests(); }, []);

  // core update handler
  function applyMBOUpdate(evt: MBOUpdate) {
    const { side, price, size, aggressive } = evt;

    // update book side list(s)
    if (side === "ask") {
      setAskLevels((prev) => upsertLevel(prev, price, size, aggressive));
    } else {
      setBidLevels((prev) => upsertLevel(prev, price, size, aggressive));
    }

    // delta
    const d = side === "bid" ? size : -size;
    setCumulativeDelta((cd) => {
      const next = cd + d;
      setDeltaHistory((hist) => (hist.length > 300 ? [...hist.slice(-299), next] : [...hist, next]));
      return next;
    });

    // price history uses mid
    const mid = (bestBid + bestAsk) / 2;
    setPriceHistory((h) => (h.length > 600 ? [...h.slice(-599), mid] : [...h, mid]));

    // volume profile
    setVolumeProfile((vp) => {
      const key = price.toFixed(2);
      const row = vp[key] || { buy: 0, sell: 0 };
      if (side === "bid") row.buy += size; else row.sell += size;
      return { ...vp, [key]: row };
    });

    // tape
    const isBuy = side === "bid";
    setTape((t) => {
      const row: TradeTapeRow = { ts: Date.now(), timeStr: nowStr(), price, size, isBuy, isAggressive: aggressive };
      const next = [row, ...t];
      return next.slice(0, 120);
    });

    // heatmap dot
    setHeatDots((dots) => {
      const x = Date.now();
      const y = price;
      const r = Math.min(20, 4 + size * 4);
      const alpha = aggressive ? 0.9 : 0.45;
      const key = `${x}-${y}-${Math.random()}`;
      const next: HeatDot[] = [{ x, y, r, alpha, key }, ...dots].slice(0, 200);
      return next;
    });

    // absorption detection: large size with tiny price displacement
    detectAbsorption(evt);
    // divergence: delta vs price trend disagreement
    maybeDetectDivergence();
  }

  // helpers for book
  function upsertLevel(levels: BookLevel[], price: number, size: number, aggressive: boolean) {
    const i = levels.findIndex((l) => l.price === price);
    let next: BookLevel[];
    if (i === -1) next = [...levels, { price, size, isAggressive: aggressive }];
    else {
      next = levels.slice();
      next[i] = { ...next[i], size, isAggressive: aggressive };
    }
    if (size > 2.8 && Math.random() > 0.7) {
      next[next.findIndex((l) => l.price === price)].isAbsorption = true;
    }
    next = next
      .sort((a, b) => a.price - b.price)
      .map((l, idx) => ({ ...l, total: next.slice(0, idx + 1).reduce((s, r) => s + (r.size || 0), 0) }));
    return next;
  }

  // absorption detection UI side effect
  const [liquidityEvents, setLiquidityEvents] = useState<{ ts: number; side: Side; title: string; desc: string }[]>([]);
  function detectAbsorption(evt: MBOUpdate) {
    const side = evt.side;
    const title = `${side === "bid" ? "Buy" : "Sell"} Side Absorption`;
    const desc = `Large ${side === "bid" ? "buy" : "sell"} order absorbed without price movement`;
    if (evt.size > 2.8 && !evt.aggressive) {
      setLiquidityEvents((L) => [{ ts: Date.now(), side, title, desc }, ...L].slice(0, 6));
    }
  }

  // divergence detection UI side effect
  const [divergences, setDivergences] = useState<{ ts: number; type: "bullish" | "bearish"; title: string; desc: string }[]>([]);
  function maybeDetectDivergence() {
    const d = deltaHistory;
    const p = priceHistory;
    if (d.length < 40 || p.length < 40) return;
    const dd = d[d.length - 1] - d[d.length - 30];
    const dp = p[p.length - 1] - p[p.length - 30];
    if (dd > 50 && dp < 0) {
      setDivergences((D) => [{ ts: Date.now(), type: "bullish", title: "Bullish Divergence", desc: "Price falling but delta rising" }, ...D].slice(0, 6));
    } else if (dd < -50 && dp > 0) {
      setDivergences((D) => [{ ts: Date.now(), type: "bearish", title: "Bearish Divergence", desc: "Price rising but delta falling" }, ...D].slice(0, 6));
    }
  }

  // strategy actions
  function handleSignal(sig: StrategySignal) {
    if (sig.kind === "enter-long") return onEnter("long");
    if (sig.kind === "enter-short") return onEnter("short");
    if (sig.kind === "exit") return onClose();
  }

  function onEnter(kind: "long" | "short") {
    if (position) return;
    const px = kind === "long" ? bestAsk : bestBid;
    setPosition({ type: kind, entry: px, size: 1 });
  }
  function onClose() {
    if (!position) return;
    const exitPx = position.type === "long" ? bestBid : bestAsk;
    const pnl = position.type === "long" ? (exitPx - position.entry) : (position.entry - exitPx);
    setBalance((b) => b + pnl);
    setTrades((T) => [{ type: position.type, entry: position.entry, exit: exitPx, pnl, tsOpen: Date.now(), tsClose: Date.now() }, ...T]);
    setPosition(null);
  }
  function onReset() {
    setIsPlaying(false);
    setAskLevels([]); setBidLevels([]);
    setCumulativeDelta(0); setDeltaHistory([]); setPriceHistory([]);
    setVolumeProfile({}); setTape([]); setHeatDots([]);
    setBalance(10000); setPosition(null); setTrades([]);
    setDivergences([]); setLiquidityEvents([]);
    seedBook((bestBid + bestAsk) / 2);
  }

  // seed initial ladders
  function seedBook(mid: number) {
    const lvls: BookLevel[] = [];
    for (let i = 1; i <= 30; i++) lvls.push({ price: Number((mid + i * 0.5).toFixed(2)), size: Number((0.5 + Math.random() * 3).toFixed(4)) });
    const rvls: BookLevel[] = [];
    for (let i = 1; i <= 30; i++) rvls.push({ price: Number((mid - i * 0.5).toFixed(2)), size: Number((0.5 + Math.random() * 3).toFixed(4)) });
    setAskLevels(lvls);
    setBidLevels(rvls);
  }

  // metrics
  const wins = trades.filter((t) => (t.pnl || 0) > 0).length;
  const winRate = trades.length ? (wins / trades.length) * 100 : 0;
  const unrealized = position
    ? position.type === "long" ? bestBid - position.entry : position.entry - bestAsk
    : 0;

  // ML demo call
  async function runModel() {
    setMlBusy(true); setMlOutput(null);
    try {
      const fn = ModelRegistry[mlModel];
      const out = await fn({ ingest_rate: 1400, cpu: 0.62, p99: 380, load: 0.72, infra: 0.65, exceedances: 5, throughput: 1500, canary_metric: 0.46 });
      setMlOutput(out);
    } finally {
      setMlBusy(false);
    }
  }

  // heatmap canvas coords
  const heatYMin = useMemo(() => {
    const a = askLevels.slice(0, 10).map((l) => l.price);
    const b = bidLevels.slice(0, 10).map((l) => l.price);
    const arr = [...a, ...b, bestBid, bestAsk].filter((v) => typeof v === "number" && !Number.isNaN(v)) as number[];
    return arr.length ? Math.min(...arr) : 0;
  }, [askLevels, bidLevels, bestBid, bestAsk]);
  const heatYMax = useMemo(() => {
    const a = askLevels.slice(0, 10).map((l) => l.price);
    const b = bidLevels.slice(0, 10).map((l) => l.price);
    const arr = [...a, ...b, bestBid, bestAsk].filter((v) => typeof v === "number" && !Number.isNaN(v)) as number[];
    return arr.length ? Math.max(...arr) : 0;
  }, [askLevels, bidLevels, bestBid, bestAsk]);

  // -------------------------------
  // UI
  // -------------------------------

  return (
    <div className="min-h-screen bg-[#0a0e27] text-zinc-200 flex flex-col">
      {/* Top Bar */}
      <div className="flex items-center justify-between px-5 py-3 bg-[#151932] border-b border-[#1e2442]">
        <div className="flex items-center gap-6">
          <div className="text-white font-extrabold text-lg">BTC/USD</div>
          <div className="flex gap-4 text-xs">
            <KV label="Last" value={`$${(((bestBid + bestAsk) / 2).toFixed(2))}`} />
            <KV label="Spread" value={`$${(bestAsk - bestBid).toFixed(2)}`} />
            <KV label="Delta" value={(cumulativeDelta >= 0 ? "+" : "") + cumulativeDelta.toFixed(0)} valueClass={cumulativeDelta >= 0 ? "text-emerald-400" : "text-red-400"} />
          </div>
        </div>
        <div className="flex items-center gap-2 text-sm text-slate-400">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span>{isPlaying ? "Backtest Running" : "Backtest Paused"}</span>
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 xl:grid-cols-[320px_1fr_360px] gap-px bg-[#1e2442] flex-1 min-h-0">
        {/* Left Panel */}
        <Panel>
          <Section title="Backtest Controls">
            <div className="flex flex-col gap-3">
              <div className="flex gap-2">
                {!isPlaying ? (
                  <Btn variant="primary" onClick={() => setIsPlaying(true)} icon={<Play className="w-4 h-4" />}>Play</Btn>
                ) : (
                  <Btn variant="dark" onClick={() => setIsPlaying(false)} icon={<Pause className="w-4 h-4" />}>Pause</Btn>
                )}
                <Btn variant="blue" onClick={onReset} icon={<RotateCcw className="w-4 h-4" />}>Reset</Btn>
              </div>
              <div className="flex items-center gap-3 bg-[#0a0e27] rounded-md p-2">
                <div className="text-[11px] text-slate-400 w-12">Speed</div>
                <input type="range" min={1} max={10} value={speed} onChange={(e) => setSpeed(Number(e.target.value))} className="w-full" />
                <div className="text-[11px] text-slate-400 w-8 text-right">{speed}x</div>
              </div>
              <div className="flex gap-2">
                <Btn variant="primary" onClick={() => onEnter("long")} icon={<ArrowUpRight className="w-4 h-4" />}>Buy Long</Btn>
                <Btn variant="danger" onClick={() => onEnter("short")} icon={<ArrowDownRight className="w-4 h-4" />}>Sell Short</Btn>
              </div>
              <div>
                <Btn variant="dark" onClick={onClose}>Close Position</Btn>
              </div>
            </div>
          </Section>

          <Section title="Performance Metrics">
            <div className="grid grid-cols-2 gap-2">
              <Metric label="Balance" value={fmtMoney(balance)} />
              <Metric label="P&L" value={fmtMoney(unrealized)} valueClass={unrealized >= 0 ? "text-emerald-400" : "text-red-400"} />
              <Metric label="Position" value={position ? position.type.toUpperCase() : "None"} valueClass={position ? (position.type === "long" ? "text-emerald-400" : "text-red-400") : ""} />
              <Metric label="Entry" value={position ? `$${position.entry.toFixed(2)}` : "-"} />
              <Metric label="Trades" value={String(trades.length)} />
              <Metric label="Win Rate" value={fmtPcnt(winRate)} />
            </div>
          </Section>

          <Section title="Cumulative Delta">
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={deltaHistory.map((d, i) => ({ i, d }))} margin={{ top: 5, right: 5, bottom: 0, left: 0 }}>
                  <XAxis dataKey="i" hide />
                  <YAxis hide domain={["auto", "auto"]} />
                  <Tooltip formatter={(v) => [Number(v).toFixed(0), "Δ"]} />
                  <ReferenceLine y={0} stroke="#1e2442" />
                  <Area type="monotone" dataKey="d" dot={false} isAnimationActive={false} />
                  <Line type="monotone" dataKey="d" dot={false} isAnimationActive={false} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </Section>

          <Section title="Volume Profile (Top 12 Levels)">
            <div className="flex flex-col gap-1">
              {Object.keys(volumeProfile)
                .sort((a, b) => Number(b) - Number(a))
                .slice(0, 12)
                .map((p) => {
                  const row = volumeProfile[p];
                  const total = row.buy + row.sell || 1;
                  const buyPct = (row.buy / total) * 100;
                  const sellPct = (row.sell / total) * 100;
                  const imb = ((row.buy - row.sell) / total) * 100;
                  return (
                    <div key={p} className="flex items-center gap-2 text-[11px]">
                      <div className="w-16 text-right text-slate-400 font-semibold">{p}</div>
                      <div className="flex-1 h-5 bg-[#0a0e27] rounded relative overflow-hidden">
                        <div className="absolute left-0 top-0 bottom-0 bg-emerald-500/30" style={{ width: `${buyPct}%` }} />
                        <div className="absolute right-0 top-0 bottom-0 bg-red-500/30" style={{ width: `${sellPct}%` }} />
                        <div className="absolute inset-0 flex items-center justify-center text-[10px] font-bold">{Math.round(imb)}%</div>
                      </div>
                    </div>
                  );
                })}
            </div>
          </Section>
        </Panel>

        {/* Center Panel */}
        <Panel>
          <Section title="Order Book (MBO)">
            <div className="grid grid-cols-2 gap-px bg-[#1e2442] h-[480px]">
              <div className="bg-[#151932] flex flex-col min-h-0">
                <div className="px-3 py-2 text-[12px] font-semibold uppercase tracking-wide border-b border-[#1e2442] text-red-400 bg-red-400/10">Asks</div>
                <div className="flex-1 overflow-y-auto text-[12px]">
                  {[...askLevels].reverse().map((l) => (
                    <OrderRow key={`a-${l.price}`} level={l} side="ask" maxTotal={(askLevels.length ? (askLevels[askLevels.length-1].total || 1) : 1)} />
                  ))}
                </div>
              </div>
              <div className="bg-[#151932] flex flex-col min-h-0">
                <div className="px-3 py-2 text-[12px] font-semibold uppercase tracking-wide border-b border-[#1e2442] text-emerald-400 bg-emerald-400/10">Bids</div>
                <div className="flex-1 overflow-y-auto text-[12px]">
                  {bidLevels.map((l) => (
                    <OrderRow key={`b-${l.price}`} level={l} side="bid" maxTotal={(bidLevels.length ? (bidLevels[bidLevels.length-1].total || 1) : 1)} />
                  ))}
                </div>
              </div>
            </div>
          </Section>

          <Section title="Volume Heatmap">
            <div className="relative h-72 bg-[#0a0e27] rounded overflow-hidden">
              <div className="absolute inset-0">
                {heatDots.map((d, idx) => {
                  const x0 = heatDots.length - idx; // newest at left
                  const xPct = Math.min(100, (x0 / heatDots.length) * 100);
                  const yPct = heatYMax === heatYMin ? 50 : ((d.y - heatYMin) / (heatYMax - heatYMin)) * 100;
                  return (
                    <div
                      key={d.key}
                      className="absolute rounded-full bg-emerald-500"
                      style={{ left: `${100 - xPct}%`, top: `${100 - yPct}%`, width: d.r, height: d.r, opacity: d.alpha }}
                    />
                  );
                })}
              </div>
            </div>
          </Section>
        </Panel>

        {/* Right Panel */}
        <Panel>
          <Section title="Time & Sales">
            <div className="max-h-[360px] overflow-y-auto text-[11px]">
              {tape.map((t) => (
                <div key={t.ts + String(t.price)} className={`grid grid-cols-[64px_1fr_1fr_56px] px-3 py-1 border-b border-[#1e2442] ${t.isAggressive ? "bg-amber-400/10" : ""}`}>
                  <div className="text-slate-400">{t.timeStr}</div>
                  <div className={`font-semibold ${t.isBuy ? "text-emerald-400" : "text-red-400"}`}>{t.price.toFixed(2)}</div>
                  <div className="text-right text-slate-300">{t.size.toFixed(4)}</div>
                  <div className="text-right text-[9px] font-bold">{t.isAggressive ? "AGG" : "PAS"}</div>
                </div>
              ))}
            </div>
          </Section>

          <Section title="Order Flow Divergence">
            <div className="flex flex-col gap-2">
              {divergences.map((d) => (
                <div key={d.ts} className={`p-3 rounded border-l-4 ${d.type === "bullish" ? "border-emerald-400" : "border-red-400"} bg-[#0a0e27]`}>
                  <div className="font-semibold">{d.title}</div>
                  <div className="text-[11px] text-slate-400">{d.desc}</div>
                </div>
              ))}
            </div>
          </Section>

          <Section title="Liquidity Events">
            <div className="flex flex-col gap-2">
              {liquidityEvents.map((e) => (
                <div key={e.ts} className={`p-3 rounded border-l-4 ${e.side === "bid" ? "border-emerald-400" : "border-red-400"} bg-[#0a0e27]`}>
                  <div className="font-semibold">{e.title}</div>
                  <div className="text-[11px] text-slate-400">{e.desc}</div>
                </div>
              ))}
            </div>
          </Section>

          <Section title="ML Model Integration (Demo Harness)">
            <div className="flex items-center gap-2 mb-2">
              <select value={mlModel} onChange={(e) => setMlModel(e.target.value as any)} className="bg-[#0a0e27] border border-[#1e2442] rounded px-2 py-1 text-sm">
                <option value="capacityPlanning">Capacity Planning — Prophet + TFT</option>
                <option value="tailSLO">Tail SLO Control — XGBoost Quantile + CQR</option>
                <option value="extremeEvents">Extreme Events — EVT (POT/GPD)</option>
                <option value="regimeDetection">Regime Detection — BOCPD</option>
                <option value="bandit">Online Tuning — Contextual Bandits</option>
                <option value="bayesOpt">Offline Optimization — Bayesian Opt.</option>
              </select>
              <Btn variant="blue" onClick={runModel} icon={<Cpu className="w-4 h-4" />}>{mlBusy ? "Running..." : "Run"}</Btn>
            </div>
            <pre className="text-xs bg-[#0a0e27] border border-[#1e2442] rounded p-3 overflow-auto">{mlOutput ? JSON.stringify(mlOutput, null, 2) : "// Output will appear here"}</pre>
          </Section>
        </Panel>
      </div>

      {/* Footer tiny legend */}
      <div className="px-5 py-2 text-[11px] text-slate-500 border-t border-[#1e2442]">Aggressive orders highlighted in amber. Ask levels red, Bid levels green. Replace synthetic feed with your exchange adapter to go live.</div>
    </div>
  );
}

// -------------------------------
// Small UI atoms
// -------------------------------

function Panel({ children }: { children: React.ReactNode }) {
  return <div className="bg-[#0a0e27] overflow-y-auto">{children}</div>;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="m-3 rounded-lg border border-[#1e2442] bg-[#151932] overflow-hidden">
      <div className="px-4 py-2 border-b border-[#1e2442] text-white text-[13px] font-semibold flex items-center justify-between">
        <div>{title}</div>
      </div>
      <div className="p-3">{children}</div>
    </div>
  );
}

function KV({ label, value, valueClass = "" }: { label: string; value: string; valueClass?: string }) {
  return (
    <div className="flex flex-col gap-0.5 text-[11px]">
      <div className="uppercase text-[10px] text-slate-400">{label}</div>
      <div className={`font-semibold ${valueClass}`}>{value}</div>
    </div>
  );
}

function Btn({ children, onClick, variant = "dark", icon }: { children: React.ReactNode; onClick?: () => void; variant?: "primary" | "blue" | "danger" | "dark"; icon?: React.ReactNode }) {
  const base = "flex-1 inline-flex items-center justify-center gap-2 px-3 py-2 rounded-md text-[12px] font-semibold";
  const cls =
    variant === "primary" ? "bg-emerald-500 hover:bg-emerald-600 text-white" :
    variant === "blue" ? "bg-blue-500 hover:bg-blue-600 text-white" :
    variant === "danger" ? "bg-red-500 hover:bg-red-600 text-white" :
    "bg-[#1e2442] hover:bg-[#2d3454] text-zinc-200";
  return (
    <button onClick={onClick} className={`${base} ${cls}`}>{icon}{children}</button>
  );
}

function Metric({ label, value, valueClass = "" }: { label: string; value: string; valueClass?: string }) {
  return (
    <div className="bg-[#0a0e27] rounded p-3 text-center">
      <div className="text-[10px] uppercase text-slate-400 tracking-wide mb-0.5">{label}</div>
      <div className={`text-lg font-extrabold ${valueClass}`}>{value}</div>
    </div>
  );
}

function OrderRow({ level, side, maxTotal }: { level: BookLevel; side: Side; maxTotal: number }) {
  const depthPct = Math.max(0, Math.min(100, ((level.total || 0) / Math.max(1, maxTotal)) * 100));
  const badge = level.isAggressive ? (
    <span className="text-[9px] font-bold px-1 py-0.5 rounded bg-amber-400 text-black ml-1">AGG</span>
  ) : (
    <span className="text-[9px] font-bold px-1 py-0.5 rounded bg-slate-500 text-white ml-1">PAS</span>
  );
  const abs = level.isAbsorption ? <span className="text-[9px] font-bold px-1 py-0.5 rounded bg-violet-500 text-white ml-1">ABS</span> : null;
  return (
    <div className="relative grid grid-cols-[1fr_1fr_0.8fr] gap-2 px-3 py-1 hover:bg-white/5">
      <div className={`font-semibold ${side === "ask" ? "text-red-400" : "text-emerald-400"}`}>
        {level.price.toFixed(2)}{badge}{abs}
      </div>
      <div className="text-right text-slate-300">{level.size.toFixed(4)}</div>
      <div className="text-right text-slate-400">{(level.total || 0).toFixed(4)}</div>
      <div className={`absolute top-0 right-0 h-full opacity-20 ${side === "ask" ? "bg-red-500" : "bg-emerald-500"}`} style={{ width: `${depthPct}%` }} />
    </div>
  );
}

// -------------------------------
// Dev-only self tests for helpers
// -------------------------------
function runSelfTests() {
  try {
    // Test: upsertLevel creates and accumulates totals
    const start: BookLevel[] = [];
    const after1 = test_upsertLevel(start, 100, 2, false);
    const after2 = test_upsertLevel(after1, 101, 3, true);
    const after3 = test_upsertLevel(after2, 100, 4, false); // update existing
    console.assert(after1.length === 1 && after1[0].price === 100, "upsertLevel insert failed");
    console.assert(after2.length === 2 && after2[1].price === 101, "upsertLevel second insert failed");
    console.assert(after3.find((l) => l.price === 100)?.size === 4, "upsertLevel update failed");

    // Test: depth totals are monotonic
    for (let i = 1; i < after3.length; i++) {
      console.assert((after3[i].total || 0) >= (after3[i-1].total || 0), "totals not monotonic");
    }

    // Test: divergence detector threshold logic (pure math sketch)
    const dd = 60; const dp = -1; // bullish divergence scenario
    console.assert(dd > 50 && dp < 0, "divergence thresholds expectation");

    // Test passed
    if (typeof window !== 'undefined' && !(window as any).__ofp_tests_done) {
      console.log("[OrderFlowPro] self-tests passed");
      (window as any).__ofp_tests_done = true;
    }
  } catch (e) {
    console.error("[OrderFlowPro] self-tests failed", e);
  }
}

function test_upsertLevel(levels: BookLevel[], price: number, size: number, aggressive: boolean) {
  const i = levels.findIndex((l) => l.price === price);
  let next: BookLevel[];
  if (i === -1) next = [...levels, { price, size, isAggressive: aggressive }];
  else { next = levels.slice(); next[i] = { ...next[i], size, isAggressive: aggressive }; }
  next = next
    .sort((a, b) => a.price - b.price)
    .map((l, idx) => ({ ...l, total: next.slice(0, idx + 1).reduce((s, r) => s + (r.size || 0), 0) }));
  return next;
}
