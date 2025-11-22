import * as dotenv from 'dotenv';
import { z } from 'zod';

// Load environment variables from a .env file.  The user should create a `.env` file
// alongside this script defining all of the variables below.  See the README
// section at the bottom of cbbiTradingBot.ts for details.
dotenv.config();

// Define a schema for the environment.  Zod will throw a run‑time error if any
// required variable is missing.  Feel free to extend this schema with
// additional settings (e.g. rebalancing frequency) as your strategy evolves.
const CbbiEnvSchema = z.object({
  // RPC provider for the Arbitrum network.  Use a low‑latency provider such as
  // Infura or Alchemy.  Example: `https://arb1.arbitrum.io/rpc`.
  RPC_URL_ARBITRUM: z.string().url(),

  // Private key for the manager’s wallet.  This key must control the dHEDGE
  // vault and will be used to sign transactions on Arbitrum.  **Never** commit
  // the actual private key to source control – load it from the `.env` file.
  WALLET_PRIVATE_KEY: z.string().min(64),

  // dHEDGE identifiers.  The manager ID and vault ID can be found on the
  // dHEDGE web interface for the fund you intend to manage.
  DHH_VAULT_ID: z.string(),
  DHH_MANAGER_ID: z.string(),

  // Token addresses on Arbitrum.  These must be the ERC‑20 contract
  // addresses for the Toros vaults you wish to trade.  You can obtain them
  // from the Toros UI or on a block explorer.  Use checksummed addresses.
  BULL2X_TOKEN: z.string(),
  BULL3X_TOKEN: z.string(),
  BEAR1X_TOKEN: z.string(),
  USDC_TOKEN: z.string(),

  // Optional slippage setting in basis points (1/100th of a percent).  If
  // provided, trades will attempt to limit price impact accordingly.  A
  // default slippage of 50 bps (0.50%) is used if unspecified.
  SLIPPAGE_BPS: z.string().optional(),

  // Optional management and performance fee configuration.  These values are
  // purely informational in this bot; actual fee processing is handled by
  // dHEDGE’s vault smart contracts.  Specify annual management fee (as
  // decimal) and performance fee (as decimal) if you want the bot to
  // incorporate them into its position sizing calculations.
  MANAGEMENT_FEE: z.string().optional(),
  PERFORMANCE_FEE: z.string().optional()
});

// Parse and export the environment variables.  This will throw if any
// required variable is missing or malformed.
const env = CbbiEnvSchema.parse(process.env);

export default env;