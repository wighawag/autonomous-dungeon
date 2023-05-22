// SPDX-License-Identifier: AGPL-3.0
pragma solidity ^0.8.20;

import "./Dungeon.sol";
import "./Characters.sol";

contract TimeControlledDungeon is Dungeon {
    constructor(Characters characters) Dungeon(characters) {}
}
