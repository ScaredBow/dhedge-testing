import * as dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const EnvSchema = z.object({
  RPC_URL_POLYGON: z.string().url(),
  WALLET_PRIVATE_KEY: z.string(),
  DHH_VAULT_ID: z.string(),
  DHH_MANAGER_ID: z.string(),
  ORACLE_FEED: z.string(),
  SLIPPAGE_BPS: z.string().optional(),
  FEE_BPS: z.string().optional()
});

const env = EnvSchema.parse(process.env);

export default env;
