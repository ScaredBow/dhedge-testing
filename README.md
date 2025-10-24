# dhedge‑eth‑short‑bot

This repository contains a TypeScript implementation of a short‑bias algorithmic trading bot for the dHEDGE protocol on the Polygon network.  The bot follows a hybrid regime, momentum and volatility strategy on 15‑minute ETH/USDC bars.  It uses Chainlink oracles with a DEX fallback for pricing, monitors risk with ATR‑based stops and take profits, and manages position sizing with both leverage and max risk constraints.

## Features

- **Strategy**: Enter a short ETH/USDC position when price is below its long‑term 200‑period EMA on both 15‑minute and hourly charts, the 20‑EMA is below the 50‑EMA, the RSI is below 45, and price breaks below the 20‑bar Donchian low minus 0.25×ATR.  Exit via stop loss, take profit or after six bars when signals are invalidated.
- **Position sizing**: Risk up to 1% of capital per trade while committing no more than 30% of capital, with optional leverage up to 3× through dHEDGE.
- **Backtester**: A simple simulator that reproduces the strategy on historical 15‑minute OHLCV data, accounting for slippage and fees.  Outputs trades, equity curve and summary statistics.
- **Environment configuration**: All network and vault settings are defined via environment variables.  An example file is provided in `.env.example`.
- **CLI**: Commands are available to run backtests and, in future work, to trade live or in paper mode.

## Quick start

1. **Clone this repository** (or copy the contents into your own private repo).
2. **Install dependencies** (internet access required):

   ```sh
   npm install
   ```

   If package installation fails due to network restrictions, ensure that you have access to npm registries or install the required packages manually.

3. **Configure environment variables**:

   - Copy `.env.example` to `.env` and fill in the values for your Polygon RPC provider, wallet private key, dHEDGE vault and manager IDs, and oracle feed.
   - These variables are loaded automatically at runtime via [`dotenv`](https://www.npmjs.com/package/dotenv).

4. **Run a backtest**:

   Prepare a CSV file containing 15‑minute ETH/USDC OHLCV data in the format:

   ```csv
   time,open,high,low,close
   1630454400,3400,3420,3380,3405
   1630455300,3405,3410,3385,3390
   ...
   ```

   Then execute the backtester via the CLI:

   ```sh
   npm run backtest -- path/to/eth_usdc_15m.csv output_directory
   ```

   The command writes `trades.csv`, `equity_curve.csv` and `summary.json` into the specified output directory.

## Repository layout

```
dhedge-eth-short-bot/
├── src/
│   ├── backtest/       # Backtesting simulator
│   ├── cli/            # Command-line interface entry points
│   ├── config/         # Environment variable schema
│   ├── data/           # Price adapters (oracle + DEX)
│   ├── dh/             # dHEDGE vault interaction
│   ├── execution/      # Order sizing and execution functions
│   ├── infra/          # Logging and infrastructure helpers
│   ├── risk/           # Risk management functions
│   └── signals/        # Indicator calculations and signal evaluation
├── .env.example        # Template for environment variables
├── package.json        # Node.js project metadata and scripts
├── tsconfig.json       # TypeScript compiler configuration
└── README.md           # Project overview and instructions (this file)
```

## GitHub Actions

Example CI workflows are provided in `.github/workflows/`:

- **ci.yml** performs a basic build and lints the codebase on every push.
- **backtest.yml** can be scheduled to run nightly backtests.  It installs dependencies, executes the CLI backtest command on a sample dataset, and uploads the resulting artifacts.

To enable these workflows, make sure the necessary secrets (e.g. RPC URL, private key and dHEDGE vault IDs) are stored in the repository’s GitHub secrets.  See the workflow files for the names of the required secrets.

## Disclaimer

This code is provided for educational and informational purposes only.  Trading cryptocurrencies carries significant financial risk, and past performance is not indicative of future results.  You are solely responsible for your own trades and should seek professional advice before deploying any trading strategy live.