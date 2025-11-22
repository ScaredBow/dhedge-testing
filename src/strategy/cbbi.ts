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
  if (confidence < 0.20) return 'ACCUMULATION';
  if (confidence < 0.60) return 'NORMAL';
  if (confidence < 0.80) return 'AGGRESSIVE';
  if (confidence < 0.90) return 'CASH';
  return 'BEAR';
}

export function getTargetWeights(regime: Regime): TargetWeights {
  switch (regime) {
    case 'ACCUMULATION':
      return { bull2x: 0.0, bull3x: 0.0, bear1x: 0.0, usdc: 0.4, spot: 0.6 };
    case 'NORMAL':
      return { bull2x: 0.4, bull3x: 0.2, bear1x: 0.0, usdc: 0.4, spot: 0.0 };
    case 'AGGRESSIVE':
      return { bull2x: 0.4, bull3x: 0.6, bear1x: 0.0, usdc: 0.0, spot: 0.0 };
    case 'BEAR':
      return { bull2x: 0.0, bull3x: 0.0, bear1x: 0.5, usdc: 0.5, spot: 0.0 };
    case 'CASH':
    default:
      return { bull2x: 0.0, bull3x: 0.0, bear1x: 0.0, usdc: 1.0, spot: 0.0 };
  }
}
