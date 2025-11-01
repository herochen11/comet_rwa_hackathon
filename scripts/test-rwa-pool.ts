import { ethers } from 'hardhat';

async function main() {
  // Get signer
  const [signer] = await ethers.getSigners();
  console.log('Testing with account:', signer.address);
  console.log('Account balance:', ethers.utils.formatEther(await signer.getBalance()), 'ETH\n');

  // ==================== CONFIGURATION ====================
  // Update these addresses after deployment
  const COMET_ADDRESS = '0xfa80b411995AaBb4cdA7BcE5cEF26b5d5Ac12353';  // From deployments/sepolia/RWA/roots.json -> "comet"
  const TSTOCK_ADDRESS = '0xBEae6Fa62362aB593B498692FD09002a9eEd52dc';
  const USDT_ADDRESS = '0x89e8a0f004CC32750b49D0dAbA5a88E88FA090E4';  // Your new USDt with 6 decimals

  // ==================== GET CONTRACTS ====================
  const comet = await ethers.getContractAt('contracts/CometInterface.sol:CometInterface', COMET_ADDRESS);
  const tstock = await ethers.getContractAt('contracts/ERC20.sol:ERC20', TSTOCK_ADDRESS);
  const usdt = await ethers.getContractAt('contracts/ERC20.sol:ERC20', USDT_ADDRESS);

  console.log('='.repeat(60));
  console.log('COMET POOL INFORMATION');
  console.log('='.repeat(60));

  // Get pool info
  const baseToken = await comet.baseToken();
  const baseTokenPriceFeed = await comet.baseTokenPriceFeed();
  const governor = await comet.governor();
  const pauseGuardian = await comet.pauseGuardian();
  const numAssets = await comet.numAssets();

  console.log('Base Token (USDt):', baseToken);
  console.log('Price Feed:', baseTokenPriceFeed);
  console.log('Governor:', governor);
  console.log('Pause Guardian:', pauseGuardian);
  console.log('Number of Collateral Assets:', numAssets.toString());
  console.log();

  // Get totals
  const totals = await comet.totalsBasic();

  console.log('Pool Totals:');
  console.log('  Total Supply Base:', ethers.utils.formatUnits(totals.totalSupplyBase, 6), 'USDt');
  console.log('  Total Borrow Base:', ethers.utils.formatUnits(totals.totalBorrowBase, 6), 'USDt');
  console.log('  Base Supply Index:', ethers.utils.formatUnits(totals.baseSupplyIndex, 15));
  console.log('  Base Borrow Index:', ethers.utils.formatUnits(totals.baseBorrowIndex, 15));
  console.log('  Last Accrual Time:', new Date(Number(totals.lastAccrualTime) * 1000).toISOString());
  console.log();

  // Get asset info
  console.log('Collateral Assets:');
  for (let i = 0; i < Number(numAssets); i++) {
    const assetInfo = await comet.getAssetInfo(i);
    const assetContract = await ethers.getContractAt('contracts/ERC20.sol:ERC20', assetInfo.asset);
    const symbol = await assetContract.symbol();
    console.log(`  [${i}] ${symbol} (${assetInfo.asset})`);
    console.log(`      Decimals: ${assetInfo.decimals}`);
    console.log(`      Borrow CF: ${ethers.utils.formatUnits(assetInfo.borrowCollateralFactor, 18)}`);
    console.log(`      Liquidate CF: ${ethers.utils.formatUnits(assetInfo.liquidateCollateralFactor, 18)}`);
    console.log(`      Supply Cap: ${ethers.utils.formatUnits(assetInfo.supplyCap, assetInfo.decimals)}`);
  }
  console.log();

  console.log('='.repeat(60));
  console.log('USER BALANCES - BEFORE ACTIONS');
  console.log('='.repeat(60));

  const tstockBalance = await tstock.balanceOf(signer.address);
  const usdtBalance = await usdt.balanceOf(signer.address);

  console.log('Wallet Balances:');
  console.log('  TSTOCK:', ethers.utils.formatUnits(tstockBalance, 0));
  console.log('  USDt:', ethers.utils.formatUnits(usdtBalance, 6));
  console.log();

  console.log('Comet Position:');
  const collateralBefore = await comet.collateralBalanceOf(signer.address, TSTOCK_ADDRESS);
  const baseBorrowBefore = await comet.borrowBalanceOf(signer.address);
  const baseSupplyBefore = await comet.balanceOf(signer.address);

  console.log('  TSTOCK Collateral:', ethers.utils.formatUnits(collateralBefore, 0));
  console.log('  USDt Borrowed:', ethers.utils.formatUnits(baseBorrowBefore, 6));
  console.log('  USDt Supplied:', ethers.utils.formatUnits(baseSupplyBefore, 6));
  console.log();

  // ==================== TEST 1: SUPPLY COLLATERAL ====================
  console.log('='.repeat(60));
  console.log('TEST 1: SUPPLY TSTOCK AS COLLATERAL');
  console.log('='.repeat(60));

  const supplyAmount = ethers.utils.parseUnits('100', 0); // 100 TSTOCK (0 decimals)

  if (tstockBalance.gte(supplyAmount)) {
    // Approve TSTOCK
    console.log('Approving TSTOCK...');
    const approveTx = await tstock.approve(COMET_ADDRESS, supplyAmount);
    await approveTx.wait();
    console.log('✅ Approved\n');

    // Supply TSTOCK as collateral
    console.log('Supplying', ethers.utils.formatUnits(supplyAmount, 0), 'TSTOCK...');
    const supplyTx = await comet.supply(TSTOCK_ADDRESS, supplyAmount);
    await supplyTx.wait();
    console.log('✅ Supplied\n');

    // Check new collateral balance
    const collateralAfter = await comet.collateralBalanceOf(signer.address, TSTOCK_ADDRESS);
    console.log('New TSTOCK Collateral Balance:', ethers.utils.formatUnits(collateralAfter, 0));
    console.log('Increase:', ethers.utils.formatUnits(collateralAfter.sub(collateralBefore), 0), 'TSTOCK\n');
  } else {
    console.log('⚠️  Insufficient TSTOCK balance. Skipping supply test.\n');
  }

  // ==================== TEST 2: BORROW BASE ASSET ====================
  console.log('='.repeat(60));
  console.log('TEST 2: BORROW USDt');
  console.log('='.repeat(60));

  const borrowAmount = ethers.utils.parseUnits('10', 6); // Borrow 10 USDt

  console.log('Borrowing', ethers.utils.formatUnits(borrowAmount, 6), 'USDt...');
  try {
    const borrowTx = await comet.withdraw(USDT_ADDRESS, borrowAmount);
    await borrowTx.wait();
    console.log('✅ Borrowed\n');

    // Check new balances
    const usdtBalanceAfterBorrow = await usdt.balanceOf(signer.address);
    const baseBorrowAfter = await comet.borrowBalanceOf(signer.address);

    console.log('New USDt Wallet Balance:', ethers.utils.formatUnits(usdtBalanceAfterBorrow, 6));
    console.log('New Borrow Balance:', ethers.utils.formatUnits(baseBorrowAfter, 6));
    console.log('Borrowed Amount:', ethers.utils.formatUnits(baseBorrowAfter.sub(baseBorrowBefore), 6), 'USDt\n');
  } catch (error) {
    console.log('❌ Borrow failed:', error.message);
    console.log('Possible reasons:');
    console.log('  - Insufficient collateral value');
    console.log('  - Borrow amount below borrowMin');
    console.log('  - Pool has insufficient liquidity\n');
  }

  // ==================== TEST 3: SUPPLY BASE ASSET ====================
  console.log('='.repeat(60));
  console.log('TEST 3: SUPPLY USDt TO EARN INTEREST');
  console.log('='.repeat(60));

  const supplyBaseAmount = ethers.utils.parseUnits('50', 6); // Supply 50 USDt

  if (usdtBalance.gte(supplyBaseAmount)) {
    // Approve USDt
    console.log('Approving USDt...');
    const approveBaseTx = await usdt.approve(COMET_ADDRESS, supplyBaseAmount);
    await approveBaseTx.wait();
    console.log('✅ Approved\n');

    // Supply USDt
    console.log('Supplying', ethers.utils.formatUnits(supplyBaseAmount, 6), 'USDt...');
    const supplyBaseTx = await comet.supply(USDT_ADDRESS, supplyBaseAmount);
    await supplyBaseTx.wait();
    console.log('✅ Supplied\n');

    // Check new supply balance
    const baseSupplyAfter = await comet.balanceOf(signer.address);
    console.log('New USDt Supply Balance:', ethers.utils.formatUnits(baseSupplyAfter, 6));
    console.log('Increase:', ethers.utils.formatUnits(baseSupplyAfter.sub(baseSupplyBefore), 6), 'USDt\n');
  } else {
    console.log('⚠️  Insufficient USDt balance. Skipping supply test.\n');
  }

  // ==================== TEST 4: WITHDRAW ====================
  console.log('='.repeat(60));
  console.log('TEST 4: WITHDRAW COLLATERAL');
  console.log('='.repeat(60));

  const withdrawAmount = ethers.utils.parseUnits('10', 0); // Withdraw 10 TSTOCK

  const currentCollateral = await comet.collateralBalanceOf(signer.address, TSTOCK_ADDRESS);
  if (currentCollateral.gte(withdrawAmount)) {
    console.log('Withdrawing', ethers.utils.formatUnits(withdrawAmount, 0), 'TSTOCK...');
    try {
      const withdrawTx = await comet.withdraw(TSTOCK_ADDRESS, withdrawAmount);
      await withdrawTx.wait();
      console.log('✅ Withdrawn\n');

      const collateralAfterWithdraw = await comet.collateralBalanceOf(signer.address, TSTOCK_ADDRESS);
      const tstockBalanceAfterWithdraw = await tstock.balanceOf(signer.address);

      console.log('New TSTOCK Collateral:', ethers.utils.formatUnits(collateralAfterWithdraw, 0));
      console.log('New TSTOCK Wallet Balance:', ethers.utils.formatUnits(tstockBalanceAfterWithdraw, 0));
    } catch (error) {
      console.log('❌ Withdraw failed:', error.message);
      console.log('Possible reasons:');
      console.log('  - Would put account below liquidation threshold');
      console.log('  - Have active borrows\n');
    }
  } else {
    console.log('⚠️  Insufficient collateral. Skipping withdraw test.\n');
  }

  // ==================== FINAL STATE ====================
  console.log('='.repeat(60));
  console.log('FINAL STATE');
  console.log('='.repeat(60));

  const finalTotals = await comet.totalsBasic();
  console.log('Pool Totals:');
  console.log('  Total Supply:', ethers.utils.formatUnits(finalTotals.totalSupplyBase, 6), 'USDt');
  console.log('  Total Borrow:', ethers.utils.formatUnits(finalTotals.totalBorrowBase, 6), 'USDt');
  console.log();

  console.log('Your Position:');
  const finalCollateral = await comet.collateralBalanceOf(signer.address, TSTOCK_ADDRESS);
  const finalBorrow = await comet.borrowBalanceOf(signer.address);
  const finalSupply = await comet.balanceOf(signer.address);

  console.log('  TSTOCK Collateral:', ethers.utils.formatUnits(finalCollateral, 0));
  console.log('  USDt Borrowed:', ethers.utils.formatUnits(finalBorrow, 6));
  console.log('  USDt Supplied:', ethers.utils.formatUnits(finalSupply, 6));
  console.log();

  // Check if account is healthy
  if (finalBorrow.gt(0)) {
    const isLiquidatable = await comet.isLiquidatable(signer.address);
    console.log('Account Status:', isLiquidatable ? '❌ LIQUIDATABLE' : '✅ HEALTHY');
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
