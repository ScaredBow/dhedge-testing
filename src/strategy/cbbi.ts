import { logger } from '../infra/logger';

export type Regime = 'ACCUMULATION' | 'NORMAL' | 'AGGRESSIVE' | 'BEAR' | 'CASH';

export interface TargetWeights {
  bull2x: number;
  bull3x: number;
  bear1x: number;
  usdc: number;
  spot: number;
}

export async function fetchCbbiConfidence(): Promise<number> {
  const res = await fetch('https://colintalkscrypto.com/cbbi/data/latest.json');
  if (!res.ok) {
    throw new Error(`Failed to fetch CBBI: ${res.status} ${res.statusText}`);
  }
  const data = await res.json();
  if (!data.Confidence) {
    throw new Error('Malformed CBBI response: missing Confidence field');
  }
  const confidenceEntries = Object.entries(data.Confidence) as Array<[string, number]>;
  if (confidenceEntries.length === 0) {
    throw new Error('Malformed CBBI response: Confidence is empty');
  }
  const [latestTimestamp, latestConf] = confidenceEntries.reduce((a, b) => (Number(b[0]) > Number(a[0]) ? b : a));
  logger.debug(`Latest CBBI timestamp ${latestTimestamp}, confidence ${latestConf}`);
  return latestConf;
}

export function getRegime(confidence: number): Regime {
  // Tuned on 2023-2025 history to step down risk earlier when confidence rises
  // toward cycle tops while still allowing upside capture in mid-cycle.
  if (confidence < 0.25) return 'ACCUMULATION';
  if (confidence < 0.55) return 'NORMAL';
  if (confidence < 0.72) return 'AGGRESSIVE';
  if (confidence < 0.82) return 'CASH';
  return 'BEAR';
}

export function getTargetWeights(regime: Regime): TargetWeights {
  switch (regime) {
    case 'ACCUMULATION':
      return { bull2x: 0.0, bull3x: 0.0, bear1x: 0.0, usdc: 0.30, spot: 0.70 };
    case 'NORMAL':
      return { bull2x: 0.25, bull3x: 0.15, bear1x: 0.0, usdc: 0.35, spot: 0.25 };
    case 'AGGRESSIVE':
      return { bull2x: 0.35, bull3x: 0.45, bear1x: 0.0, usdc: 0.10, spot: 0.10 };
    case 'BEAR':
      return { bull2x: 0.0, bull3x: 0.0, bear1x: 0.60, usdc: 0.35, spot: 0.05 };
    case 'CASH':
    default:
      return { bull2x: 0.0, bull3x: 0.0, bear1x: 0.0, usdc: 0.90, spot: 0.10 };
  }
}
