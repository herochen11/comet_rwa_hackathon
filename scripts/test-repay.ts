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
  const TSTOCK_PRICE_FEED = '0x4b531A318B0e44B549F3b2f824721b3D0d51930A';
  const USDT_PRICE_FEED = '0xA2F78ab2355fe2f984D808B5CeE7FD0A93D5270E';

  // ==================== TEST SCENARIOS ====================
  // Uncomment ONE of the following scenarios to test:

  // SCENARIO 1: Partial repay (repay 50% of debt)
  const REPAY_PERCENTAGE = 50;  // Repay 50% of borrowed amount
  const TEST_SCENARIO = 'PARTIAL_REPAY';

  // SCENARIO 2: Full repay (repay entire debt)
  // const REPAY_PERCENTAGE = 100;  // Repay 100% of borrowed amount
  // const TEST_SCENARIO = 'FULL_REPAY';

  // SCENARIO 3: Over-repay (repay more than debt, excess becomes supply)
  // const REPAY_PERCENTAGE = 150;  // Repay 150% of borrowed amount
  // const TEST_SCENARIO = 'OVER_REPAY';

  // ==================== GET CONTRACTS ====================
  const comet = await ethers.getContractAt('contracts/CometInterface.sol:CometInterface', COMET_ADDRESS);
  const tstock = await ethers.getContractAt('contracts/ERC20.sol:ERC20', TSTOCK_ADDRESS);
  const usdt = await ethers.getContractAt('contracts/ERC20.sol:ERC20', USDT_ADDRESS);

  console.log('='.repeat(70));
  console.log('TEST: REPAY BORROWED USDt');
  console.log('='.repeat(70));
  console.log('Test Scenario:', TEST_SCENARIO);
  console.log('Comet:', COMET_ADDRESS);
  console.log('USDt:', USDT_ADDRESS);
  console.log();

  // Check current state
  console.log('CURRENT POSITION:');
  const usdtWalletBefore = await usdt.balanceOf(signer.address);
  const usdtSuppliedBefore = await comet.balanceOf(signer.address);
  const borrowBefore = await comet.borrowBalanceOf(signer.address);
  const collateralBefore = await comet.collateralBalanceOf(signer.address, TSTOCK_ADDRESS);

  console.log('  TSTOCK Collateral:', ethers.utils.formatUnits(collateralBefore, 0));
  console.log('  USDt Wallet:', ethers.utils.formatUnits(usdtWalletBefore, 6));
  console.log('  USDt Supplied:', ethers.utils.formatUnits(usdtSuppliedBefore, 6));
  console.log('  USDt Borrowed:', ethers.utils.formatUnits(borrowBefore, 6));

  // Check if user has any borrow to repay
  if (borrowBefore.eq(0)) {
    console.log();
    console.log('❌ ERROR: No borrow balance to repay!');
    console.log('   You need to borrow USDt first using test-supply-borrow.ts');
    process.exit(1);
  }

  // Check account health before repay
  const isLiquidatableBefore = await comet.isLiquidatable(signer.address);
  const isBorrowCollateralizedBefore = await comet.isBorrowCollateralized(signer.address);
  console.log('  Borrow Collateralized:', isBorrowCollateralizedBefore ? '✅ YES' : '❌ NO');
  console.log('  Account Status:', isLiquidatableBefore ? '❌ LIQUIDATABLE' : '✅ HEALTHY');
  console.log();

  // Calculate repay amount based on scenario
  const REPAY_AMOUNT = borrowBefore.mul(REPAY_PERCENTAGE).div(100);

  console.log('REPAY CALCULATION:');
  console.log('  Current Borrow:', ethers.utils.formatUnits(borrowBefore, 6), 'USDt');
  console.log('  Repay Percentage:', REPAY_PERCENTAGE + '%');
  console.log('  Repay Amount:', ethers.utils.formatUnits(REPAY_AMOUNT, 6), 'USDt');

  if (REPAY_AMOUNT.gt(borrowBefore)) {
    const excessAmount = REPAY_AMOUNT.sub(borrowBefore);
    console.log('  Excess Amount:', ethers.utils.formatUnits(excessAmount, 6), 'USDt (will become supply)');
  }
  console.log();

  // Check if user has enough USDt in wallet
  if (usdtWalletBefore.lt(REPAY_AMOUNT)) {
    console.log('❌ ERROR: Insufficient USDt balance in wallet!');
    console.log(`   You need ${ethers.utils.formatUnits(REPAY_AMOUNT, 6)} USDt`);
    console.log(`   You have ${ethers.utils.formatUnits(usdtWalletBefore, 6)} USDt`);
    process.exit(1);
  }

  console.log('EXPECTED OUTCOME:');
  if (REPAY_PERCENTAGE < 100) {
    console.log('  ✅ Partial repay - Borrow will decrease but not be eliminated');
  } else if (REPAY_PERCENTAGE === 100) {
    console.log('  ✅ Full repay - Borrow will be eliminated, account debt-free');
  } else {
    console.log('  ✅ Over-repay - Borrow eliminated, excess becomes supply');
  }
  console.log();

  // ==================== REPAY ====================
  console.log('='.repeat(70));
  console.log('REPAYING USDt');
  console.log('='.repeat(70));

  try {
    // Step 1: Approve USDt
    console.log('Step 1: Approving USDt...');
    const currentAllowance = await usdt.allowance(signer.address, COMET_ADDRESS);
    if (currentAllowance.lt(REPAY_AMOUNT)) {
      const approveTx = await usdt.approve(COMET_ADDRESS, REPAY_AMOUNT);
      console.log('  Tx hash:', approveTx.hash);
      await approveTx.wait();
      console.log('  ✅ Approved');
    } else {
      console.log('  ✅ Already approved');
    }
    console.log();

    // Step 2: Supply USDt (this repays borrow if principal is negative)
    console.log('Step 2: Supplying USDt to repay borrow...');
    const repayTx = await comet.supply(USDT_ADDRESS, REPAY_AMOUNT);
    console.log('  Tx hash:', repayTx.hash);
    const repayReceipt = await repayTx.wait();
    console.log('  ✅ Repay successful');
    console.log('  Gas used:', repayReceipt.gasUsed.toString());
    console.log();

    // Check final state
    console.log('AFTER REPAY:');
    const usdtWalletAfter = await usdt.balanceOf(signer.address);
    const usdtSuppliedAfter = await comet.balanceOf(signer.address);
    const borrowAfter = await comet.borrowBalanceOf(signer.address);

    console.log('  USDt Wallet:', ethers.utils.formatUnits(usdtWalletAfter, 6));
    console.log('  USDt Supplied:', ethers.utils.formatUnits(usdtSuppliedAfter, 6));
    console.log('  USDt Borrowed:', ethers.utils.formatUnits(borrowAfter, 6));
    console.log();

    console.log('CHANGE:');
    console.log('  Wallet Decrease:', ethers.utils.formatUnits(usdtWalletBefore.sub(usdtWalletAfter), 6), 'USDt');
    console.log('  Borrow Decrease:', ethers.utils.formatUnits(borrowBefore.sub(borrowAfter), 6), 'USDt');

    if (usdtSuppliedAfter.gt(usdtSuppliedBefore)) {
      console.log('  Supply Increase:', ethers.utils.formatUnits(usdtSuppliedAfter.sub(usdtSuppliedBefore), 6), 'USDt');
    }
    console.log();

    // Check account health after repay
    console.log('ACCOUNT HEALTH CHECK:');

    if (borrowAfter.gt(0)) {
      const isBorrowCollateralizedAfter = await comet.isBorrowCollateralized(signer.address);
      const isLiquidatableAfter = await comet.isLiquidatable(signer.address);

      console.log('  Borrow Collateralized:', isBorrowCollateralizedAfter ? '✅ YES' : '❌ NO');
      console.log('  Account Status:', isLiquidatableAfter ? '❌ LIQUIDATABLE' : '✅ HEALTHY');

      // Calculate health factor
      const tstockPrice = await comet.getPrice(TSTOCK_PRICE_FEED);
      const usdtPrice = await comet.getPrice(USDT_PRICE_FEED);

      // Get TSTOCK asset info
      const numAssets = await comet.numAssets();
      let tstockAssetInfo: any = null;

      for (let i = 0; i < Number(numAssets); i++) {
        const assetInfo = await comet.getAssetInfo(i);
        if (assetInfo.asset.toLowerCase() === TSTOCK_ADDRESS.toLowerCase()) {
          tstockAssetInfo = assetInfo;
          break;
        }
      }

      if (tstockAssetInfo) {
        const totalCollateralValueUSD = collateralBefore.mul(tstockPrice).div(ethers.utils.parseUnits('1', 8));
        const liquidateCF = tstockAssetInfo.liquidateCollateralFactor;
        const liquidationThresholdUSD = totalCollateralValueUSD.mul(liquidateCF).div(ethers.utils.parseUnits('1', 18));
        const borrowValueUSD = borrowAfter.mul(usdtPrice).div(ethers.utils.parseUnits('1', 6));

        if (borrowValueUSD.gt(0)) {
          const healthFactor = liquidationThresholdUSD.mul(10000).div(borrowValueUSD).toNumber() / 10000;
          console.log('  Health Factor:', healthFactor.toFixed(4), '(>1.0 is safe)');

          if (healthFactor >= 1.5) {
            console.log('  ✅ Health improved - Lower risk of liquidation');
          } else if (healthFactor >= 1.2) {
            console.log('  ⚠️  Health factor still moderate');
          } else {
            console.log('  ⚠️  Health factor still low - Consider repaying more');
          }
        }
      }
    } else {
      console.log('  ✅ Debt fully repaid - Account is debt-free!');
      console.log('  ✅ Can now withdraw collateral without restriction');
    }
    console.log();

    console.log('✅ ACTUAL OUTCOME: Repay SUCCEEDED');
    console.log('='.repeat(70));

  } catch (error: any) {
    console.log('❌ ACTUAL OUTCOME: Repay FAILED');
    console.log();
    console.log('Error Details:');
    console.log('  Message:', error.message);

    if (error.reason) {
      console.log('  Reason:', error.reason);
    }
    if (error.code) {
      console.log('  Error Code:', error.code);
    }
    console.log();

    console.log('Possible reasons:');
    console.log('  - Insufficient USDt balance in wallet');
    console.log('  - USDt approval not granted');
    console.log('  - USDt transfer restricted (ERC20 issue)');
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
