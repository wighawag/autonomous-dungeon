// SPDX-License-Identifier: AGPL-3.0
pragma solidity ^0.8.20;

import "./UsingInternalTimestamp.sol";

abstract contract UsingControlledTime is UsingInternalTimestamp {
    event TimeIncreased(uint256 newTime, uint256 delta);

    function timestamp() external view returns (uint256) {
        return _timestamp();
    }

    function increaseTime(uint256 delta) external {
        address adminAddress;
        assembly {
            adminAddress := sload(0xb53127684a568b3173ae13b9f8a6016e243e63b6e8ee1178d6a717850b5d6103)
        }
        // require(msg.sender == adminAddress, "NOT_ADMIN");
        uint256 newDelta = _delta() + delta;
        assembly {
            sstore(0x112c413de07a110ce0a9ace0c01e41b5b59462770325b042f0dc72c337f55f2, newDelta)
        }
        emit TimeIncreased(_timestamp(), delta);
    }

    function _delta() internal view returns (uint256 delta) {
        assembly {
            // keccak256("time") - 1
            delta := sload(0x112c413de07a110ce0a9ace0c01e41b5b59462770325b042f0dc72c337f55f2)
        }
    }
}
