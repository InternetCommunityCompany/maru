/**
 * Static demo data wired into the design surfaces until live detection
 * lands. Centralised here so the eventual swap to real data is one diff
 * instead of grepping for placeholder strings across components.
 */

/** Lifetime savings hero strip on the popup + history panel. */
export const DEMO_LIFETIME = {
  total: "$247.80",
  swaps: 23,
  streak: "68d",
  avgPerSwap: "$10.77",
  bestSave: "$22.40",
  avgImprovement: "0.31%",
} as const;

/** A single closed-out swap in the history list. */
export interface DemoHistoryRow {
  pair: string;
  when: string;
  via: string;
  saved: string;
  pct: string;
}

export const DEMO_HISTORY: readonly DemoHistoryRow[] = [
  { pair: "USDC → ETH", when: "2h ago", via: "1inch", saved: "$10.18", pct: "+0.32%" },
  { pair: "ETH → ARB", when: "yesterday", via: "Stargate", saved: "$4.62", pct: "+0.46%" },
  { pair: "DAI → USDC", when: "3 days ago", via: "CowSwap", saved: "$1.04", pct: "+0.10%" },
  { pair: "USDC → SOL", when: "5 days ago", via: "Mayan", saved: "$22.40", pct: "+0.89%" },
  { pair: "WETH → ETH", when: "1 week ago", via: "Paraswap", saved: "$0.81", pct: "+0.04%" },
  { pair: "MATIC → USDC", when: "1 week ago", via: "Odos", saved: "$3.21", pct: "+0.16%" },
  { pair: "USDC → ETH", when: "2 weeks ago", via: "1inch", saved: "$8.40", pct: "+0.28%" },
  { pair: "ARB → ETH", when: "3 weeks ago", via: "Across", saved: "$15.20", pct: "+0.51%" },
];

/** A single tile in the lifetime stats grid. */
export interface DemoStat {
  value: string;
  label: string;
}

export const DEMO_STATS: readonly DemoStat[] = [
  { value: DEMO_LIFETIME.total, label: "Lifetime saved" },
  { value: String(DEMO_LIFETIME.swaps), label: "Swaps optimized" },
  { value: DEMO_LIFETIME.avgPerSwap, label: "Avg per swap" },
  { value: DEMO_LIFETIME.bestSave, label: "Best save" },
  { value: DEMO_LIFETIME.streak, label: "Active streak" },
  { value: DEMO_LIFETIME.avgImprovement, label: "Avg improvement" },
];
