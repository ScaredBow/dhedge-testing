# Deploying the CBBI bot to dHEDGE (Arbitrum)

This walkthrough explains how to configure the CBBI-driven rotation bot to trade a dHEDGE v2 vault on Arbitrum using Toros leveraged tokens.

## Prerequisites
- Node.js 18+ and npm
- An Arbitrum RPC URL (Alchemy/Infura or a low-latency alternative)
- Manager wallet private key that controls your dHEDGE vault
- The vault ID and manager ID from the dHEDGE app
- ERC-20 addresses for BULL2X, BULL3X, BEAR1X, USDC, and (optionally) a spot BTC token (e.g., WBTC or BTC.b)

## 1) Install dependencies
```sh
npm install
```

## 2) Configure environment
Copy `.env.example` to `.env` and fill in the values for your vault and tokens:
```sh
cp .env.example .env
# then edit .env
```
Key variables:
- `RPC_URL_ARBITRUM` – Arbitrum RPC endpoint
- `WALLET_PRIVATE_KEY` – vault manager key (keep this secret)
- `DHH_VAULT_ID` / `DHH_MANAGER_ID` – identifiers from dHEDGE UI
- `BULL2X_TOKEN`, `BULL3X_TOKEN`, `BEAR1X_TOKEN`, `USDC_TOKEN`, `SPOT_TOKEN` – checksummed ERC-20 addresses
- `SLIPPAGE_BPS` (optional) – max slippage per trade in basis points

## 3) Validate connectivity
Before automating, confirm the SDK can read the vault:
```sh
node -e "const { Dhedge } = require('@dhedge/v2-sdk'); const { ethers } = require('ethers'); require('dotenv').config(); const dh = new Dhedge({ provider: new ethers.JsonRpcProvider(process.env.RPC_URL_ARBITRUM), managerId: process.env.DHH_MANAGER_ID, vaultId: process.env.DHH_VAULT_ID, network: '42161' }); dh.getVaultComposition(process.env.DHH_VAULT_ID).then(console.log).catch(console.error);"
```
If this fails, recheck RPC URL, vault/manager IDs, and that the wallet is authorised for the vault.

## 4) Run the backtest
Confirm the strategy logic with historical data:
```sh
npm run cbbi-backtest
```
Results are written to `artifacts/cbbi_backtest.csv`.

## 5) Paper-trade the bot loop
The CLI will fetch the latest CBBI value, derive a regime, and log intended trades every hour. Run it with your `.env` loaded:
```sh
npm run cbbi-bot
```
You should see the current regime and target weights; this is a safe dry run until you wire execution.

## 6) Wire live execution
Replace the `TODO` block in `src/cli/cbbiTradingBot.ts` with actual SDK calls, for example:
1. Call `dhedge.getVaultComposition(vaultId)` to read current holdings and weights.
2. Compare current weights to `getTargetWeights(regime)` to compute desired deltas.
3. Use `dhedge.buyAsset(tokenAddress, weightDelta, { slippage })` and `dhedge.sellAsset(...)` for the Toros tokens and USDC.
4. Add error handling and logging around each transaction. Consider rate limits and gas budgeting on Arbitrum.

## 7) Production hygiene
- Protect the manager key (use environment secrets in CI or a deployment service like PM2 on a locked-down host).
- Monitor logs and balance changes; start with minimal size while validating behaviour.
- Test slippage assumptions on-chain with small transactions before scaling up.

## Useful scripts
- `npm run cbbi-backtest` – regenerate performance stats
- `npm run cbbi-bot` – run the hourly CBBI rebalance loop (currently logs intended actions)

## Troubleshooting
- **Vault composition call fails:** verify vault/manager IDs and that the manager key matches the vault.
- **Incorrect token decimals:** ensure the Toros token addresses are correct on Arbitrum.
- **RPC timeouts:** switch to a faster RPC provider or reduce call frequency.

Refer to the inline README block at the bottom of `src/cli/cbbiTradingBot.ts` for environment keys and safety notes.
