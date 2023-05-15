import { ethers } from "hardhat";

import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";

import { ControlledAccount } from "../typechain-types";
import { UserOperation, getUserOperationHash } from "../lib";

describe("ControlledAccount", () => {
  async function fixture() {
    const network = await ethers.provider.getNetwork();

    const [owner, other] = await ethers.getSigners();

    const controllerFactory = await ethers.getContractFactory("Controller");
    const controller = await controllerFactory.deploy(owner.address);
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

    return { network, owner, other, controller, controlledAccount };
  }

  describe("initial state", () => {
    it("success", async () => {
      const { owner, controller, controlledAccount } = await loadFixture(
        fixture
      );

      expect(await controller.entryPoint()).to.equal(owner.address);
      expect(await controller.owner()).to.equal(owner.address);
      expect(await controller.ownerOf(controlledAccount.address)).to.equal(
        owner.address
      );
    });
  });

  describe("validateUserOp", () => {
    it("failure: caller must be the entry point", async () => {
      const { network, other, controller } = await loadFixture(fixture);

      const userOp: UserOperation = {
        sender: controller.address,
        nonce: 0,
        initCode: [],
        callData: [],
        callGasLimit: 0,
        verificationGasLimit: 0,
        preVerificationGas: 0,
        maxFeePerGas: 0,
        maxPriorityFeePerGas: 0,
        paymasterAndData: [],
        signature: [],
      };

      const userOpHash = getUserOperationHash(
        userOp,
        await controller.entryPoint(),
        network.chainId
      );

      await expect(
        controller.connect(other).validateUserOp(userOp, userOpHash, 0)
      ).to.be.revertedWith("C: caller must be the entry point");
    });

    it("success", async () => {
      const { network, owner, other, controller, controlledAccount } =
        await loadFixture(fixture);

      {
        const tx = await owner.sendTransaction({
          to: controlledAccount.address,
          value: ethers.utils.parseEther("1"),
        });
        await tx.wait();
      }

      const block = await ethers.provider.getBlock("latest");
      const entryPointAddress = await controller.entryPoint();

      const callData = controller.interface.encodeFunctionData("invoke", [
        controlledAccount.address,
        other.address,
        ethers.utils.parseEther("1"),
        [],
      ]);
      const maxPriorityFeePerGas = ethers.utils.parseUnits("1", "gwei");

      const userOp: UserOperation = {
        sender: controller.address,
        nonce: ethers.utils.concat([
          controlledAccount.address,
          "0x0000000000000000",
        ]),
        initCode: [],
        callData: callData,
        callGasLimit: await ethers.provider.estimateGas({
          from: entryPointAddress,
          to: controller.address,
          data: callData,
        }),
        verificationGasLimit: 100_000,
        preVerificationGas: 21_000,
        maxFeePerGas: block.baseFeePerGas!.add(maxPriorityFeePerGas),
        maxPriorityFeePerGas: maxPriorityFeePerGas,
        paymasterAndData: [],
        signature: [],
      };

      const userOpHash = getUserOperationHash(
        userOp,
        entryPointAddress,
        network.chainId
      );

      userOp.signature = await owner.signMessage(userOpHash);

      // valid
      expect(
        await controller.callStatic.validateUserOp(userOp, userOpHash, 0)
      ).to.equal(0);

      userOp.signature = await other.signMessage(userOpHash);

      // invalid
      expect(
        await controller.callStatic.validateUserOp(userOp, userOpHash, 0)
      ).to.equal(1);
    });
  });

  describe("invoke", () => {
    it("failure: caller must be the entry point", async () => {
      const { other, controller, controlledAccount } = await loadFixture(
        fixture
      );

      await expect(
        controller
          .connect(other)
          .invoke(
            controlledAccount.address,
            ethers.constants.AddressZero,
            0,
            []
          )
      ).to.be.revertedWith("C: caller must be the entry point");
    });

    it("success", async () => {
      const { owner, other, controller, controlledAccount } = await loadFixture(
        fixture
      );

      // send 1 ETH from owner to controlledAccount
      {
        const tx = await owner.sendTransaction({
          to: controlledAccount.address,
          value: ethers.utils.parseEther("1"),
        });
        await tx.wait();
      }

      const otherBalanceBefore = await ethers.provider.getBalance(
        other.address
      );
      const controlledAccountBalanceBefore = await ethers.provider.getBalance(
        controlledAccount.address
      );

      expect(controlledAccountBalanceBefore).to.equal(
        ethers.utils.parseEther("1")
      );

      // send 0.1 ETH from controlledAccount to other
      {
        const tx = await controller.invoke(
          controlledAccount.address,
          other.address,
          ethers.utils.parseEther("0.1"),
          []
        );
        await tx.wait();
      }

      const otherBalanceAfter = await ethers.provider.getBalance(other.address);
      const controlledAccountBalanceAfter = await ethers.provider.getBalance(
        controlledAccount.address
      );

      expect(otherBalanceAfter).to.equal(
        otherBalanceBefore.add(ethers.utils.parseEther("0.1"))
      );
      expect(controlledAccountBalanceAfter).to.equal(
        ethers.utils.parseEther("0.9")
      );
    });
  });
});
