import { useEffect, useMemo, useRef, useState } from "react";
import {
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  ComposedChart,
  Line,
} from "recharts";
import { Panel, Section, Button, Metric, KeyValue, OrderRow, PageLayout } from "@/components";
import {
  BookLevel,
  TradeTapeRow,
  HeatDot,
  LiquidityEvent,
  Divergence,
  Position,
  StrategyTrade,
  MBOUpdate,
} from "@/types";
import { fmtMoney, fmtPcnt, nowStr } from "@/utils";
import { useSyntheticFeed } from "@/hooks/useSyntheticFeed";

export function MBOPage() {
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
  const [speed, setSpeed] = useState(5);
  const [balance, setBalance] = useState(10000);
  const [position, setPosition] = useState<Position | null>(null);
  const [trades, setTrades] = useState<StrategyTrade[]>([]);

  // Events
  const [liquidityEvents, setLiquidityEvents] = useState<LiquidityEvent[]>([]);
  const [divergences, setDivergences] = useState<Divergence[]>([]);

  // Feed
  const { update, bestBid, bestAsk } = useSyntheticFeed();

  // Playback timer
  const baseIntervalRef = useRef<number | null>(null);

  useEffect(() => {
    const ms = 500 / speed;
    if (isPlaying && update) {
      baseIntervalRef.current && clearInterval(baseIntervalRef.current);
      baseIntervalRef.current = window.setInterval(() => {
        if (update) applyMBOUpdate(update);
      }, ms);
    } else if (baseIntervalRef.current) {
      clearInterval(baseIntervalRef.current);
      baseIntervalRef.current = null;
    }
    return () => {
      if (baseIntervalRef.current) clearInterval(baseIntervalRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPlaying, speed, update]);

  // Seed initial book
  useEffect(() => {
    if (askLevels.length === 0 && bidLevels.length === 0) {
      seedBook((bestBid + bestAsk) / 2);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function applyMBOUpdate(evt: MBOUpdate) {
    const { side, price, size, aggressive } = evt;

    // Update book
    if (side === "ask") {
      setAskLevels((prev) => upsertLevel(prev, price, size, aggressive));
    } else {
      setBidLevels((prev) => upsertLevel(prev, price, size, aggressive));
    }

    // Delta
    const d = side === "bid" ? size : -size;
    setCumulativeDelta((cd) => {
      const next = cd + d;
      setDeltaHistory((hist) =>
        hist.length > 300 ? [...hist.slice(-299), next] : [...hist, next]
      );
      return next;
    });

    // Price history
    const mid = (bestBid + bestAsk) / 2;
    setPriceHistory((h) => (h.length > 600 ? [...h.slice(-599), mid] : [...h, mid]));

    // Volume profile
    setVolumeProfile((vp) => {
      const key = price.toFixed(2);
      const row = vp[key] || { buy: 0, sell: 0 };
      if (side === "bid") row.buy += size;
      else row.sell += size;
      return { ...vp, [key]: row };
    });

    // Tape
    const isBuy = side === "bid";
    setTape((t) => {
      const row: TradeTapeRow = {
        ts: Date.now(),
        timeStr: nowStr(),
        price,
        size,
        isBuy,
        isAggressive: aggressive,
      };
      return [row, ...t].slice(0, 120);
    });

    // Heatmap
    setHeatDots((dots) => {
      const x = Date.now();
      const y = price;
      const r = Math.min(20, 4 + size * 4);
      const alpha = aggressive ? 0.9 : 0.45;
      const key = `${x}-${y}-${Math.random()}`;
      return [{ x, y, r, alpha, key }, ...dots].slice(0, 200);
    });

    // Absorption detection
    detectAbsorption(evt);

    // Divergence detection
    maybeDetectDivergence();
  }

  function upsertLevel(levels: BookLevel[], price: number, size: number, aggressive: boolean) {
    const i = levels.findIndex((l) => l.price === price);
    let next: BookLevel[];

    if (i === -1) {
      next = [...levels, { price, size, isAggressive: aggressive }];
    } else {
      next = levels.slice();
      next[i] = { ...next[i], size, isAggressive: aggressive };
    }

    if (size > 2.8 && Math.random() > 0.7) {
      const idx = next.findIndex((l) => l.price === price);
      if (idx !== -1) next[idx].isAbsorption = true;
    }

    next = next
      .sort((a, b) => a.price - b.price)
      .map((l, idx) => ({
        ...l,
        total: next.slice(0, idx + 1).reduce((s, r) => s + (r.size || 0), 0),
      }));

    return next;
  }

  function detectAbsorption(evt: MBOUpdate) {
    const side = evt.side;
    const title = `${side === "bid" ? "Buy" : "Sell"} Side Absorption`;
    const desc = `Large ${side === "bid" ? "buy" : "sell"} order absorbed without price movement`;

    if (evt.size > 2.8 && !evt.aggressive) {
      setLiquidityEvents((L) => [{ ts: Date.now(), side, title, desc }, ...L].slice(0, 6));
    }
  }

  function maybeDetectDivergence() {
    const d = deltaHistory;
    const p = priceHistory;
    if (d.length < 40 || p.length < 40) return;

    const dd = d[d.length - 1] - d[d.length - 30];
    const dp = p[p.length - 1] - p[p.length - 30];

    if (dd > 50 && dp < 0) {
      setDivergences((D) =>
        [
          {
            ts: Date.now(),
            type: "bullish" as const,
            title: "Bullish Divergence",
            desc: "Price falling but delta rising",
          },
          ...D,
        ].slice(0, 6)
      );
    } else if (dd < -50 && dp > 0) {
      setDivergences((D) =>
        [
          {
            ts: Date.now(),
            type: "bearish" as const,
            title: "Bearish Divergence",
            desc: "Price rising but delta falling",
          },
          ...D,
        ].slice(0, 6)
      );
    }
  }

  function onEnter(kind: "long" | "short") {
    if (position) return;
    const px = kind === "long" ? bestAsk : bestBid;
    setPosition({ type: kind, entry: px, size: 1 });
  }

  function onClose() {
    if (!position) return;
    const exitPx = position.type === "long" ? bestBid : bestAsk;
    const pnl = position.type === "long" ? exitPx - position.entry : position.entry - exitPx;
    setBalance((b) => b + pnl);
    setTrades((T) => [
      {
        type: position.type,
        entry: position.entry,
        exit: exitPx,
        pnl,
        tsOpen: Date.now(),
        tsClose: Date.now(),
      },
      ...T,
    ]);
    setPosition(null);
  }

  function onReset() {
    setIsPlaying(false);
    setAskLevels([]);
    setBidLevels([]);
    setCumulativeDelta(0);
    setDeltaHistory([]);
    setPriceHistory([]);
    setVolumeProfile({});
    setTape([]);
    setHeatDots([]);
    setBalance(10000);
    setPosition(null);
    setTrades([]);
    setDivergences([]);
    setLiquidityEvents([]);
    seedBook((bestBid + bestAsk) / 2);
  }

  function seedBook(mid: number) {
    const asks: BookLevel[] = [];
    for (let i = 1; i <= 30; i++) {
      asks.push({
        price: Number((mid + i * 0.5).toFixed(2)),
        size: Number((0.5 + Math.random() * 3).toFixed(4)),
      });
    }

    const bids: BookLevel[] = [];
    for (let i = 1; i <= 30; i++) {
      bids.push({
        price: Number((mid - i * 0.5).toFixed(2)),
        size: Number((0.5 + Math.random() * 3).toFixed(4)),
      });
    }

    setAskLevels(asks);
    setBidLevels(bids);
  }

  // Metrics
  const wins = trades.filter((t) => (t.pnl || 0) > 0).length;
  const winRate = trades.length ? (wins / trades.length) * 100 : 0;
  const unrealized = position
    ? position.type === "long"
      ? bestBid - position.entry
      : position.entry - bestAsk
    : 0;

  // Heatmap bounds
  const heatYMin = useMemo(() => {
    const a = askLevels.slice(0, 10).map((l) => l.price);
    const b = bidLevels.slice(0, 10).map((l) => l.price);
    const arr = [...a, ...b, bestBid, bestAsk].filter(
      (v) => typeof v === "number" && !Number.isNaN(v)
    ) as number[];
    return arr.length ? Math.min(...arr) : 0;
  }, [askLevels, bidLevels, bestBid, bestAsk]);

  const heatYMax = useMemo(() => {
    const a = askLevels.slice(0, 10).map((l) => l.price);
    const b = bidLevels.slice(0, 10).map((l) => l.price);
    const arr = [...a, ...b, bestBid, bestAsk].filter(
      (v) => typeof v === "number" && !Number.isNaN(v)
    ) as number[];
    return arr.length ? Math.max(...arr) : 0;
  }, [askLevels, bidLevels, bestBid, bestAsk]);

  return (
    <PageLayout
      header={{
        title: "MBO - Market By Order",
        subtitle: (
          <div className="flex gap-4 text-xs">
            <KeyValue label="Last" value={`$${((bestBid + bestAsk) / 2).toFixed(2)}`} />
            <KeyValue label="Spread" value={`$${(bestAsk - bestBid).toFixed(2)}`} />
            <KeyValue
              label="Delta"
              value={(cumulativeDelta >= 0 ? "+" : "") + cumulativeDelta.toFixed(0)}
              valueClass={cumulativeDelta >= 0 ? "text-trade-buyText" : "text-trade-sellText"}
            />
          </div>
        ),
        status: { label: isPlaying ? "Live Feed" : "Paused", active: isPlaying }
      }}
      layout="three-col"
    >
      <Panel spacing="compact">
          <Section title="Controls">
            <div className="flex flex-col gap-3">
              <div className="flex gap-2">
                {!isPlaying ? (
                  <Button
                    variant="primary"
                    onClick={() => setIsPlaying(true)}
                    className="flex-1"
                  >
                    Play
                  </Button>
                ) : (
                  <Button
                    variant="dark"
                    onClick={() => setIsPlaying(false)}
                    className="flex-1"
                  >
                    Pause
                  </Button>
                )}
                <Button
                  variant="blue"
                  onClick={onReset}
                  className="flex-1"
                >
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
              <div className="flex gap-2">
                <Button
                  variant="success"
                  onClick={() => onEnter("long")}
                  className="flex-1"
                >
                  Long
                </Button>
                <Button
                  variant="danger"
                  onClick={() => onEnter("short")}
                  className="flex-1"
                >
                  Short
                </Button>
              </div>
              <Button variant="dark" onClick={onClose}>
                Close Position
              </Button>
            </div>
          </Section>

          <Section title="Performance">
            <div className="grid grid-cols-2 gap-2">
              <Metric label="Balance" value={fmtMoney(balance)} />
              <Metric
                label="P&L"
                value={fmtMoney(unrealized)}
                valueClass={unrealized >= 0 ? "text-trade-buyText" : "text-trade-sellText"}
              />
              <Metric
                label="Position"
                value={position ? position.type.toUpperCase() : "None"}
                valueClass={
                  position
                    ? position.type === "long"
                      ? "text-trade-buyText"
                      : "text-trade-sellText"
                    : ""
                }
              />
              <Metric label="Entry" value={position ? `$${position.entry.toFixed(2)}` : "-"} />
              <Metric label="Trades" value={String(trades.length)} />
              <Metric label="Win Rate" value={fmtPcnt(winRate)} />
            </div>
          </Section>

          <Section title="Cumulative Delta">
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart
                  data={deltaHistory.map((d, i) => ({ i, d }))}
                  margin={{ top: 5, right: 5, bottom: 0, left: 0 }}
                >
                  <XAxis dataKey="i" hide />
                  <YAxis hide domain={["auto", "auto"]} />
                  <Tooltip formatter={(v) => [Number(v).toFixed(0), "Δ"]} />
                  <ReferenceLine y={0} stroke="#2a2a2a" />
                  <Area type="monotone" dataKey="d" fill="#4ade80" stroke="#4ade80" fillOpacity={0.2} dot={false} isAnimationActive={false} />
                  <Line type="monotone" dataKey="d" stroke="#4ade80" dot={false} isAnimationActive={false} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </Section>

          <Section title="Volume Profile (Top 12)">
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
                      <div className="flex-1 h-5 bg-dark-bg rounded relative overflow-hidden">
                        <div
                          className="absolute left-0 top-0 bottom-0 bg-trade-buy/40"
                          style={{ width: `${buyPct}%` }}
                        />
                        <div
                          className="absolute right-0 top-0 bottom-0 bg-trade-sell/40"
                          style={{ width: `${sellPct}%` }}
                        />
                        <div className="absolute inset-0 flex items-center justify-center text-[10px] font-bold">
                          {Math.round(imb)}%
                        </div>
                      </div>
                    </div>
                  );
                })}
            </div>
          </Section>
        </Panel>

        <Panel>
          <Section title="Order Book">
            <div className="grid grid-cols-2 gap-px bg-dark-border h-[480px]">
              <div className="bg-dark-panel flex flex-col min-h-0">
                <div className="px-3 py-2 text-[12px] font-semibold uppercase tracking-wide border-b border-dark-border text-trade-sellText bg-trade-sell/10">
                  Asks
                </div>
                <div className="flex-1 overflow-y-auto text-[12px]">
                  {[...askLevels].reverse().map((l) => (
                    <OrderRow
                      key={`a-${l.price}`}
                      level={l}
                      side="ask"
                      maxTotal={askLevels.length ? askLevels[askLevels.length - 1].total || 1 : 1}
                    />
                  ))}
                </div>
              </div>
              <div className="bg-dark-panel flex flex-col min-h-0">
                <div className="px-3 py-2 text-[12px] font-semibold uppercase tracking-wide border-b border-dark-border text-trade-buyText bg-trade-buy/10">
                  Bids
                </div>
                <div className="flex-1 overflow-y-auto text-[12px]">
                  {bidLevels.map((l) => (
                    <OrderRow
                      key={`b-${l.price}`}
                      level={l}
                      side="bid"
                      maxTotal={bidLevels.length ? bidLevels[bidLevels.length - 1].total || 1 : 1}
                    />
                  ))}
                </div>
              </div>
            </div>
          </Section>

          <Section title="Volume Heatmap">
            <div className="relative h-72 bg-dark-bg rounded overflow-hidden">
              <div className="absolute inset-0">
                {heatDots.map((d, idx) => {
                  const x0 = heatDots.length - idx;
                  const xPct = Math.min(100, (x0 / heatDots.length) * 100);
                  const yPct =
                    heatYMax === heatYMin ? 50 : ((d.y - heatYMin) / (heatYMax - heatYMin)) * 100;
                  return (
                    <div
                      key={d.key}
                      className="absolute rounded-full bg-slate-400"
                      style={{
                        left: `${100 - xPct}%`,
                        top: `${100 - yPct}%`,
                        width: d.r,
                        height: d.r,
                        opacity: d.alpha * 0.5,
                      }}
                    />
                  );
                })}
              </div>
            </div>
          </Section>
        </Panel>

        <Panel>
          <Section title="Time & Sales">
            <div className="max-h-[360px] overflow-y-auto text-[11px]">
              {tape.map((t, idx) => (
                <div
                  key={`${t.ts}-${idx}`}
                  className={`grid grid-cols-[64px_1fr_1fr_56px] px-3 py-1 border-b border-dark-border ${
                    t.isAggressive ? "bg-amber-400/10" : ""
                  }`}
                >
                  <div className="text-slate-400">{t.timeStr}</div>
                  <div className={`font-semibold ${t.isBuy ? "text-trade-buyText" : "text-trade-sellText"}`}>
                    {t.price.toFixed(2)}
                  </div>
                  <div className="text-right text-slate-300">{t.size.toFixed(4)}</div>
                  <div className={`text-right text-[9px] font-bold ${t.isAggressive ? "text-amber-400" : "text-slate-500"}`}>
                    {t.isAggressive ? "AGG" : "PAS"}
                  </div>
                </div>
              ))}
            </div>
          </Section>

          <Section title="Order Flow Divergence">
            <div className="flex flex-col gap-2">
              {divergences.length === 0 && (
                <div className="text-sm text-slate-400 text-center py-4">
                  No divergences detected
                </div>
              )}
              {divergences.map((d) => (
                <div
                  key={d.ts}
                  className={`p-3 rounded border-l-2 ${
                    d.type === "bullish" ? "border-trade-buyText" : "border-trade-sellText"
                  } bg-dark-bg`}
                >
                  <div className="font-semibold text-sm">{d.title}</div>
                  <div className="text-[11px] text-slate-400">{d.desc}</div>
                </div>
              ))}
            </div>
          </Section>

          <Section title="Liquidity Events">
            <div className="flex flex-col gap-2">
              {liquidityEvents.length === 0 && (
                <div className="text-sm text-slate-400 text-center py-4">
                  No liquidity events detected
                </div>
              )}
              {liquidityEvents.map((e) => (
                <div
                  key={e.ts}
                  className={`p-3 rounded border-l-2 ${
                    e.side === "bid" ? "border-trade-buyText" : "border-trade-sellText"
                  } bg-dark-bg`}
                >
                  <div className="font-semibold text-sm">{e.title}</div>
                  <div className="text-[11px] text-slate-400">{e.desc}</div>
                </div>
              ))}
            </div>
          </Section>
        </Panel>
    </PageLayout>
  );
}
