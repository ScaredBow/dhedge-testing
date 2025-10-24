#!/usr/bin/env node
import { run as runBacktest } from './backtest';

const [,, cmd, ...args] = process.argv;

(async () => {
  if (cmd === 'backtest') {
    const filePath = args[0];
    const outputDir = args[1] || './artifacts';
    await runBacktest(filePath, outputDir);
  } else {
    console.log('Usage: cli backtest <csvFile> <outputDir>');
  }
})();
