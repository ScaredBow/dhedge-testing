import env from './cbbiEnv';
import { logger } from './infra/logger';
import { ethers } from 'ethers';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { Dhedge } = require('@dhedge/v2-sdk');
import cron from 'node-cron';

/**
 * This script implements a simple automated trading bot for a dHEDGE vault on
 * Arbitrum.  It uses the ColinTalksCrypto Bitcoin Bull Run Index (CBBI) to
 * infer whether the market is in an early, mid or late cycle and rotates
 * between leveraged bull tokens (BULL2X and BULL3X), a bear token (BEAR1X)
 * and USD Coin (USDC) accordingly.  The logic is intentionally
 * conservative: it waits for clear trend confirmation before entering
 * aggressive exposure and retreats to cash during high‑risk regimes.
 *
 * IMPORTANT: The dHEDGE SDK is still evolving and the Toros leveraged
 * tokens may be volatile.  This script demonstrates how to fetch the
 * CBBI, determine a regime, and construct target weights.  The actual
 * trade execution via the dHEDGE SDK is left as a placeholder for you to
 * implement, as it will depend on your specific fund configuration and
 * execution preferences.
 */

// Initialise ethers provider and wallet for Arbitrum.  The private key
// authorises trades on behalf of the vault manager.
const provider = new ethers.JsonRpcProvider(env.RPC_URL_ARBITRUM);
const wallet = new ethers.Wallet(env.WALLET_PRIVATE_KEY, provider);

// Instantiate the dHEDGE SDK.  Network '42161' refers to Arbitrum One.  If
// the SDK API changes in future versions, adjust accordingly.
const dhedge = new Dhedge({
  provider,
  managerId: env.DHH_MANAGER_ID,
  vaultId: env.DHH_VAULT_ID,
  network: '42161',
});

// Helper to fetch the latest CBBI confidence value.  The JSON format
// contains a dictionary of timestamps to confidence values; we select
// the most recent entry.  Should the API schema change in the future,
// adjust this parser accordingly.
async function fetchCbbiConfidence(): Promise<number> {
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

/**
 * Determine the regime based on the CBBI confidence score.  You may wish to
 * adjust these thresholds based on your own research.  Lower confidence
 * values correspond to early cycle (accumulation), mid values to trending
 * bull markets, and high values indicate elevated risk of a cycle top.
 */
function getRegime(confidence: number): 'ACCUMULATION' | 'NORMAL' | 'AGGRESSIVE' | 'BEAR' | 'CASH' {
  if (confidence < 0.20) return 'ACCUMULATION';
  if (confidence < 0.60) return 'NORMAL';
  if (confidence < 0.80) return 'AGGRESSIVE';
  if (confidence < 0.90) return 'CASH';
  return 'BEAR';
}

/**
 * Map a regime into a set of target weights.  We express weights as
 * decimals summing to 1.0.  Example: { bull2x: 0.4, bull3x: 0.4, usdc: 0.2 }.
 * You can customise these allocations, add risk caps, or incorporate fee
 * considerations as required.  The weights here mirror the simple regime
 * described in the strategy discussion.
 */
function getTargetWeights(regime: ReturnType<typeof getRegime>): Record<string, number> {
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

/**
 * Place trades to rebalance the vault towards the target weights.  In a
 * production bot you would:
 *   1. Fetch current vault holdings via the dHEDGE SDK.
 *   2. Compare with target weights to derive buy/sell quantities.
 *   3. Call dHEDGE’s swap/allocate functions to execute trades.
 *   4. Log all transactions and handle errors gracefully.
 *
 * For demonstration, this function only logs the intended actions.  Replace
 * the TODO section with actual SDK calls when running on a real vault.
 */
async function rebalance(): Promise<void> {
  try {
    const confidence = await fetchCbbiConfidence();
    const regime = getRegime(confidence);
    const targetWeights = getTargetWeights(regime);
    logger.info(`CBBI=${confidence.toFixed(4)} → regime=${regime}`);
    logger.info(`Target weights: ${JSON.stringify(targetWeights)}`);

    // TODO: Fetch current holdings via dhedge.getVaultComposition() or similar.
    // const composition = await dhedge.getVaultComposition(env.DHH_VAULT_ID);
    // Determine differences between current and target allocations and execute trades.
    // Example pseudo‑code:
    // for (const asset of ['bull2x','bull3x','bear1x','usdc','spot']) {
    //   const currentWeight = composition[asset]?.weight ?? 0;
    //   const targetWeight = targetWeights[asset] ?? 0;
    //   if (targetWeight > currentWeight) {
    //     await dhedge.buyAsset(env[`${asset.toUpperCase()}_TOKEN`], targetWeight - currentWeight, { slippage: Number(env.SLIPPAGE_BPS ?? '50') });
    //   } else if (targetWeight < currentWeight) {
    //     await dhedge.sellAsset(env[`${asset.toUpperCase()}_TOKEN`], currentWeight - targetWeight, { slippage: Number(env.SLIPPAGE_BPS ?? '50') });
    //   }
    // }
    logger.info('Rebalance routine completed (simulation)');
  } catch (err) {
    logger.error({ err }, 'Rebalance failed');
  }
}

// Schedule the rebalance to run at the top of every hour.  Adjust the
// cron expression as needed.  See https://crontab.guru for syntax.
cron.schedule('0 * * * *', async () => {
  logger.info('Scheduled rebalance triggered');
  await rebalance();
});

// Immediately run the first rebalance on startup.
rebalance().catch(err => logger.error({ err }, 'Initial rebalance failed'));

/**
 * README
 * ======
 *
 * 1. Install dependencies:
 *    npm install
 *
 * 2. Create a `.env` file at the project root with the following keys:
 *
 *    RPC_URL_ARBITRUM=<your Arbitrum RPC URL>
 *    WALLET_PRIVATE_KEY=<private key of the dHEDGE vault manager>
 *    DHH_VAULT_ID=<vault ID of your dHEDGE fund>
 *    DHH_MANAGER_ID=<manager ID associated with the vault>
 *    BULL2X_TOKEN=<ERC‑20 address of Toros BTCBull2x on Arbitrum>
 *    BULL3X_TOKEN=<ERC‑20 address of Toros BTCBull3x on Arbitrum>
 *    BEAR1X_TOKEN=<ERC‑20 address of Toros BTCBear1x on Arbitrum>
 *    USDC_TOKEN=<ERC‑20 address of USDC on Arbitrum>
 *    SLIPPAGE_BPS=50 (optional, default 50)
 *    MANAGEMENT_FEE=0.02 (optional)
 *    PERFORMANCE_FEE=0.2 (optional)
 *
 *    Ensure that you never commit your private key or sensitive values to
 *    version control.
 *
 * 3. Compile the TypeScript:
 *    npm run build
 *
 * 4. Run the bot in paper trading mode by replacing the TODOs with
 *    console logs, or on mainnet once you are confident in its behaviour.
 *
 * DISCLAIMER: This code is provided for educational purposes only.  Trading
 * cryptocurrencies, especially leveraged tokens, involves significant risk.
 * Use at your own risk and consider consulting a qualified financial
 * professional before deploying live capital.
 */