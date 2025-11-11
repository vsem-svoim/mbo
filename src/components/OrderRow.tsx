import React from "react";
import { BookLevel, Side } from "@/types";

interface OrderRowProps {
  level: BookLevel;
  side: Side;
  maxTotal: number;
}

export function OrderRow({ level, side, maxTotal }: OrderRowProps) {
  const depthPct = Math.max(0, Math.min(100, ((level.total || 0) / Math.max(1, maxTotal)) * 100));

  const badge = level.isAggressive ? (
    <span className="text-[9px] font-bold px-1 py-0.5 rounded bg-amber-400 text-black ml-1">
      AGG
    </span>
  ) : (
    <span className="text-[9px] font-bold px-1 py-0.5 rounded bg-slate-500 text-white ml-1">
      PAS
    </span>
  );

  const abs = level.isAbsorption ? (
    <span className="text-[9px] font-bold px-1 py-0.5 rounded bg-violet-500 text-white ml-1">
      ABS
    </span>
  ) : null;

  return (
    <div className="relative grid grid-cols-[1fr_1fr_0.8fr] gap-2 px-3 py-1 hover:bg-white/5">
      <div className={`font-semibold ${side === "ask" ? "text-red-400" : "text-emerald-400"}`}>
        {level.price.toFixed(2)}
        {badge}
        {abs}
      </div>
      <div className="text-right text-slate-300">{level.size.toFixed(4)}</div>
      <div className="text-right text-slate-400">{(level.total || 0).toFixed(4)}</div>
      <div
        className={`absolute top-0 right-0 h-full opacity-20 ${
          side === "ask" ? "bg-red-500" : "bg-emerald-500"
        }`}
        style={{ width: `${depthPct}%` }}
      />
    </div>
  );
}
