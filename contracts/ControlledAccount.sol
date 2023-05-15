// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.19;

import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

import "./IAccount.sol";
import "./IController.sol";
import "./IERC4337EntryPoint.sol";

contract ControlledAccount is IAccount {
    using ECDSA for bytes32;

    IController private immutable _controller;

    modifier onlyController() {
        require(
            msg.sender == address(_controller),
            "CA: caller must be the controller"
        );
        _;
    }

    constructor(address controller_) {
        _controller = IController(controller_);
    }

    receive() external payable {}

    function isValidSignature(
        bytes32 hash_,
        bytes calldata signature_
    ) external view returns (bytes4) {
        require(
            hash_.recover(signature_) == _controller.ownerOf(address(this)),
            "CA: invalid signer"
        );

        return IERC1271.isValidSignature.selector;
    }

    function deposit(uint256 value_) external onlyController {
        IERC4337EntryPoint(_controller.entryPoint()).depositTo{value: value_}(
            address(_controller)
        );
    }

    function execute(
        address to_,
        uint256 value_,
        bytes calldata data_
    ) external onlyController {
        (bool success, bytes memory result) = to_.call{value: value_}(data_);
        if (!success) {
            assembly {
                revert(add(result, 32), mload(result))
            }
        }
    }
}
