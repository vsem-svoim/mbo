// Core types for Order Flow Pro

export type Side = "bid" | "ask";

export interface BookLevel {
  price: number;
  size: number;
  isAggressive?: boolean;
  isAbsorption?: boolean;
  total?: number;
}

export interface TradeTapeRow {
  ts: number;
  timeStr: string;
  price: number;
  size: number;
  isBuy: boolean;
  isAggressive: boolean;
}

export interface HeatDot {
  x: number;
  y: number;
  r: number;
  alpha: number;
  key: string;
}

export interface StrategyTrade {
  type: "long" | "short";
  entry: number;
  exit?: number;
  pnl?: number;
  tsOpen: number;
  tsClose?: number;
}

export interface StrategySignal {
  ts: number;
  kind: "enter-long" | "enter-short" | "exit";
  reason?: string;
}

export interface MBOUpdate {
  side: Side;
  price: number;
  size: number;
  aggressive: boolean;
}

export interface LiquidityEvent {
  ts: number;
  side: Side;
  title: string;
  desc: string;
}

export interface Divergence {
  ts: number;
  type: "bullish" | "bearish";
  title: string;
  desc: string;
}

export interface Position {
  type: "long" | "short";
  entry: number;
  size: number;
}

// ML Model Types
export type MLInput = Record<string, number>;
export type MLOutput = Record<string, number | string>;
export type ModelFn = (input: MLInput) => Promise<MLOutput>;

export interface MLModelConfig {
  id: string;
  name: string;
  description: string;
  category: "capacity" | "performance" | "risk" | "optimization" | "detection" | "tuning";
  inputs: Array<{
    key: string;
    label: string;
    type: "number" | "slider" | "select";
    min?: number;
    max?: number;
    step?: number;
    default: number;
    options?: Array<{ value: number; label: string }>;
  }>;
  outputLabels: Record<string, string>;
  guardrails?: string[];
  useCases: string[];
}
