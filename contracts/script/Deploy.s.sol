// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.20;

import {DeployScript, Deployer} from "forge-deploy/DeployScript.sol";
import {
    ProxiedDeployerFunctions,
    ProxyOptionsOnTag,
    FullProxyOptions
} from "../generated/deployer/ProxiedDeployerFunctions.g.sol";
import {Dungeon} from "../src/Dungeon.sol";
import {Characters} from "../src/Characters.sol";

import "forge-std/console.sol";

contract Deployments is DeployScript {
    using ProxiedDeployerFunctions for Deployer;

    function deploy() external returns (Dungeon) {
        Characters characters = Characters(deployer.getAddress("Characters"));
        if (address(characters) == address(0)) {
            characters = deployer.deploy_Characters(
                "Characters", ProxyOptionsOnTag({onTag: "", owner: vm.envAddress("DEPLOYER")})
            );
        }

        // TODO better handling of implementation with constructor params
        deployer.ignoreDeployment("Dungeon_Implementation");
        Dungeon implementation = deployer.deploy_Dungeon(
            "Dungeon_Implementation", characters, ProxyOptionsOnTag({onTag: "", owner: vm.envAddress("DEPLOYER")})
        );
        return deployer.deploy_Dungeon(
            "Dungeon",
            characters,
            FullProxyOptions({
                implementation: address(implementation),
                onTag: "testnet",
                owner: vm.envAddress("DEPLOYER")
            })
        );
    }
}
