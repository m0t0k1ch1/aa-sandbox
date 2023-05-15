// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.19;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

import "./ControlledAccount.sol";
import "./IAccount.sol";
import "./IController.sol";
import "./UserOperation.sol";

contract Controller is IController, Ownable {
    using ECDSA for bytes32;

    uint256 private constant SIG_VALIDATION_FAILED = 1;

    address public immutable entryPoint;

    mapping(address account => address owner) private _owners;

    modifier onlyMyself() {
        require(msg.sender == address(this), "C: caller must be myself");
        _;
    }

    modifier onlyEntryPoint() {
        require(msg.sender == entryPoint, "C: caller must be the entry point");
        _;
    }

    constructor(address entryPoint_) {
        entryPoint = entryPoint_;
    }

    function getAccountAddress(bytes32 salt_) external view returns (address) {
        return
            address(
                uint160(
                    uint256(
                        keccak256(
                            abi.encodePacked(
                                bytes1(0xff),
                                address(this),
                                salt_,
                                keccak256(
                                    abi.encodePacked(
                                        type(ControlledAccount).creationCode,
                                        uint256(uint160(address(this)))
                                    )
                                )
                            )
                        )
                    )
                )
            );
    }

    function createAccount(
        address owner_,
        bytes32 salt_
    ) external onlyOwner returns (address) {
        address account = address(
            new ControlledAccount{salt: salt_}(address(this))
        );

        _owners[account] = owner_;

        return account;
    }

    function ownerOf(address account_) external view returns (address) {
        return _owners[account_];
    }

    function validateUserOp(
        UserOperation calldata userOp_,
        bytes32 userOpHash_,
        uint256 missingAccountFunds_
    ) external onlyEntryPoint returns (uint256) {
        try this._validateUserOp(userOp_, userOpHash_) returns (
            address account,
            uint256 validationData
        ) {
            if (validationData == 0 && missingAccountFunds_ > 0) {
                try IAccount(account).deposit(missingAccountFunds_) {} catch {}
            }

            return validationData;
        } catch {
            return SIG_VALIDATION_FAILED;
        }
    }

    function _validateUserOp(
        UserOperation calldata userOp_,
        bytes32 userOpHash_
    ) external view onlyMyself returns (address, uint256) {
        (address account, , , ) = abi.decode(
            userOp_.callData[4:],
            (address, address, uint256, bytes)
        );

        if (address(uint160(userOp_.nonce >> 64)) != account) {
            return (account, SIG_VALIDATION_FAILED);
        }

        return (
            account,
            IAccount(account).isValidSignature(
                userOpHash_.toEthSignedMessageHash(),
                userOp_.signature
            ) == IERC1271.isValidSignature.selector
                ? 0
                : SIG_VALIDATION_FAILED
        );
    }

    function invoke(
        address account_,
        address to_,
        uint256 value_,
        bytes calldata data_
    ) external onlyEntryPoint {
        IAccount(account_).execute(to_, value_, data_);
    }
}
