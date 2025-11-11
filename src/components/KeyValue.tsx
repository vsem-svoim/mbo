import React from "react";

interface KeyValueProps {
  label: string;
  value: string;
  valueClass?: string;
}

export function KeyValue({ label, value, valueClass = "" }: KeyValueProps) {
  return (
    <div className="flex flex-col gap-0.5 text-[11px]">
      <div className="uppercase text-[10px] text-slate-400">{label}</div>
      <div className={`font-semibold ${valueClass}`}>{value}</div>
    </div>
  );
}
