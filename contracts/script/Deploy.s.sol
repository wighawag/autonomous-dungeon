// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.20;

import {DeployScript, Deployer, Deployment} from "forge-deploy/DeployScript.sol";
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

        // TODO forge-deploy provide type safe args encoder
        // bytes memory args = abi.encode(characters);
        // Deployment memory existingImpl = deployer.get("Dungeon_Implementation");
        // Dungeon implementation = Dungeon(existingImpl.addr);
        // console.logAddress(existingImpl.addr);
        // // TODO better handling of implementation with constructor params
        // bytes memory data = bytes.concat(vm.getCode("Dungeon.sol:Dungeon"), args);
        // if (
        //     existingImpl.addr == address(0)
        //         || keccak256(bytes.concat(existingImpl.bytecode, existingImpl.args)) != keccak256(data)
        // ) {
        //     console.log("different");
        //     deployer.ignoreDeployment("Dungeon_Implementation");
        //     implementation = deployer.deploy_Dungeon(
        //         "Dungeon_Implementation", characters, ProxyOptionsOnTag({onTag: "", owner: vm.envAddress("DEPLOYER")})
        //     );
        // } else {
        //     console.log("same");
        // }
        deployer.ignoreDeployment("Dungeon_Implementation");
        Dungeon implementation = deployer.deploy_TimeControlledDungeon(
            "Dungeon_Implementation", characters, ProxyOptionsOnTag({onTag: "", owner: vm.envAddress("DEPLOYER")})
        );
        return deployer.deploy_TimeControlledDungeon(
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
