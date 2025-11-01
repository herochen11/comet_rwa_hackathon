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

  const WITHDRAW_COLLATERAL_AMOUNT = ethers.utils.parseUnits('50', 0);  // Withdraw 50 TSTOCK
  const WITHDRAW_BASE_AMOUNT = ethers.utils.parseUnits('50', 6);        // Withdraw 50 USDt

  // ==================== GET CONTRACTS ====================
  const comet = await ethers.getContractAt('contracts/CometInterface.sol:CometInterface', COMET_ADDRESS);
  const tstock = await ethers.getContractAt('contracts/ERC20.sol:ERC20', TSTOCK_ADDRESS);
  const usdt = await ethers.getContractAt('contracts/ERC20.sol:ERC20', USDT_ADDRESS);

  console.log('='.repeat(70));
  console.log('TEST: WITHDRAW ASSETS');
  console.log('='.repeat(70));
  console.log('Comet:', COMET_ADDRESS);
  console.log('TSTOCK:', TSTOCK_ADDRESS);
  console.log('USDt:', USDT_ADDRESS);
  console.log();

  // Check current state
  console.log('CURRENT POSITION:');
  const tstockWalletBefore = await tstock.balanceOf(signer.address);
  const tstockCollateralBefore = await comet.collateralBalanceOf(signer.address, TSTOCK_ADDRESS);
  const usdtWalletBefore = await usdt.balanceOf(signer.address);
  const usdtSupplyBefore = await comet.balanceOf(signer.address);
  const borrowBalance = await comet.borrowBalanceOf(signer.address);

  console.log('  TSTOCK Wallet:', ethers.utils.formatUnits(tstockWalletBefore, 0));
  console.log('  TSTOCK Collateral:', ethers.utils.formatUnits(tstockCollateralBefore, 0));
  console.log('  USDt Wallet:', ethers.utils.formatUnits(usdtWalletBefore, 6));
  console.log('  USDt Supplied:', ethers.utils.formatUnits(usdtSupplyBefore, 6));
  console.log('  USDt Borrowed:', ethers.utils.formatUnits(borrowBalance, 6));
  console.log();

  // Check health before withdrawal
  if (borrowBalance.gt(0)) {
    const isLiquidatableBefore = await comet.isLiquidatable(signer.address);
    console.log('Current Status:', isLiquidatableBefore ? '❌ LIQUIDATABLE' : '✅ HEALTHY');
    console.log();
  }

  // ==================== PART 1: WITHDRAW BASE ASSET (USDt) ====================
  if (usdtSupplyBefore.gt(0)) {
    console.log('='.repeat(70));
    console.log('PART 1: WITHDRAW BASE ASSET (USDt)');
    console.log('='.repeat(70));

    const amountToWithdraw = usdtSupplyBefore.lt(WITHDRAW_BASE_AMOUNT)
      ? usdtSupplyBefore
      : WITHDRAW_BASE_AMOUNT;

    console.log('Withdrawing:', ethers.utils.formatUnits(amountToWithdraw, 6), 'USDt');
    console.log();

    try {
      const withdrawBaseTx = await comet.withdraw(USDT_ADDRESS, amountToWithdraw);
      console.log('  Tx hash:', withdrawBaseTx.hash);
      const receipt = await withdrawBaseTx.wait();
      console.log('  ✅ Withdrawal successful');
      console.log('  Gas used:', receipt.gasUsed.toString());
      console.log();

      const usdtWalletAfter = await usdt.balanceOf(signer.address);
      const usdtSupplyAfter = await comet.balanceOf(signer.address);

      console.log('AFTER WITHDRAWAL:');
      console.log('  USDt Wallet:', ethers.utils.formatUnits(usdtWalletAfter, 6));
      console.log('  USDt Supplied:', ethers.utils.formatUnits(usdtSupplyAfter, 6));
      console.log();
      console.log('CHANGE:');
      console.log('  Wallet Increase:', ethers.utils.formatUnits(usdtWalletAfter.sub(usdtWalletBefore), 6), 'USDt');
      console.log('  Supply Decrease:', ethers.utils.formatUnits(usdtSupplyBefore.sub(usdtSupplyAfter), 6), 'USDt');
      console.log();

    } catch (error: any) {
      console.log('❌ Base withdrawal failed!');
      console.log('Error:', error.message);
      console.log();
    }
  } else {
    console.log('⚠️  No USDt supply to withdraw. Skipping Part 1.');
    console.log();
  }

  // ==================== PART 2: WITHDRAW COLLATERAL (TSTOCK) ====================
  if (tstockCollateralBefore.gt(0)) {
    console.log('='.repeat(70));
    console.log('PART 2: WITHDRAW COLLATERAL (TSTOCK)');
    console.log('='.repeat(70));

    const amountToWithdraw = tstockCollateralBefore.lt(WITHDRAW_COLLATERAL_AMOUNT)
      ? tstockCollateralBefore
      : WITHDRAW_COLLATERAL_AMOUNT;

    console.log('Withdrawing:', ethers.utils.formatUnits(amountToWithdraw, 0), 'TSTOCK');
    console.log();

    try {
      const withdrawCollateralTx = await comet.withdraw(TSTOCK_ADDRESS, amountToWithdraw);
      console.log('  Tx hash:', withdrawCollateralTx.hash);
      const receipt = await withdrawCollateralTx.wait();
      console.log('  ✅ Withdrawal successful');
      console.log('  Gas used:', receipt.gasUsed.toString());
      console.log();

      const tstockWalletAfter = await tstock.balanceOf(signer.address);
      const tstockCollateralAfter = await comet.collateralBalanceOf(signer.address, TSTOCK_ADDRESS);

      console.log('AFTER WITHDRAWAL:');
      console.log('  TSTOCK Wallet:', ethers.utils.formatUnits(tstockWalletAfter, 0));
      console.log('  TSTOCK Collateral:', ethers.utils.formatUnits(tstockCollateralAfter, 0));
      console.log();
      console.log('CHANGE:');
      console.log('  Wallet Increase:', ethers.utils.formatUnits(tstockWalletAfter.sub(tstockWalletBefore), 0), 'TSTOCK');
      console.log('  Collateral Decrease:', ethers.utils.formatUnits(tstockCollateralBefore.sub(tstockCollateralAfter), 0), 'TSTOCK');
      console.log();

      // Check health after collateral withdrawal
      const currentBorrow = await comet.borrowBalanceOf(signer.address);
      if (currentBorrow.gt(0)) {
        const isLiquidatableAfter = await comet.isLiquidatable(signer.address);
        console.log('Account Status After Withdrawal:', isLiquidatableAfter ? '❌ LIQUIDATABLE' : '✅ HEALTHY');
        console.log();
      }

    } catch (error: any) {
      console.log('❌ Collateral withdrawal failed!');
      console.log('Error:', error.message);
      console.log();
      console.log('Possible reasons:');
      console.log('  - Would put account below liquidation threshold');
      console.log('  - Have active borrows preventing full withdrawal');
      console.log('  - TSTOCK transfer restrictions (ERC3643 compliance)');
      console.log();
    }
  } else {
    console.log('⚠️  No TSTOCK collateral to withdraw. Skipping Part 2.');
    console.log();
  }

  // ==================== FINAL STATE ====================
  console.log('='.repeat(70));
  console.log('FINAL STATE');
  console.log('='.repeat(70));

  const finalTstockWallet = await tstock.balanceOf(signer.address);
  const finalTstockCollateral = await comet.collateralBalanceOf(signer.address, TSTOCK_ADDRESS);
  const finalUsdtWallet = await usdt.balanceOf(signer.address);
  const finalUsdtSupply = await comet.balanceOf(signer.address);
  const finalBorrow = await comet.borrowBalanceOf(signer.address);

  console.log('Wallet:');
  console.log('  TSTOCK:', ethers.utils.formatUnits(finalTstockWallet, 0));
  console.log('  USDt:', ethers.utils.formatUnits(finalUsdtWallet, 6));
  console.log();
  console.log('Comet Position:');
  console.log('  TSTOCK Collateral:', ethers.utils.formatUnits(finalTstockCollateral, 0));
  console.log('  USDt Supplied:', ethers.utils.formatUnits(finalUsdtSupply, 6));
  console.log('  USDt Borrowed:', ethers.utils.formatUnits(finalBorrow, 6));
  console.log();

  if (finalBorrow.gt(0)) {
    const isLiquidatable = await comet.isLiquidatable(signer.address);
    console.log('Final Status:', isLiquidatable ? '❌ LIQUIDATABLE' : '✅ HEALTHY');
  }

  console.log();
  console.log('✅ Withdraw test completed!');
  console.log('='.repeat(70));
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('\n❌ Error:', error.message);
    console.error(error);
    process.exit(1);
  });
