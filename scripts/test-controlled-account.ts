import { ethers } from "hardhat";

import { UserOperation, getUserOperationHash } from "../lib";

const ENTRY_POINT_ADDRESS = "0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789";
const CONTROLLER_ADDRESS = "0x4e1Ef6e428d499aEca6721183Da5151E86d37aC5"; // goerli
const CONTROLLED_ACCOUNT_ADDRESS = "0xdC5D8017A28cb92072ce6e2dE469C3A58ddcc293"; // goerli

const VERIFICATION_GAS_LIMIT = ethers.BigNumber.from(100_000);
const PRE_VERIFICATION_GAS = ethers.BigNumber.from(21_000);
const MAX_PRIORITY_FEE_PER_GAS = ethers.utils.parseUnits("3", "gwei");

(async () => {
  const network = await ethers.provider.getNetwork();

  const [owner] = await ethers.getSigners();

  const entryPoint = await ethers.getContractAt(
    "IERC4337EntryPoint",
    ENTRY_POINT_ADDRESS
  );
  const controller = await ethers.getContractAt(
    "Controller",
    CONTROLLER_ADDRESS
  );
  const controlledAccount = await ethers.getContractAt(
    "ControlledAccount",
    CONTROLLED_ACCOUNT_ADDRESS
  );

  const block = await ethers.provider.getBlock("latest");

  const callData = controller.interface.encodeFunctionData("invoke", [
    controlledAccount.address,
    owner.address,
    ethers.utils.parseEther("0.01"),
    [],
  ]);

  const userOp: UserOperation = {
    sender: controller.address,
    nonce: await entryPoint.getNonce(
      controller.address,
      controlledAccount.address
    ),
    initCode: [],
    callData: callData,
    callGasLimit: await ethers.provider.estimateGas({
      from: entryPoint.address,
      to: controller.address,
      data: callData,
    }),
    verificationGasLimit: VERIFICATION_GAS_LIMIT,
    preVerificationGas: PRE_VERIFICATION_GAS,
    maxFeePerGas: block.baseFeePerGas!.add(MAX_PRIORITY_FEE_PER_GAS),
    maxPriorityFeePerGas: MAX_PRIORITY_FEE_PER_GAS,
    paymasterAndData: [],
    signature: [],
  };

  const userOpHash = getUserOperationHash(
    userOp,
    entryPoint.address,
    network.chainId
  );

  userOp.signature = await owner.signMessage(userOpHash);

  const tx = await entryPoint.handleOps([userOp], owner.address);

  console.log(tx.hash);
})()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
