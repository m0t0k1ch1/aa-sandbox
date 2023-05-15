// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.19;

import "./IERC4337Account.sol";

interface IController is IERC4337Account {
    function entryPoint() external view returns (address);

    function ownerOf(address account) external view returns (address);
}
