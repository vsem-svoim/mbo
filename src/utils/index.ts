// Utility functions for Order Flow Pro

export const fmtMoney = (n: number) => (n < 0 ? "-" : "") + "$" + Math.abs(n).toFixed(2);
export const fmtPcnt = (n: number) => `${n.toFixed(0)}%`;
export const nowStr = () => new Date().toLocaleTimeString("en-US", { hour12: false });

// Seeded RNG for deterministic replays
export function rng(seed = 42) {
  let s = seed >>> 0;
  return () => (s = (s * 1664525 + 1013904223) >>> 0) / 0xffffffff;
}

// Format large numbers with K/M suffixes
export const fmtNumber = (n: number): string => {
  if (n >= 1000000) return `${(n / 1000000).toFixed(2)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(2)}K`;
  return n.toFixed(2);
};

// Calculate percentage change
export const calcPctChange = (current: number, previous: number): number => {
  if (previous === 0) return 0;
  return ((current - previous) / previous) * 100;
};

// Clamp value between min and max
export const clamp = (value: number, min: number, max: number): number => {
  return Math.min(Math.max(value, min), max);
};

// Deep clone object
export const deepClone = <T>(obj: T): T => {
  return JSON.parse(JSON.stringify(obj));
};

// Debounce function
export const debounce = <T extends (...args: any[]) => any>(
  func: T,
  wait: number
): ((...args: Parameters<T>) => void) => {
  let timeout: number | null = null;
  return (...args: Parameters<T>) => {
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait) as unknown as number;
  };
};

// Calculate moving average
export const movingAverage = (data: number[], window: number): number[] => {
  const result: number[] = [];
  for (let i = 0; i < data.length; i++) {
    const start = Math.max(0, i - window + 1);
    const slice = data.slice(start, i + 1);
    const avg = slice.reduce((sum, val) => sum + val, 0) / slice.length;
    result.push(avg);
  }
  return result;
};

// Calculate standard deviation
export const stdDev = (data: number[]): number => {
  const mean = data.reduce((sum, val) => sum + val, 0) / data.length;
  const variance = data.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / data.length;
  return Math.sqrt(variance);
};

// Generate random color
export const randomColor = (seed?: number): string => {
  const random = seed ? rng(seed)() : Math.random();
  const hue = Math.floor(random * 360);
  return `hsl(${hue}, 70%, 60%)`;
};
