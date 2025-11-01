import { ethers } from 'hardhat';

async function main() {
  // Get signer
  const [signer] = await ethers.getSigners();
  console.log('Account:', signer.address);
  console.log('ETH Balance:', ethers.utils.formatEther(await signer.getBalance()), 'ETH\n');

  // ==================== CONFIGURATION ====================
  const COMET_ADDRESS = '0xfa80b411995AaBb4cdA7BcE5cEF26b5d5Ac12353';
  const TSTOCK_ADDRESS = '0xBEae6Fa62362aB593B498692FD09002a9eEd52dc';
  const USDT_ADDRESS = '0x89e8a0f004CC32750b49D0dAbA5a88E88FA090E4';
  const TSTOCK_PRICE_FEED = '0x4b531A318B0e44B549F3b2f824721b3D0d51930A'; // ← YOUR PRICE FEED ADDRESS
  const USDT_PRICE_FEED = '0xA2F78ab2355fe2f984D808B5CeE7FD0A93D5270E';

  // ==================== GET CONTRACTS ====================
  const comet = await ethers.getContractAt('contracts/CometInterface.sol:CometInterface', COMET_ADDRESS);

  console.log('='.repeat(70));
  console.log('COMET POOL INFORMATION');
  console.log('='.repeat(70));
  console.log('Comet Address:', COMET_ADDRESS);
  console.log();

  // Get pool configuration
  const baseToken = await comet.baseToken();
  const baseTokenPriceFeed = await comet.baseTokenPriceFeed();
  const governor = await comet.governor();
  const pauseGuardian = await comet.pauseGuardian();
  const numAssets = await comet.numAssets();

  console.log('Configuration:');
  console.log('  Base Token (USDt):', baseToken);
  console.log('  Base Token Price Feed:', baseTokenPriceFeed);
  console.log('  Governor:', governor);
  console.log('  Pause Guardian:', pauseGuardian);
  console.log('  Number of Collateral Assets:', Number(numAssets));
  console.log();

  // Get pool totals
  const totals = await comet.totalsBasic();
  const total_supply = await comet.totalSupply();
  const total_borrow = await comet.totalBorrow();

  console.log('Pool Totals:');
  console.log('  Total Supply Base:', ethers.utils.formatUnits(totals.totalSupplyBase, 6), 'USDt');
  console.log('  Total Borrow Base:', ethers.utils.formatUnits(totals.totalBorrowBase, 6), 'USDt');
  console.log('  Base Supply Index:', ethers.utils.formatUnits(totals.baseSupplyIndex, 15));
  console.log('  Base Borrow Index:', ethers.utils.formatUnits(totals.baseBorrowIndex, 15));
  console.log('  Last Accrual Time:', new Date(Number(totals.lastAccrualTime) * 1000).toISOString());
  console.log('  Total Supply:', ethers.utils.formatUnits(total_supply, 6), 'USDt');
  console.log('  Total Borrow:', ethers.utils.formatUnits(total_borrow, 6), 'USDt');
  console.log();

  // Get utilization and rates
  const utilization = await comet.getUtilization();
  const supplyRate = await comet.getSupplyRate(utilization);
  const borrowRate = await comet.getBorrowRate(utilization);

  console.log('Interest Rates:');
  console.log('  Utilization:', (Number(utilization) / 1e18 * 100).toFixed(2), '%');
  console.log('  Supply Rate (per second):', Number(supplyRate));
  console.log('  Supply APR:', (Number(supplyRate) * 365 * 24 * 60 * 60 / 1e18 * 100).toFixed(2), '%');
  console.log('  Borrow Rate (per second):', Number(borrowRate));
  console.log('  Borrow APR:', (Number(borrowRate) * 365 * 24 * 60 * 60 / 1e18 * 100).toFixed(2), '%');
  console.log();

  // Get collateral assets info
  console.log('Collateral Assets:');
  for (let i = 0; i < Number(numAssets); i++) {
    const assetInfo = await comet.getAssetInfo(i);
    const assetContract = await ethers.getContractAt('contracts/ERC20.sol:ERC20', assetInfo.asset);

    let symbol = 'Unknown';
    try {
      symbol = await assetContract.symbol();
    } catch (e) {
      console.log(`  Warning: Could not get symbol for ${assetInfo.asset}`);
    }

    console.log(`  [${i}] ${symbol} (${assetInfo.asset})`);
    console.log(`      Decimals: ${assetInfo.decimals}`);
    console.log(`      Borrow CF: ${(Number(assetInfo.borrowCollateralFactor) / 1e18 * 100).toFixed(2)}%`);
    console.log(`      Liquidate CF: ${(Number(assetInfo.liquidateCollateralFactor) / 1e18 * 100).toFixed(2)}%`);
    console.log(`      Liquidation Factor: ${(Number(assetInfo.liquidationFactor) / 1e18 * 100).toFixed(2)}%`);
    console.log(`      Supply Cap: ${ethers.utils.formatUnits(assetInfo.supplyCap, assetInfo.decimals)}`);
    console.log(`      Price Feed: ${assetInfo.priceFeed}`);
    console.log();
  }

   const lp0 = await comet.liquidatorPoints(signer.address);
  // Get your position
  console.log('='.repeat(70));
  console.log('YOUR POSITION');
  console.log('='.repeat(70));

  const usdt = await ethers.getContractAt('contracts/ERC20.sol:ERC20', USDT_ADDRESS);
  const tstock = await ethers.getContractAt('contracts/ERC20.sol:ERC20', TSTOCK_ADDRESS);

  console.log('Wallet Balances:');
  const usdtBalance = await usdt.balanceOf(signer.address);
  const tstockBalance = await tstock.balanceOf(signer.address);
  console.log('  USDt:', ethers.utils.formatUnits(usdtBalance, 6));
  console.log('  TSTOCK:', ethers.utils.formatUnits(tstockBalance, 0));
  console.log();

  console.log('Comet Position:');
  const baseSupply = await comet.balanceOf(signer.address);
  const baseBorrow = await comet.borrowBalanceOf(signer.address);
  const tstockCollateral = await comet.collateralBalanceOf(signer.address, TSTOCK_ADDRESS);

  console.log('  USDt Supplied:', ethers.utils.formatUnits(baseSupply, 6));
  console.log('  USDt Borrowed:', ethers.utils.formatUnits(baseBorrow, 6));
  console.log('  TSTOCK Collateral:', ethers.utils.formatUnits(tstockCollateral, 0));
  console.log(' USDt price:', ethers.utils.formatUnits(await comet.getPrice(USDT_PRICE_FEED), 8));
  console.log(' USDt price value (USD):', ethers.utils.formatUnits(
    baseSupply.mul(await comet.getPrice(USDT_PRICE_FEED)).div(ethers.utils.parseUnits('1', 8)),
    6
  )) ;  
  console.log(' TSTOCK price:', ethers.utils.formatUnits(await comet.getPrice(TSTOCK_PRICE_FEED), 8));
    console.log(' TSTOCK price value (USD):', ethers.utils.formatUnits(
    tstockCollateral.mul(await comet.getPrice(TSTOCK_PRICE_FEED)).div(ethers.utils.parseUnits('1', 8)),
  0
  )) ;
  console.log("liquidator points:", lp0.numAbsorbs, "absorbs,", lp0[lp0.numAbsorbs], "absorbed");
  console.log();

  // Check account health
  if (baseBorrow.gt(0)) {
    const isLiquidatable = await comet.isLiquidatable(signer.address);
    console.log('Account Status:', isLiquidatable ? '❌ LIQUIDATABLE' : '✅ HEALTHY');
  } else {
    console.log('Account Status: ✅ No Borrow Position');
  }

  console.log();
  console.log('='.repeat(70));
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
