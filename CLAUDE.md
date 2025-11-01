# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Compound Comet is a DeFi lending protocol implemented in Solidity. It's a multi-chain protocol deployed across Ethereum mainnet, Arbitrum, Base, Optimism, Polygon, Scroll, Linea, Ronin, Unichain, Mantle, and various testnets. Each deployment can support different base assets (USDC, WETH, USDT, WBTC, etc.).

## Environment Setup

Required environment variables (create a `.env` file):
```
ETHERSCAN_KEY=<key>
INFURA_KEY=<key>
SNOWTRACE_KEY=<key>
ANKR_KEY=<key>
```

Optional environment variables:
```
COINMARKETCAP_API_KEY=<key>
REPORT_GAS=true
ETH_PK=<eth-key>
MNEMONIC=<mnemonic>
```

Enable git hooks: `git config core.hooksPath .githooks`

## Common Commands

### Building and Testing
- **Build contracts**: `yarn build`
- **Clean build artifacts**: `yarn clean`
- **Run all tests**: `yarn test`
- **Run specific test file**: `yarn hardhat test ./test/[filename].ts`
- **Run tests with coverage**: `yarn test:coverage`
- **Run tests with gas reporting**: `REPORT_GAS=true yarn test`

### Linting
- **Lint Solidity contracts**: `yarn lint-contracts`
- **Fix Solidity linting issues**: `yarn lint-contracts:fix`
- **Lint TypeScript**: `yarn lint`

### Forge (Foundry)
- **Run Forge tests**: `forge test`

### Deployment
- **Deploy to network**: `yarn hardhat deploy --network [network] --deployment [asset]`
  - Example: `yarn hardhat deploy --network mainnet --deployment usdc`
  - Use `--simulate` to test deployment without executing
  - Use `--no-deploy` to only verify existing contracts

### Scenarios
- **Run scenarios**: `npx hardhat scenario`
- **Run specific bases**: `npx hardhat scenario --bases development,sepolia,mainnet`
- **Run with spider**: `npx hardhat scenario --spider`
- **Change worker count**: `npx hardhat scenario --workers 4`

Scenarios test the protocol against high-level properties and are automatically run against all pending migrations.

### Spider
Spider crawls the blockchain to discover all protocol-related contracts starting from root addresses.

- **Run spider**: `npx hardhat spider --network mainnet --deployment usdc`
- **Clean spider artifacts**: `npx hardhat spider --clean`

Spider configuration is in `deployments/[network]/[deployment]/roots.json` and `relations.json`.

### Migrations
Migrations are used to propose changes to live protocol deployments via governance.

- **Generate migration**: `yarn hardhat gen:migration --network [network] --deployment [asset] [name]`
- **Prepare migration**: `yarn hardhat migrate --network [network] --deployment [asset] --prepare [migration]`
- **Enact migration**: `yarn hardhat migrate --network [network] --deployment [asset] --enact [migration]`
- **Simulate migration**: `yarn hardhat migrate --network [network] --deployment [asset] --prepare --simulate [migration]`

Migration artifacts are stored in `deployments/[network]/[deployment]/artifacts/`.

### Liquidation Bot
- **Run liquidation bot**: `LIQUIDATOR_ADDRESS="0x..." DEPLOYMENT="usdc" yarn liquidation-bot --network sepolia`

## Architecture

### Core Contract Hierarchy

The Comet protocol uses a split-implementation pattern with the main contract and extension:

1. **Comet.sol** - Main implementation inheriting CometMainInterface.sol. Contains core protocol logic (supply, withdraw, borrow, liquidate).

2. **CometExt.sol** - Extension implementation inheriting CometExtInterface.sol. Contains functions that don't fit in Comet.sol (like `approve`). The main Comet contract DELEGATECALLs to this for unrecognized function signatures.

3. **CometInterface.sol** - Complete interface combining CometMainInterface and CometExtInterface. ERC-20 compatible.

4. **CometCore.sol** - Base contract with shared functionality between Comet and CometExt. Inherits CometStorage, CometConfiguration, and CometMath.

5. **CometStorage.sol** - Defines all storage variables for the protocol.

6. **CometConfiguration.sol** - Defines configuration structs used in constructors.

7. **CometMath.sol** - Math utilities used throughout the protocol.

8. **CometFactory.sol** - Deploys new Comet implementations. Called by Configurator during upgrades.

### Governance and Configuration

- **Configurator.sol** - Manages Comet configurations and deploys new implementations. The protocol's central governance-controlled contract.

- **ConfiguratorStorage.sol** - Storage for Configurator, inherits CometConfiguration.

- **ConfiguratorProxy.sol** - Transparent upgradeable proxy for Configurator with custom `_beforeFallback` allowing admin to call implementation directly.

- **CometProxyAdmin.sol** - Proxy admin with special `deployAndUpgradeTo` function that deploys via Configurator and upgrades proxy atomically.

### Supplementary Contracts

- **Bulker.sol** - Allows batching multiple Comet operations in a single transaction.

- **CometRewards.sol** - Distributes rewards to protocol participants.

### Deployment Structure

Deployments are organized as: `deployments/[network]/[asset]/`

Each deployment contains:
- `configuration.json` - Protocol configuration parameters
- `deploy.ts` - Deployment script
- `roots.json` - Root contract addresses for spider
- `relations.json` - Spider crawling rules
- `migrations/` - Governance proposal scripts
- `artifacts/` - Migration artifacts after preparation

Networks include: mainnet, sepolia, arbitrum, base, optimism, polygon, scroll, linea, ronin, unichain, mantle, fuji.

Assets vary by network but include: usdc, weth, usdt, wbtc, wsteth, usds, aero, usde, wron.

### Testing Structure

- **test/** - Unit tests using Hardhat's test framework
- **scenario/** - High-level property tests that run against all deployments
  - `scenario/context/` - Test context helpers (CometContext, CometActor, CometAsset)
  - `scenario/constraints/` - Constraint system for conditional test execution
  - `scenario/utils/` - Cross-chain message relaying and helpers

### Plugin Architecture

- **plugins/deployment_manager/** - Manages deployments, spider, and contract discovery
- **plugins/scenario/** - Scenario testing framework
- **plugins/import/** - Hardhat import functionality

## User-Facing Contracts

These are the core smart contracts that end users interact with:

### 1. Comet (Main Protocol Contract)

The primary lending protocol contract deployed via proxy for each market (e.g., mainnet USDC: `0xc3d688B66703497DAA19211EEdff47f25384cdc3`).

**Supply Operations:**
- `supply(address asset, uint amount)` - Supply base or collateral asset
- `supplyTo(address dst, address asset, uint amount)` - Supply on behalf of another address
- `supplyFrom(address from, address dst, address asset, uint amount)` - Supply from one address to another (requires permission)

**Withdraw Operations:**
- `withdraw(address asset, uint amount)` - Withdraw base or collateral
- `withdrawTo(address to, address asset, uint amount)` - Withdraw to specific address
- `withdrawFrom(address src, address to, address asset, uint amount)` - Withdraw on behalf (requires permission)

**Transfer Operations:**
- `transfer(address dst, uint amount)` - Transfer base asset (ERC-20 compatible)
- `transferFrom(address src, address dst, uint amount)` - Transfer from another account (ERC-20)
- `transferAsset(address dst, address asset, uint amount)` - Transfer collateral
- `transferAssetFrom(address src, address dst, address asset, uint amount)` - Transfer collateral on behalf

**View Functions:**
- `balanceOf(address owner)` - View supply balance
- `borrowBalanceOf(address account)` - View borrow balance
- `collateralBalanceOf(address account, address asset)` - View collateral balance (in CometExt)
- `getAssetInfo(uint8 i)` - Get asset configuration
- `isLiquidatable(address account)` - Check if account can be liquidated
- `isBorrowCollateralized(address account)` - Check if borrow is collateralized

**Permission Management (in CometExt):**
- `allow(address manager, bool isAllowed)` - Grant permission to a manager
- `allowBySig(...)` - Grant permission via signature
- `approve(address spender, uint256 amount)` - ERC-20 approve

**Liquidation Functions (for liquidators):**
- `absorb(address absorber, address[] calldata accounts)` - Liquidate underwater accounts
- `buyCollateral(address asset, uint minAmount, uint baseAmount, address recipient)` - Purchase liquidated collateral

### 2. Bulker Contract

Location: `contracts/bulkers/BaseBulker.sol` (mainnet: `0xa397a8C2086C554B531c02E29f3291c9704B00c7`)

Allows batching multiple Comet operations in a single transaction for gas savings and atomic execution.

**Main Function:**
- `invoke(bytes32[] calldata actions, bytes[] calldata data)` - Execute multiple actions atomically

**Supported Actions:**
- `ACTION_SUPPLY_ASSET` - Supply ERC-20 tokens
- `ACTION_SUPPLY_NATIVE_TOKEN` - Supply native ETH (wraps to WETH automatically)
- `ACTION_TRANSFER_ASSET` - Transfer assets within Comet
- `ACTION_WITHDRAW_ASSET` - Withdraw ERC-20 tokens
- `ACTION_WITHDRAW_NATIVE_TOKEN` - Withdraw as native ETH (unwraps WETH)
- `ACTION_CLAIM_REWARD` - Claim rewards from CometRewards

### 3. CometRewards Contract

Location: `contracts/CometRewards.sol` (mainnet: `0x1B0e765F6224C21223AeA2af16c1C46E38885a40`)

Distributes protocol rewards (e.g., COMP tokens) to users based on their participation.

**Key Functions:**
- `claim(address comet, address src, bool shouldAccrue)` - Claim rewards for an account
- `claimTo(address comet, address src, address to, bool shouldAccrue)` - Claim rewards to specific address
- `getRewardOwed(address comet, address account)` - View pending rewards (view function)

### Contract Interaction Diagram

```
┌─────────────────────────────────────────────────┐
│                   User Wallets                  │
└─────────────────┬───────────────────────────────┘
                  │
    ┌─────────────┼─────────────┐
    │             │             │
    ▼             ▼             ▼
┌───────┐    ┌────────┐    ┌──────────┐
│Bulker │───►│ Comet  │◄───│ Comet    │
│       │    │(Proxy) │    │ Rewards  │
└───────┘    └───┬────┘    └──────────┘
                 │
         ┌───────┴────────┐
         ▼                ▼
    ┌────────┐      ┌──────────┐
    │ Comet  │      │ CometExt │
    │  .sol  │      │   .sol   │
    │(Main)  │      │(Extension)│
    └────────┘      └──────────┘
```

### Typical User Workflows

**Supplying & Earning Interest:**
1. Approve Comet to spend tokens: `token.approve(cometAddress, amount)`
2. Supply: `comet.supply(asset, amount)`
3. Interest accrues automatically on base asset supplies

**Borrowing:**
1. Supply collateral: `comet.supply(collateralAsset, amount)`
2. Borrow by withdrawing base: `comet.withdraw(baseAsset, borrowAmount)`
3. Interest accrues on borrow balance

**Batch Operations (via Bulker):**
1. Approve Bulker: `comet.allow(bulkerAddress, true)`
2. Execute: `bulker.invoke([actions], [data])`

**Claiming Rewards:**
- Call: `cometRewards.claim(cometAddress, yourAddress, true)`

### Important Notes

- **Split Implementation**: Comet uses two contracts (Comet.sol + CometExt.sol). The main Comet contract DELEGATECALLs to CometExt for functions like `approve`, `allow`, and `collateralBalanceOf`.

- **ERC-20 Compatible**: Each Comet deployment is an ERC-20 token representing supplied base assets (e.g., cUSDCv3, cWETHv3).

- **Per-Market Deployment**: Each market (mainnet-usdc, mainnet-weth, base-usdc, etc.) has separate Comet deployments with different base assets, collateral assets, interest rates, and supply caps.

- **Upgradeable**: Comet uses TransparentUpgradeableProxy pattern, upgradeable via governance through the Configurator.

## Key Development Patterns

### Solidity Compilation
- Uses Solidity 0.8.15
- Via-IR compilation enabled with custom optimizer settings
- Contract size limits enforced via hardhat-contract-sizer
- Filters out test files (`.t.sol`) and `forge-std` from compilation

### Multi-Chain Support
Each network has specific configuration in hardhat.config.ts with custom hardfork histories for L2s (Arbitrum, Linea, Scroll, Mantle, Ronin) to handle EVM differences.

### Proxy Pattern
- Uses OpenZeppelin's TransparentUpgradeableProxy pattern
- Comet proxy can be upgraded via governance through Configurator
- ConfiguratorProxy has custom admin behavior

### Migration and Governance Flow
1. Create migration script with `prepare` and `enact` steps
2. Open PR with migration
3. Scenarios automatically test migration against all deployments
4. Run prepare/enact via GitHub Actions workflow
5. Wait for governance proposal execution before merging

### Scenario Constraints
Scenarios can specify requirements like `{upgrade: true}` to indicate modern-only features. The ModernConstraint will upgrade deployments to latest code before running the scenario.

## Testing Approach

- Unit tests focus on specific contract functions with mocked dependencies
- Scenario tests verify high-level protocol properties across all deployments
- Migrations are tested automatically via scenario framework
- Cross-chain message relaying is tested via `scenario/utils/relay*Message.ts` helpers

## Vendor Contracts

Third-party contracts are in `contracts/vendor/`. The repo extends some vendor contracts:
- ConfiguratorProxy extends TransparentUpgradeableProxy
- CometProxyAdmin extends ProxyAdmin
