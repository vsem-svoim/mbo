import { useEffect, useMemo, useState } from "react";
import { MBOUpdate } from "@/types";
import { rng } from "@/utils";

/**
 * Synthetic MBO feed generator for development/testing
 * Replace with real exchange WebSocket adapter in production
 */
export function useSyntheticFeed(basePrice = 43250, seed = 7) {
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
    const spread = 0.5 + rand() * 0.5;
    const newBid = newMid - spread / 2;
    const newAsk = newMid + spread / 2;

    setBestBid(newBid);
    setBestAsk(newAsk);

    const isBuy = rand() > 0.5;
    const price = Number((isBuy ? newBid : newAsk).toFixed(2));
    const size = Number((0.2 + rand() * 3).toFixed(4));
    const aggressive = rand() > 0.7;

    return {
      side: isBuy ? "bid" : "ask",
      price,
      size,
      aggressive,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick]);

  return { update, bestBid, bestAsk };
}
