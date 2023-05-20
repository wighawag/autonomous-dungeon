// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

import {Test} from "forge-std/Test.sol";
import {Dungeon} from "src/Dungeon.sol";
import {Deployments} from "script/Deploy.s.sol";

contract DungeonTest is Test {
    Dungeon public dungeon;

    function setUp() public {
        dungeon = new Deployments().deploy();
    }
}
