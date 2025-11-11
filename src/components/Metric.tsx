import React from "react";
import clsx from "clsx";

interface MetricProps {
  label: string;
  value: string | number;
  valueClass?: string;
  icon?: React.ReactNode;
  trend?: "up" | "down" | "neutral";
  trendValue?: string;
}

export function Metric({ label, value, valueClass = "", icon, trend, trendValue }: MetricProps) {
  return (
    <div className="bg-dark-bg rounded p-3 text-center">
      <div className="flex items-center justify-center gap-1 text-[10px] uppercase text-slate-400 tracking-wide mb-1">
        {icon}
        <span>{label}</span>
      </div>
      <div className={clsx("text-lg font-extrabold", valueClass)}>
        {value}
      </div>
      {trend && trendValue && (
        <div
          className={clsx(
            "text-[10px] font-semibold mt-1",
            trend === "up" && "text-emerald-400",
            trend === "down" && "text-red-400",
            trend === "neutral" && "text-slate-400"
          )}
        >
          {trendValue}
        </div>
      )}
    </div>
  );
}
