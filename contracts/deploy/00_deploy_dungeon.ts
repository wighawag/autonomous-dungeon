import {HardhatRuntimeEnvironment} from 'hardhat/types';
import {DeployFunction} from 'hardhat-deploy/types';

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
	const {deployer} = await hre.getNamedAccounts();
	const {deploy} = hre.deployments;
	const useProxy = true; // !hre.network.live;

	const Characters = await deploy("Characters", {from: deployer});

	// proxy only in non-live network (localhost and hardhat network) enabling HCR (Hot Contract Replacement)
	// in live network, proxy is disabled and constructor is invoked
	await deploy('Dungeon', {
		from: deployer,
		contract: 'TimeControlledDungeon',
		proxy: useProxy && 'postUpgrade',
		args: [Characters.address],
		log: true,
		autoMine: true, // speed up deployment on local network (ganache, hardhat), no effect on live networks
	});

	return !useProxy; // when live network, record the script as executed to prevent rexecution
};
export default func;
func.id = 'deploy_Dungeon'; // id required to prevent reexecution
func.tags = ['Dungeon'];