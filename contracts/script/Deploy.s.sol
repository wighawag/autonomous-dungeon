// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.20;

import {DeployScript, Deployer} from "forge-deploy/DeployScript.sol";
import {ProxiedDeployerFunctions, ProxyOptionsOnTag} from "generated/deployer/ProxiedDeployerFunctions.g.sol";
import {Dungeon} from "src/Dungeon.sol";

contract Deployments is DeployScript {
    using ProxiedDeployerFunctions for Deployer;

    function deploy() external returns (Dungeon) {
        return
            deployer.deploy_Dungeon("Dungeon", ProxyOptionsOnTag({onTag: "testnet", owner: vm.envAddress("DEPLOYER")}));
    }
}
