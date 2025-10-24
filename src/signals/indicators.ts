// Basic indicator implementations. Real implementation should use a library like talib-lite.
export function ema(data: number[], period: number): number {
  const k = 2 / (period + 1);
  let emaPrev = data[0];
  for (let i = 1; i < data.length; i++) {
    emaPrev = data[i] * k + emaPrev * (1 - k);
  }
  return emaPrev;
}

export function rsi(data: number[], period: number): number {
  let gains = 0;
  let losses = 0;
  for (let i = data.length - period; i < data.length - 1; i++) {
    const diff = data[i + 1] - data[i];
    if (diff > 0) gains += diff; else losses -= diff;
  }
  const avgGain = gains / period;
  const avgLoss = losses / period;
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - (100 / (1 + rs));
}

export function atr(highs: number[], lows: number[], closes: number[], period: number): number {
  const trs: number[] = [];
  for (let i = 1; i < highs.length; i++) {
    const high = highs[i];
    const low = lows[i];
    const prevClose = closes[i - 1];
    const tr = Math.max(high - low, Math.abs(high - prevClose), Math.abs(low - prevClose));
    trs.push(tr);
  }
  const recentTrs = trs.slice(-period);
  const sum = recentTrs.reduce((a, b) => a + b, 0);
  return sum / period;
}

/**
 * Compute the Donchian channel low (period lookback) excluding the current bar.
 *
 * Many trading systems define the Donchian low as the lowest low over the previous `period`
 * bars, not including the most recent bar.  This prevents a breakout from being
 * immediately invalidated by using the current low itself.  When fewer than
 * `period` past values are available, the function returns the minimum of all but the
 * latest low.
 */
export function donchianLow(lows: number[], period: number): number {
  if (lows.length <= 1) return lows[0] ?? 0;
  // Exclude the most recent low when computing the window
  const sliceStart = Math.max(0, lows.length - period - 1);
  const sliceEnd = lows.length - 1;
  const window = lows.slice(sliceStart, sliceEnd);
  return Math.min(...window);
}
