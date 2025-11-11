# Order Flow Pro - Professional Trading Platform

A comprehensive React + Vite trading platform with Market By Order (MBO) analysis, High-Frequency Trading (HFT) strategies, and production-ready ML model integration.

## Features

### MBO - Market By Order Analysis
- **Real-time order book visualization** with bid/ask spreads
- **Imbalance/Cumulative Delta Analysis** tracking buy vs sell pressure
- **Volume profile** at each price level
- **Aggressive vs passive order detection**
- **Volume heatmap visualization**
- **Liquidity absorption detection**
- **Order flow divergence indicators**
- **Time & Sales tape** with highlighted aggressive orders
- Historical order book replay with playback controls

### HFT - High-Frequency Trading
- **Multiple strategy algorithms**:
  - Momentum Strategy
  - Mean Reversion
  - Order Flow Imbalance
- **Real-time signal generation** with entry/exit points
- **P&L tracking** and performance metrics
- **Backtesting framework** with speed controls
- **Risk management** and position sizing
- **Performance analytics**: win rate, profit factor, avg win/loss

### ML Models Integration
Six production-ready ML models with pre-configured UIs:

1. **Capacity Planning** (Prophet + TFT)
   - Forecast worker/queue requirements
   - Seasonal traffic planning
   - Event-driven capacity scaling

2. **Tail SLO Control** (XGBoost Quantile + CQR)
   - P95/P99 predictions
   - Autoscaling decisions
   - Admission control

3. **Extreme Events Detection** (EVT - POT/GPD)
   - Black swan detection
   - Tail risk alerting
   - Rare event modeling

4. **Regime Detection** (BOCPD)
   - Deploy impact detection
   - Market shift detection
   - Anomaly gating

5. **Online Tuning** (Contextual Bandits - UCB/TS)
   - A/B test optimization
   - Config selection
   - Canary analysis

6. **Offline Optimization** (Bayesian Optimization)
   - Nightly tuning runs
   - Load test optimization
   - Parameter discovery

## Tech Stack

- **React 18.3** - Latest React with hooks and concurrent features
- **Vite 5.1** - Next-generation frontend tooling
- **TypeScript 5.3** - Type-safe development
- **Tailwind CSS 3.4** - Utility-first CSS framework
- **React Router 6.22** - Client-side routing
- **Recharts 2.12** - Composable charting library
- **Zustand 4.5** - Lightweight state management
- **Lucide React** - Beautiful icon library
- **Framer Motion 11** - Production-ready animation library

## Installation

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

## Project Structure

```
order-flow-pro/
├── src/
│   ├── components/         # Reusable UI components
│   │   ├── Button.tsx
│   │   ├── Panel.tsx
│   │   ├── Section.tsx
│   │   ├── Metric.tsx
│   │   ├── KeyValue.tsx
│   │   └── OrderRow.tsx
│   ├── pages/             # Route pages
│   │   ├── HomePage.tsx   # Landing page
│   │   ├── MBOPage.tsx    # Market By Order
│   │   ├── HFTPage.tsx    # High-Frequency Trading
│   │   └── MLModelsPage.tsx # ML Models Dashboard
│   ├── ml-models/         # ML model implementations
│   │   └── registry.ts    # Model registry and configs
│   ├── hooks/             # Custom React hooks
│   │   └── useSyntheticFeed.ts
│   ├── types/             # TypeScript type definitions
│   │   └── index.ts
│   ├── utils/             # Utility functions
│   │   └── index.ts
│   ├── App.tsx           # Main app with routing
│   ├── main.tsx          # Entry point
│   └── index.css         # Global styles
├── index.html
├── package.json
├── tsconfig.json
├── vite.config.ts
├── tailwind.config.js
└── README.md
```

## Development Guide

### Adding a New ML Model

1. Create model function in `src/ml-models/registry.ts`:
```typescript
export const myNewModel: ModelFn = async (input: MLInput): Promise<MLOutput> => {
  // Your model logic here
  return { prediction: 42 };
};
```

2. Add model configuration:
```typescript
export const modelConfigs: Record<string, MLModelConfig> = {
  myModel: {
    id: "myModel",
    name: "My New Model",
    description: "What it does",
    category: "optimization",
    inputs: [/* ... */],
    outputLabels: {/* ... */},
    // ...
  }
};
```

3. Register in `ModelRegistry`:
```typescript
export const ModelRegistry: Record<string, ModelFn> = {
  myModel: myNewModel,
  // ...
};
```

### Connecting Real Data

Replace the synthetic feed in `src/hooks/useSyntheticFeed.ts` with your exchange WebSocket adapter:

```typescript
// Example WebSocket integration
export function useRealFeed(symbol: string) {
  const [update, setUpdate] = useState<MBOUpdate | null>(null);

  useEffect(() => {
    const ws = new WebSocket(`wss://your-exchange.com/orderbook/${symbol}`);

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      setUpdate({
        side: data.side,
        price: data.price,
        size: data.size,
        aggressive: data.aggressive,
      });
    };

    return () => ws.close();
  }, [symbol]);

  return { update };
}
```

### Custom Trading Strategies

Add new strategies in `src/pages/HFTPage.tsx`:

```typescript
const STRATEGIES: StrategyConfig[] = [
  {
    id: "myStrategy",
    name: "My Custom Strategy",
    description: "Strategy description",
    enabled: false,
  },
  // ...
];

// Add logic in generateSignal() function
case "myStrategy": {
  // Your strategy logic
  if (condition) {
    return { ts: Date.now(), kind: "enter-long", reason: "..." };
  }
  break;
}
```

## Performance Optimization

- **Code splitting** with React.lazy() for large pages
- **Memoization** with useMemo/useCallback for expensive calculations
- **Virtual scrolling** for large order book displays
- **Debounced inputs** for real-time updates
- **Web Workers** for heavy computations (optional)

## Deployment

### Build for Production
```bash
npm run build
```

The optimized build will be in the `dist/` directory.

### Deploy to Vercel
```bash
npm i -g vercel
vercel --prod
```

### Deploy to Netlify
```bash
npm run build
netlify deploy --prod --dir=dist
```

### Docker Deployment
```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm run build
CMD ["npm", "run", "preview"]
```

## Environment Variables

Create a `.env` file:

```bash
VITE_API_URL=https://api.your-exchange.com
VITE_WS_URL=wss://ws.your-exchange.com
VITE_ML_API_URL=https://ml-api.your-service.com
```

Access in code:
```typescript
const apiUrl = import.meta.env.VITE_API_URL;
```

## Testing

```bash
# Run tests (after setting up Vitest)
npm test

# Run with coverage
npm run test:coverage
```

## License

MIT License - feel free to use this in your projects!

## Contributing

Contributions are welcome! Please:
1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## Support

For issues and questions:
- Open an issue on GitHub
- Check existing documentation
- Review the code examples

---

Built using React + Vite
