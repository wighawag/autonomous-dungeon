// SPDX-License-Identifier: AGPL-3.0
pragma solidity ^0.8.20;

abstract contract UsingInternalTimestamp {
    function _timestamp() internal view virtual returns (uint256);
}
