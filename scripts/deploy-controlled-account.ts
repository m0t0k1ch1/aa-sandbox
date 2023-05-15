import { ethers } from "hardhat";

import { ControlledAccount } from "../typechain-types";

const ENTRY_POINT_ADDRESS = "0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789";

(async () => {
  const [owner] = await ethers.getSigners();

  const controllerFactory = await ethers.getContractFactory("Controller");
  const controller = await controllerFactory.deploy(ENTRY_POINT_ADDRESS);
  await controller.deployed();

  let controlledAccount: ControlledAccount;
  {
    const salt = ethers.constants.HashZero;

    const address = await controller.getAccountAddress(salt);

    {
      const tx = await controller.createAccount(owner.address, salt);
      await tx.wait();
    }

    controlledAccount = await ethers.getContractAt(
      "ControlledAccount",
      address
    );
  }

  console.log(controlledAccount.address);
})()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
