// SPDX-License-Identifier: AGPL-3.0
pragma solidity ^0.8.20;

import "./Dungeon.sol";
import "./Characters.sol";
import "./UsingControlledTime.sol";

contract TimeControlledDungeon is Dungeon, UsingControlledTime {
    constructor(Characters characters) Dungeon(characters) {}

    // TODO could we move that into UsingControlledTime
    function _timestamp() internal view virtual override(Dungeon, UsingInternalTimestamp) returns (uint256) {
        return block.timestamp + _delta();
    }
}
