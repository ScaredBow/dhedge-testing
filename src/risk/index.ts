import { logger } from '../infra/logger';

export interface Position {
  entryPrice: number;
  size: number;
  stopLoss: number;
  takeProfit: number;
  openedAt: number;
}

export function checkStopLoss(position: Position, currentPrice: number): boolean {
  if (currentPrice >= position.stopLoss) {
    logger.info('Stop loss triggered');
    return true;
  }
  return false;
}

export function checkTakeProfit(position: Position, currentPrice: number): boolean {
  if (currentPrice <= position.takeProfit) {
    logger.info('Take profit reached');
    return true;
  }
  return false;
}

export function checkTimeExit(position: Position, currentTime: number, barDurationMs: number, consecutiveInvalid: number): boolean {
  // Exit if conditions invalidated for consecutive checks
  return consecutiveInvalid >= 6;
}
