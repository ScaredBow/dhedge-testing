import fs from 'fs';
import path from 'path';
import { logger } from '../infra/logger';
import { getRegime, getTargetWeights, Regime, TargetWeights } from '../strategy/cbbi';

interface BtcPricePoint {
  date: string;
  price: number;
}

interface CbbiPoint {
  date: string;
  confidence: number;
}

interface BacktestRow extends BtcPricePoint, CbbiPoint {
  dailyReturn: number;
  portfolioReturn: number;
  equity: number;
  regime: Regime;
  weights: TargetWeights;
}

async function fetchCbbiHistory(): Promise<CbbiPoint[]> {
  const fileText = fs.readFileSync('latest.rtf', 'utf8').replace(/\n/g, '');
  const match = fileText.match(/"Confidence":\\\{([^}]*)\\\}/);
  if (!match) {
    throw new Error('Unable to locate CBBI confidence data in latest.rtf');
  }
  const entries = Array.from(match[1].matchAll(/"(\d+)":([0-9.]+)/g)) as Array<RegExpMatchArray>;
  return entries.map(([, timestamp, confidence]) => ({
    date: new Date(Number(timestamp) * 1000).toISOString().slice(0, 10),
    confidence: Number(confidence)
  }));
}

async function fetchBtcHistory(): Promise<BtcPricePoint[]> {
  const filePath = path.join('data', 'btc_coinmetrics.csv');
  const csv = fs.readFileSync(filePath, 'utf8');
  const [header, ...rows] = csv.trim().split(/\r?\n/);
  const headers = header.split(',');
  const dateIdx = headers.indexOf('time');
  const priceIdx = headers.indexOf('PriceUSD');
  if (dateIdx === -1 || priceIdx === -1) {
    throw new Error('btc_coinmetrics.csv is missing required columns time or PriceUSD');
  }
  return rows.map(line => {
    const cols = line.split(',');
    return {
      date: cols[dateIdx],
      price: parseFloat(cols[priceIdx])
    };
  }).filter(point => Number.isFinite(point.price));
}

function alignSeries(cbbi: CbbiPoint[], btc: BtcPricePoint[]): Array<BtcPricePoint & CbbiPoint> {
  const cbbiByDate = new Map(cbbi.map(point => [point.date, point.confidence] as const));
  return btc
    .filter(point => cbbiByDate.has(point.date))
    .map(point => ({ date: point.date, price: point.price, confidence: cbbiByDate.get(point.date)! }));
}

function simulate(series: Array<BtcPricePoint & CbbiPoint>, initialEquity = 10000): BacktestRow[] {
  if (series.length < 2) {
    throw new Error('Not enough overlapping data between BTC prices and CBBI history');
  }
  const rows: BacktestRow[] = [];
  let equity = initialEquity;
  for (let i = 1; i < series.length; i++) {
    const prev = series[i - 1];
    const curr = series[i];
    const dailyReturn = (curr.price - prev.price) / prev.price;
    const regime = getRegime(curr.confidence);
    const weights = getTargetWeights(regime);
    const portfolioReturn =
      weights.bull2x * (2 * dailyReturn) +
      weights.bull3x * (3 * dailyReturn) +
      weights.bear1x * (-dailyReturn) +
      weights.spot * dailyReturn;
    equity *= 1 + portfolioReturn;
    rows.push({
      date: curr.date,
      price: curr.price,
      confidence: curr.confidence,
      dailyReturn,
      portfolioReturn,
      equity,
      regime,
      weights
    });
  }
  return rows;
}

function summarise(rows: BacktestRow[], initialEquity: number) {
  const startDate = rows[0]?.date;
  const endDate = rows[rows.length - 1]?.date;
  const startEquity = initialEquity;
  const finalEquity = rows[rows.length - 1]?.equity ?? 0;
  const totalReturn = startEquity > 0 ? (finalEquity - startEquity) / startEquity : 0;
  const years = startDate && endDate
    ? (new Date(endDate).getTime() - new Date(startDate).getTime()) / (365.25 * 24 * 60 * 60 * 1000)
    : 0;
  const cagr = years > 0 ? Math.pow(finalEquity / startEquity, 1 / years) - 1 : 0;
  const maxDrawdown = rows.reduce((acc, row) => {
    acc.peak = Math.max(acc.peak, row.equity);
    acc.drawdown = Math.min(acc.drawdown, (row.equity - acc.peak) / acc.peak);
    return acc;
  }, { peak: startEquity, drawdown: 0 });

  const regimeCounts = rows.reduce<Record<Regime, number>>((acc, row) => {
    acc[row.regime] = (acc[row.regime] ?? 0) + 1;
    return acc;
  }, { ACCUMULATION: 0, NORMAL: 0, AGGRESSIVE: 0, BEAR: 0, CASH: 0 });

  return {
    startDate,
    endDate,
    startEquity,
    finalEquity,
    totalReturn,
    cagr,
    maxDrawdown: maxDrawdown.drawdown,
    regimeCounts
  };
}

function writeCsv(rows: BacktestRow[], outputPath: string) {
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  const header = 'date,btcPrice,cbbiConfidence,regime,dailyReturn,portfolioReturn,equity,bull2x,bull3x,bear1x,usdc,spot\n';
  const body = rows.map(row => [
    row.date,
    row.price.toFixed(2),
    row.confidence.toFixed(4),
    row.regime,
    row.dailyReturn.toFixed(6),
    row.portfolioReturn.toFixed(6),
    row.equity.toFixed(2),
    row.weights.bull2x.toFixed(3),
    row.weights.bull3x.toFixed(3),
    row.weights.bear1x.toFixed(3),
    row.weights.usdc.toFixed(3),
    row.weights.spot.toFixed(3)
  ].join(',')).join('\n');
  fs.writeFileSync(outputPath, header + body);
}

async function main() {
  logger.info('Fetching CBBI and BTC history…');
  const [cbbiHistory, btcHistory] = await Promise.all([fetchCbbiHistory(), fetchBtcHistory()]);
  const combined = alignSeries(cbbiHistory, btcHistory);
  logger.info(`Aligned ${combined.length} daily points with both CBBI and BTC prices.`);
  const initialEquity = 10000;
  const rows = simulate(combined, initialEquity);
  const summary = summarise(rows, initialEquity);
  const outputPath = path.join('artifacts', 'cbbi_backtest.csv');
  writeCsv(rows, outputPath);
  logger.info({ summary, outputPath }, 'CBBI regime backtest complete');
}

main().catch(err => {
  logger.error({ err }, 'CBBI backtest failed');
  process.exitCode = 1;
});
