import { ethers } from 'hardhat';

async function main() {
  // Get signer
  const [signer] = await ethers.getSigners();
  console.log('Testing with account:', signer.address);
  console.log();

  // ==================== CONFIGURATION ====================
  const COMET_ADDRESS = '0xfa80b411995AaBb4cdA7BcE5cEF26b5d5Ac12353';
  const USDT_ADDRESS = '0x89e8a0f004CC32750b49D0dAbA5a88E88FA090E4';
  const SUPPLY_AMOUNT = ethers.utils.parseUnits('100000', 6); // Supply 100 USDt

  // ==================== GET CONTRACTS ====================
  const comet = await ethers.getContractAt('contracts/CometInterface.sol:CometInterface', COMET_ADDRESS);
  const usdt = await ethers.getContractAt('contracts/ERC20.sol:ERC20', USDT_ADDRESS);

  console.log('='.repeat(70));
  console.log('TEST: SUPPLY BASE ASSET (USDt)');
  console.log('='.repeat(70));
  console.log('Comet:', COMET_ADDRESS);
  console.log('USDt:', USDT_ADDRESS);
  console.log('Supply Amount:', ethers.utils.formatUnits(SUPPLY_AMOUNT, 6), 'USDt');
  console.log();

  // Check current state
  console.log('BEFORE:');
  const balanceBefore = await usdt.balanceOf(signer.address);
  const supplyBefore = await comet.balanceOf(signer.address);
  console.log('  USDt Wallet Balance:', ethers.utils.formatUnits(balanceBefore, 6));
  console.log('  USDt Supply in Comet:', ethers.utils.formatUnits(supplyBefore, 6));
  console.log();

  // Check if user has enough balance
  if (balanceBefore.lt(SUPPLY_AMOUNT)) {
    console.log('❌ ERROR: Insufficient USDt balance!');
    console.log(`   You need ${ethers.utils.formatUnits(SUPPLY_AMOUNT, 6)} USDt`);
    console.log(`   You have ${ethers.utils.formatUnits(balanceBefore, 6)} USDt`);
    process.exit(1);
  }

  // Step 1: Approve
  console.log('Step 1: Approving USDt...');
  const currentAllowance = await usdt.allowance(signer.address, COMET_ADDRESS);
  if (currentAllowance.lt(SUPPLY_AMOUNT)) {
    const approveTx = await usdt.approve(COMET_ADDRESS, SUPPLY_AMOUNT);
    console.log('  Tx hash:', approveTx.hash);
    await approveTx.wait();
    console.log('  ✅ Approved');
  } else {
    console.log('  ✅ Already approved');
  }
  console.log();

  // Step 2: Supply
  console.log('Step 2: Supplying USDt to Comet...');
  const supplyTx = await comet.supply(USDT_ADDRESS, SUPPLY_AMOUNT);
  console.log('  Tx hash:', supplyTx.hash);
  const receipt = await supplyTx.wait();
  console.log('  ✅ Supply successful');
  console.log('  Gas used:', receipt.gasUsed.toString());
  console.log();

  // Check final state
  console.log('AFTER:');
  const balanceAfter = await usdt.balanceOf(signer.address);
  const supplyAfter = await comet.balanceOf(signer.address);
  console.log('  USDt Wallet Balance:', ethers.utils.formatUnits(balanceAfter, 6));
  console.log('  USDt Supply in Comet:', ethers.utils.formatUnits(supplyAfter, 6));
  console.log();

  console.log('CHANGE:');
  const balanceChange = balanceBefore.sub(balanceAfter);
  const supplyChange = supplyAfter.sub(supplyBefore);
  console.log('  Wallet Decrease:', ethers.utils.formatUnits(balanceChange, 6), 'USDt');
  console.log('  Supply Increase:', ethers.utils.formatUnits(supplyChange, 6), 'USDt');
  console.log();

  console.log('✅ Supply test completed successfully!');
  console.log('='.repeat(70));
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('\n❌ Error:', error.message);
    console.error(error);
    process.exit(1);
  });
