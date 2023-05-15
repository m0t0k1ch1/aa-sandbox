import { ethers } from "hardhat";

import { TinyAccount } from "../typechain-types";

const ENTRY_POINT_ADDRESS = "0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789";

(async () => {
  let tinyAccount: TinyAccount;
  {
    const factory = await ethers.getContractFactory("TinyAccount");
    tinyAccount = await factory.deploy(ENTRY_POINT_ADDRESS);
    await tinyAccount.deployed();
  }

  console.log(tinyAccount.address);
})()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
