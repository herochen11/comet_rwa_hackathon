# Compound Comet

## Getting started

1. Clone the repo
2. Run `yarn install`
3. Setting up .env
4. Build `yarn build`
4. Deploy `yarn hardhat deploy --network sepolia --deployment RWA`

## Setting Up Custom Token Pools

You can deploy your own Comet lending pool with custom base assets and collateral tokens.

### Goal

Create a lending pool where:
- Users can supply your custom ERC-20 token to earn interest
- Users can borrow your custom token using other assets as collateral
- You control which tokens are accepted as collateral
- You set interest rates, collateral factors, and liquidation parameters

### Quick Start Commands

```bash
# 1. Create deployment directory
mkdir -p deployments/sepolia/your-pool-name

# 2. Create configuration and deployment script
# See CUSTOM_TOKEN_GUIDE.md for configuration details

# 3. Test deployment (no gas cost)
yarn hardhat deploy --network sepolia --deployment your-pool-name --simulate

# 4. Deploy to testnet
yarn hardhat deploy --network sepolia --deployment your-pool-name

# 5. Verify contracts on Etherscan
yarn hardhat deploy --network sepolia --deployment your-pool-name --no-deploy

# 6. Discover all deployed contracts
npx hardhat spider --network sepolia --deployment your-pool-name

# 7. Test your deployment
npx hardhat scenario --bases sepolia-your-pool-name
```

### Key Configuration Parameters

When setting up your custom pool, you'll configure:

**Base Asset:**
- Token address and price feed
- Minimum borrow amount
- Target reserves

**Collateral Assets:**
- Up to 15 different collateral tokens
- Borrow collateral factor (how much users can borrow against collateral)
- Liquidation threshold and penalties
- Supply caps for each asset

**Interest Rates:**
- Supply and borrow rate curves
- Kink utilization point (typically 80-90%)
- Base rates and slope rates

**Rewards:**
- Reward token distribution speeds
- Minimum balance for rewards

### Example: Deploy USDC Pool on Sepolia

```bash
# Prerequisites: Set up .env file with ETHERSCAN_KEY, INFURA_KEY, and ETH_PK

# Deploy the standard USDC pool
yarn hardhat deploy --network sepolia --deployment usdc

# View deployed addresses
cat deployments/sepolia/usdc/roots.json
```

## Env variables

The following env variables are used in the repo. One way to set up these env
variables is to create a `.env` in the root directory of this repo.

Required env variables:

```
ETHERSCAN_KEY=<key>
INFURA_KEY=<key>
```

Optional env variables:

```
SNOWTRACE_KEY=<key>
COINMARKETCAP_API_KEY=<key>
REPORT_GAS=true
ETH_PK=<eth-key>             # takes precedence over MNEMONIC
MNEMONIC=<mnemonic>
```

## Comet protocol contracts

**[Comet.sol](https://github.com/compound-finance/comet/blob/main/contracts/Comet.sol)** - Contract that inherits `CometMainInterface.sol` and is the implementation for most of Comet's core functionalities. A small set of functions that do not fit within this contract are implemented in `CometExt.sol` instead, which Comet `DELEGATECALL`s to for unrecognized function signatures.

**[CometExt.sol](https://github.com/compound-finance/comet/blob/main/contracts/CometExt.sol)** - Contract that inherits `CometExtInterface.sol` and is the implementation for extra functions that do not fit within `Comet.sol`, such as `approve`.

**[CometInterface.sol](https://github.com/compound-finance/comet/blob/main/contracts/CometInterface.sol)** - Abstract contract that inherits `CometMainInterface.sol` and `CometExtInterface.sol`. This interface contains all the functions and events for `Comet.sol` and `CometExt.sol` and is ERC-20 compatible.

**[CometMainInterface.sol](https://github.com/compound-finance/comet/blob/main/contracts/CometMainInterface.sol)** - Abstract contract that inherits `CometCore.sol` and contains all the functions and events for `Comet.sol`.

**[CometExtInterface.sol](https://github.com/compound-finance/comet/blob/main/contracts/CometExtInterface.sol)** - Abstract contract that inherits `CometCore.sol` and contains all the functions and events for `CometExt.sol`.

**[CometCore.sol](https://github.com/compound-finance/comet/blob/main/contracts/CometCore.sol)** - Abstract contract that inherits `CometStorage.sol`, `CometConfiguration.sol`, and `CometMath.sol`. This contracts contains functions and constants that are shared between `Comet.sol` and `CometExt.sol`.

**[CometStorage.sol](https://github.com/compound-finance/comet/blob/main/contracts/CometStorage.sol)** - Contract that defines the storage variables used for the Comet protocol.

**[CometConfiguration.sol](https://github.com/compound-finance/comet/blob/main/contracts/CometConfiguration.sol)** - Contract that defines the configuration structs passed into the constructors for `Comet.sol` and `CometExt.sol`.

**[CometMath.sol](https://github.com/compound-finance/comet/blob/main/contracts/CometMath.sol)** - Contract that defines math functions that are used throughout the Comet codebase.

**[CometFactory.sol](https://github.com/compound-finance/comet/blob/main/contracts/CometFactory.sol)** - Contract that inherits `CometConfiguration.sol` and is used to deploy new versions of `Comet.sol`. This contract will mainly be called by the Configurator during the governance upgrade process.

## Configurator contracts

**[Configurator.sol](https://github.com/compound-finance/comet/blob/main/contracts/Configurator.sol)** - Contract that inherits `ConfiguratorStorage.sol`. This contract manages Comet's configurations and deploys new implementations of Comet.

**[ConfiguratorStorage.sol](https://github.com/compound-finance/comet/blob/main/contracts/ConfiguratorStorage.sol)** - Contract that inherits `CometConfiguration.sol` and defines the storage variables for `Configurator.sol`.

## Supplementary contracts

**[Bulker.sol](https://github.com/compound-finance/comet/blob/main/contracts/Bulker.sol)** - Contract that allows multiple Comet functions to be called in a single transaction.

**[CometRewards.sol](https://github.com/compound-finance/comet/blob/main/contracts/CometRewards.sol)** - Contract that allows Comet users to claim rewards based on their protocol participation.


### Build contracts

Compiles contracts.

`yarn build`

### Run tests

Runs all tests in the `test` directory.

`yarn test`

