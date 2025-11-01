import { ethers } from 'hardhat';

async function main() {
  // Get signer
  const [signer] = await ethers.getSigners();
  console.log('Testing with account:', signer.address);
  console.log();

  // ==================== CONFIGURATION ====================
  const COMET_ADDRESS = '0xfa80b411995AaBb4cdA7BcE5cEF26b5d5Ac12353';
  const TSTOCK_ADDRESS = '0xBEae6Fa62362aB593B498692FD09002a9eEd52dc';
  const USDT_ADDRESS = '0x89e8a0f004CC32750b49D0dAbA5a88E88FA090E4';
  const TSTOCK_PRICE_FEED = '0x4b531A318B0e44B549F3b2f824721b3D0d51930A'; // ← YOUR PRICE FEED ADDRESS
  const USDT_PRICE_FEED = '0xA2F78ab2355fe2f984D808B5CeE7FD0A93D5270E';

  // ==================== GET CONTRACTS ====================
  const comet = await ethers.getContractAt('contracts/CometInterface.sol:CometInterface', COMET_ADDRESS);
  const tstock = await ethers.getContractAt('contracts/ERC20.sol:ERC20', TSTOCK_ADDRESS);
  const usdt = await ethers.getContractAt('contracts/ERC20.sol:ERC20', USDT_ADDRESS);

  // ==================== TEST SCENARIOS ====================
  // Uncomment ONE of the following scenarios to test:

  // SCENARIO 1: Normal borrow (should succeed)
  const BORROW_AMOUNT = ethers.utils.parseUnits('5000', 6);     // 5000 USDt
  const TEST_SCENARIO = 'NORMAL';

  // SCENARIO 2: Borrow below minimum (should fail)
  // const BORROW_AMOUNT = ethers.utils.parseUnits('50', 6);      // 50 USDt (below 100 min)
  // const TEST_SCENARIO = 'BELOW_MINIMUM';

  // SCENARIO 3: Borrow exceeding capacity (should fail)
  // const BORROW_AMOUNT = ethers.utils.parseUnits('60000', 6);   // 10000 USDt (likely exceeds capacity)
  // const TEST_SCENARIO = 'EXCEED_CAPACITY';


  console.log('='.repeat(70));
  console.log('TEST: BORROW WITH EXISTING COLLATERAL');
  console.log('='.repeat(70));
  console.log('Test Scenario:', TEST_SCENARIO);
  console.log('Comet:', COMET_ADDRESS);
  console.log('TSTOCK:', TSTOCK_ADDRESS);
  console.log('USDt:', USDT_ADDRESS);
  console.log();

  // Get TSTOCK asset info to find borrowCF
  const numAssets = await comet.numAssets();
  let tstockAssetInfo: any = null;
  let tstockIndex = -1;

  for (let i = 0; i < Number(numAssets); i++) {
    const assetInfo = await comet.getAssetInfo(i);
    if (assetInfo.asset.toLowerCase() === TSTOCK_ADDRESS.toLowerCase()) {
      tstockAssetInfo = assetInfo;
      tstockIndex = i;
      break;
    }
  }

  if (!tstockAssetInfo) {
    console.log('❌ ERROR: TSTOCK is not a collateral asset in this pool!');
    process.exit(1);
  }

  // Get current collateral amount first
  const existingCollateral = await comet.collateralBalanceOf(signer.address, TSTOCK_ADDRESS);

  // Get prices
  const tstockPrice = await comet.getPrice(TSTOCK_PRICE_FEED);
  const usdtPrice = await comet.getPrice(USDT_PRICE_FEED);

  // Calculate collateral value in USD (8 decimals from price feed)
  const collateralValueUSD = existingCollateral.mul(tstockPrice).div(ethers.utils.parseUnits('1', 8));

  // Calculate max borrow in USD using borrowCollateralFactor
  const borrowCF = tstockAssetInfo.borrowCollateralFactor; // e.g., 0.8e18 = 80%
  const maxBorrowUSD = collateralValueUSD.mul(borrowCF).div(ethers.utils.parseUnits('1', 18));

  // Convert to USDt (6 decimals)
  // Formula: amount_usdt = value_usd * 10^(usdt_decimals + price_decimals) / usdt_price
  const USDT_DECIMALS = 6;
  const PRICE_FEED_DECIMALS = 8;
  const maxBorrowUSDt = maxBorrowUSD.mul(ethers.utils.parseUnits('1', USDT_DECIMALS + PRICE_FEED_DECIMALS)).div(usdtPrice);

  console.log('COLLATERAL ANALYSIS:');
  console.log('  TSTOCK Amount:', ethers.utils.formatUnits(existingCollateral, 0), 'TSTOCK');
  console.log('  TSTOCK Price:', ethers.utils.formatUnits(tstockPrice, 8), 'USD');
  console.log('  Collateral Value (USD):', ethers.utils.formatUnits(collateralValueUSD, 0), 'USD');
  console.log('  Borrow Collateral Factor (LTV):', (Number(borrowCF) / 1e18 * 100).toFixed(2) + '%');
  console.log();

  console.log('BORROW CAPACITY:');
  console.log('  Max Borrow (USD):', ethers.utils.formatUnits(maxBorrowUSD, 0), 'USD');
  console.log('  Max Borrow (USDt):', ethers.utils.formatUnits(maxBorrowUSDt, 6), 'USDt');
  console.log('  Requested Borrow:', ethers.utils.formatUnits(BORROW_AMOUNT, 6), 'USDt');
  console.log();

  // Check minimum borrow requirement
  const borrowMin = await comet.baseBorrowMin();

  console.log('VALIDATION:');
  console.log('  Minimum Borrow:', ethers.utils.formatUnits(borrowMin, 6), 'USDt');

  // Calculate actual borrow amount (after withdrawing from supply)
  const usdtSupplied = await comet.balanceOf(signer.address);
  const actualBorrowAmount = BORROW_AMOUNT.gt(usdtSupplied)
    ? BORROW_AMOUNT.sub(usdtSupplied)
    : ethers.BigNumber.from(0);

  console.log();
  console.log('WITHDRAW CALCULATION:');
  console.log('  Total Withdraw Amount:', ethers.utils.formatUnits(BORROW_AMOUNT, 6), 'USDt');
  console.log('  Your Supplied USDt:', ethers.utils.formatUnits(usdtSupplied, 6), 'USDt');
  console.log('  Will Withdraw from Supply:', ethers.utils.formatUnits(
    BORROW_AMOUNT.lte(usdtSupplied) ? BORROW_AMOUNT : usdtSupplied, 6
  ), 'USDt');
  console.log('  Actual Borrow (New Debt):', ethers.utils.formatUnits(actualBorrowAmount, 6), 'USDt');

  // Check 1: Minimum borrow validation (for NEW borrow only)
  let isAboveMinimum = true;
  if (actualBorrowAmount.gt(0) && actualBorrowAmount.lt(borrowMin)) {
    isAboveMinimum = false;
  }

  console.log();
  console.log('CHECKS:');
  console.log('  Is Above Minimum:', isAboveMinimum ? '✅ YES' : '❌ NO');
  if (!isAboveMinimum) {
    console.log(`    (New borrow ${ethers.utils.formatUnits(actualBorrowAmount, 6)} < ${ethers.utils.formatUnits(borrowMin, 6)})`);
  }

  // Check 2: Capacity validation (for actual borrow amount)
  const isWithinCapacity = actualBorrowAmount.lte(maxBorrowUSDt);
  console.log('  Is Within Capacity:', isWithinCapacity ? '✅ YES' : '❌ NO');
  if (isWithinCapacity && actualBorrowAmount.gt(0)) {
    const utilizationPercent = actualBorrowAmount.mul(10000).div(maxBorrowUSDt).toNumber() / 100;
    console.log(`    (Using ${utilizationPercent.toFixed(2)}% of max capacity)`);
  } else if (!isWithinCapacity) {
    console.log(`    (${ethers.utils.formatUnits(actualBorrowAmount, 6)} > ${ethers.utils.formatUnits(maxBorrowUSDt, 6)})`);
  }

  // Expected outcome
  console.log();
  console.log('EXPECTED OUTCOME:');
  if (actualBorrowAmount.eq(0)) {
    console.log('  ✅ Withdraw should SUCCEED - Only withdrawing your own supply, no borrowing');
  } else if (isAboveMinimum && isWithinCapacity) {
    console.log('  ✅ Borrow should SUCCEED');
  } else if (!isAboveMinimum) {
    console.log('  ❌ Borrow should FAIL - Below minimum');
  } else if (!isWithinCapacity) {
    console.log('  ❌ Borrow should FAIL - Exceeds capacity');
  }
  console.log();

  // Verify user has collateral
  if (existingCollateral.eq(0)) {
    console.log();
    console.log('❌ ERROR: No TSTOCK collateral found!');
    console.log('   You need to supply TSTOCK collateral first.');
    console.log('   Use a separate script to supply collateral or update this script.');
    process.exit(1);
  }

  // Check current state
  console.log('CURRENT POSITION:');
  const usdtBalanceBefore = await usdt.balanceOf(signer.address);
  const usdtSuppliedBefore = await comet.balanceOf(signer.address);
  const borrowBefore = await comet.borrowBalanceOf(signer.address);

  console.log('  TSTOCK Collateral:', ethers.utils.formatUnits(existingCollateral, 0));
  console.log('  USDt Wallet:', ethers.utils.formatUnits(usdtBalanceBefore, 6));
  console.log('  USDt Supplied in Comet:', ethers.utils.formatUnits(usdtSuppliedBefore, 6));
  console.log('  USDt Borrowed:', ethers.utils.formatUnits(borrowBefore, 6));

  // Check current account status
  if (borrowBefore.gt(0)) {
    const isCurrentlyLiquidatable = await comet.isLiquidatable(signer.address);
    const isBorrowCollateralized = await comet.isBorrowCollateralized(signer.address);
    console.log('  Borrow Collateralized:', isBorrowCollateralized ? '✅ YES' : '❌ NO');
    console.log('  Current Status:', isCurrentlyLiquidatable ? '❌ LIQUIDATABLE' : '✅ HEALTHY');
  }
  console.log();

  // ==================== BORROW TEST ====================
  console.log('='.repeat(70));
  console.log('BORROW TEST');
  console.log('='.repeat(70));

  // Check pool liquidity before borrowing
  const totalSupplyBase = await comet.totalSupply();
  const totalBorrowBase = await comet.totalBorrow();
  const availableLiquidity = totalSupplyBase.sub(totalBorrowBase);

  console.log('Pool Liquidity Check:');
  console.log('  Available to Borrow:', ethers.utils.formatUnits(availableLiquidity, 6), 'USDt');
  console.log('  Requested Borrow:', ethers.utils.formatUnits(BORROW_AMOUNT, 6), 'USDt');

  const hasLiquidity = BORROW_AMOUNT.lte(availableLiquidity);
  console.log('  Has Sufficient Liquidity:', hasLiquidity ? '✅ YES' : '❌ NO');

  if (!hasLiquidity) {
    console.log();
    console.log('⚠️  NOTE: Pool has insufficient liquidity!');
    console.log('   Supply USDt to the pool first using test-supply-base.ts');
    console.log('   Continuing with test to demonstrate failure...');
  }
  console.log();

  console.log('Attempting to borrow USDt (by withdrawing base asset)...');
  try {
    // Withdraw = Borrow when withdrawing base asset
    const borrowTx = await comet.withdraw(USDT_ADDRESS, BORROW_AMOUNT);
    console.log('  Tx hash:', borrowTx.hash);
    const borrowReceipt = await borrowTx.wait();
    console.log('  ✅ Borrow successful');
    console.log('  Gas used:', borrowReceipt.gasUsed.toString());
    console.log();

    // Check final state
    console.log('AFTER BORROW:');
    const usdtBalanceAfter = await usdt.balanceOf(signer.address);
    const borrowAfter = await comet.borrowBalanceOf(signer.address);

    console.log('  USDt Wallet:', ethers.utils.formatUnits(usdtBalanceAfter, 6));
    console.log('  USDt Borrowed:', ethers.utils.formatUnits(borrowAfter, 6));
    console.log();

    console.log('CHANGE:');
    console.log('  Wallet Increase:', ethers.utils.formatUnits(usdtBalanceAfter.sub(usdtBalanceBefore), 6), 'USDt');
    console.log('  Borrow Increase:', ethers.utils.formatUnits(borrowAfter.sub(borrowBefore), 6), 'USDt');
    console.log();

    // Check account health and collateralization
    console.log('ACCOUNT HEALTH CHECK:');
    const isBorrowCollateralized = await comet.isBorrowCollateralized(signer.address);
    const isLiquidatable = await comet.isLiquidatable(signer.address);

    console.log('  Borrow Collateralized:', isBorrowCollateralized ? '✅ YES' : '❌ NO');
    console.log('  Account Status:', isLiquidatable ? '❌ LIQUIDATABLE (DANGER!)' : '✅ HEALTHY');

    // Calculate health factor
    const currentCollateral = await comet.collateralBalanceOf(signer.address, TSTOCK_ADDRESS);
    const totalCollateralValueUSD = currentCollateral.mul(tstockPrice).div(ethers.utils.parseUnits('1', 8));
    const liquidateCF = tstockAssetInfo.liquidateCollateralFactor;
    const liquidationThresholdUSD = totalCollateralValueUSD.mul(liquidateCF).div(ethers.utils.parseUnits('1', 18));
    const borrowValueUSD = borrowAfter.mul(usdtPrice).div(ethers.utils.parseUnits('1', 6));

    if (borrowValueUSD.gt(0)) {
      const healthFactor = liquidationThresholdUSD.mul(10000).div(borrowValueUSD).toNumber() / 10000;
      console.log('  Health Factor:', healthFactor.toFixed(4), '(>1.0 is safe)');

      if (healthFactor < 1.2) {
        console.log('  ⚠️  WARNING: Health factor is low! Risk of liquidation if prices change.');
      }
    }
    console.log();

    console.log('✅ ACTUAL OUTCOME: Borrow SUCCEEDED');
    console.log('='.repeat(70));

  } catch (error: any) {
    console.log('❌ ACTUAL OUTCOME: Borrow FAILED');
    console.log();
    console.log('Error Details:');
    console.log('  Message:', error.message);

    // Try to extract revert reason
    if (error.reason) {
      console.log('  Reason:', error.reason);
    }
    if (error.code) {
      console.log('  Error Code:', error.code);
    }
    console.log();

    console.log('Diagnosis:');
    if (!isAboveMinimum) {
      console.log('  ✓ Failed because: Borrow amount below minimum');
    } else if (!isWithinCapacity) {
      console.log('  ✓ Failed because: Borrow amount exceeds capacity');
    } else if (!hasLiquidity) {
      console.log('  ✓ Failed because: Pool has insufficient liquidity');
    } else {
      console.log('  ? Failed for other reason (see error details above)');
    }
    console.log();

    // Show final state
    const borrowAfterFailed = await comet.borrowBalanceOf(signer.address);
    const usdtBalanceAfter = await usdt.balanceOf(signer.address);

    console.log('Final State (Unchanged):');
    console.log('  USDt Wallet:', ethers.utils.formatUnits(usdtBalanceAfter, 6));
    console.log('  USDt Borrowed:', ethers.utils.formatUnits(borrowAfterFailed, 6));
    console.log('='.repeat(70));
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('\n❌ Error:', error.message);
    console.error(error);
    process.exit(1);
  });
