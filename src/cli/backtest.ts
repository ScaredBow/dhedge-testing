import fs from 'fs';
import path from 'path';
import { loadCsv, runBacktest } from '../backtest/simulator';
import { logger } from '../infra/logger';

export async function run(filePath: string, outputDir: string): Promise<void> {
  const bars = loadCsv(filePath);
  const result = runBacktest(bars);
  // ensure output directory exists
  fs.mkdirSync(outputDir, { recursive: true });
  fs.writeFileSync(path.join(outputDir, 'trades.csv'),
    'entryTime,exitTime,entryPrice,exitPrice,profit\n' +
    result.trades.map(t => `${t.entryTime},${t.exitTime},${t.entryPrice},${t.exitPrice},${t.profit}`).join('\n'));
  fs.writeFileSync(path.join(outputDir, 'equity_curve.csv'),
    'time,equity\n' + result.equityCurve.map(p => `${p.time},${p.equity}`).join('\n'));
  fs.writeFileSync(path.join(outputDir, 'summary.json'), JSON.stringify(result.summary, null, 2));
  logger.info('Backtest completed. Results saved to ' + outputDir);
}
