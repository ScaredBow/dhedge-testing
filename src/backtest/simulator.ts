import fs from 'fs';
import path from 'path';
import { evaluateSignal, Bar } from '../signals/strategy';
import { checkStopLoss, checkTakeProfit, Position } from '../risk/index';
import { logger } from '../infra/logger';

interface BacktestResult {
  trades: Array<{ entryTime: number; exitTime: number; entryPrice: number; exitPrice: number; profit: number }>;
  equityCurve: Array<{ time: number; equity: number }>;
  summary: any;
}

export function loadCsv(filePath: string): Bar[] {
  const data = fs.readFileSync(filePath, 'utf8').trim().split(/\r?\n/);
  const bars: Bar[] = [];
  for (const line of data.slice(1)) {
    const [time, open, high, low, close] = line.split(',').map(x => parseFloat(x));
    bars.push({ time, open, high, low, close });
  }
  return bars;
}

export function runBacktest(bars: Bar[], initialCapital = 10000): BacktestResult {
  let capital = initialCapital;
  let equity = initialCapital;
  let position: Position | null = null;
  const trades: BacktestResult['trades'] = [];
  const equityCurve: BacktestResult['equityCurve'] = [];
  let consecutiveInvalid = 0;

  // Iterate over each bar. The indicator functions handle short histories gracefully by using
  // whatever data is available (e.g. ema on fewer than 200 points).  A minimum lookback
  // requirement is therefore not enforced here; you may want to adjust this in production.
  for (let i = 0; i < bars.length; i++) {
    const subBars = bars.slice(0, i + 1);
    const { shouldShort, stopLoss, takeProfit } = evaluateSignal(subBars);
    const currentPrice = bars[i].close;
    const currentTime = bars[i].time;

    if (position) {
      // monitor exit
      if (checkStopLoss(position, currentPrice) || checkTakeProfit(position, currentPrice)) {
        const profit = position.size * (position.entryPrice - currentPrice);
        capital += profit;
        trades.push({ entryTime: position.openedAt, exitTime: currentTime, entryPrice: position.entryPrice, exitPrice: currentPrice, profit });
        position = null;
        consecutiveInvalid = 0;
      } else {
        consecutiveInvalid += shouldShort ? 0 : 1;
        if (consecutiveInvalid >= 6) {
          // time exit
          const profit = position.size * (position.entryPrice - currentPrice);
          capital += profit;
          trades.push({ entryTime: position.openedAt, exitTime: currentTime, entryPrice: position.entryPrice, exitPrice: currentPrice, profit });
          position = null;
          consecutiveInvalid = 0;
        }
      }
    } else {
      // no position, check entry
      if (shouldShort) {
        const riskPerTrade = capital * 0.01; // 1% risk
        const stopDistance = stopLoss - currentPrice;
        const positionSize = Math.min((riskPerTrade / stopDistance), capital * 0.3 / currentPrice); // limit to 30% capital
        position = {
          entryPrice: currentPrice,
          size: positionSize,
          stopLoss,
          takeProfit,
          openedAt: currentTime
        };
        consecutiveInvalid = 0;
      }
    }
    equity = capital + (position ? position.size * (position.entryPrice - currentPrice) : 0);
    equityCurve.push({ time: currentTime, equity });
  }

  // compute summary metrics (simplified)
  const pnl = capital - initialCapital;
  const returns = pnl / initialCapital;
  const winTrades = trades.filter(t => t.profit > 0).length;
  const lossTrades = trades.filter(t => t.profit <= 0).length;
  const winRate = trades.length > 0 ? winTrades / trades.length : 0;
  const avgWin = winTrades > 0 ? trades.filter(t => t.profit > 0).reduce((a, t) => a + t.profit, 0) / winTrades : 0;
  const avgLoss = lossTrades > 0 ? trades.filter(t => t.profit <= 0).reduce((a, t) => a + t.profit, 0) / lossTrades : 0;

  return {
    trades,
    equityCurve,
    summary: { pnl, returns, winRate, avgWin, avgLoss, trades: trades.length }
  };
}
