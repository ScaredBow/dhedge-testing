import { ema, rsi, atr, donchianLow } from './indicators';

export interface Bar {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
}

export interface SignalResult {
  shouldShort: boolean;
  stopLoss: number;
  takeProfit: number;
}

// Evaluate signals on a series of bars. Only the latest bars are used for calculations.
export function evaluateSignal(bars: Bar[]): SignalResult {
  const closes = bars.map(b => b.close);
  const highs = bars.map(b => b.high);
  const lows = bars.map(b => b.low);

  const emaShort = ema(closes.slice(-20), 20);
  const emaLong = ema(closes.slice(-50), 50);
  const rsiVal = rsi(closes, 14);
  const atrVal = atr(highs, lows, closes, 14);
  const donLow = donchianLow(lows, 20);

  // Regime filter: price below 200-EMA on 15m and 1h (omitted here for brevity)
  const regimeOk = ema(closes.slice(-200), 200) > closes[closes.length - 1];

  const momentumOk = emaShort < emaLong && rsiVal < 45;
  const breakoutOk = closes[closes.length - 1] < donLow - 0.25 * atrVal;
  const shouldShort = regimeOk && momentumOk && breakoutOk;

  return {
    shouldShort,
    stopLoss: closes[closes.length - 1] + 2 * atrVal,
    takeProfit: closes[closes.length - 1] - 3 * atrVal
  };
}
