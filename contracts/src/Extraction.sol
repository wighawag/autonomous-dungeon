// SPDX-License-Identifier: AGPL-3.0
pragma solidity ^0.8.20;

library Extraction {
    function value(bytes32 data, uint8 leastSignificantBit, uint8 size) internal pure returns (uint256) {
        return uint256((data >> leastSignificantBit)) % 2 ** size;
    }
}
