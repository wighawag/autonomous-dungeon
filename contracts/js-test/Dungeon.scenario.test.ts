;
import {ethers, deployments, getUnnamedAccounts, network} from 'hardhat';
import {setupUsers} from './utils';
import type {Dungeon} from '../typechain-types/src/Dungeon'
import { encodeAbiParameters, keccak256 } from 'viem';
import crypto from 'crypto';
import type {EIP1193Block} from 'eip-1193';
import { xyToBigIntID } from 'jolly-roger-common';

const START_TIMESTAMP = 0;
const TOTAL = 24 * 3600;
const ACTION_PERIOD = 23 * 3600;

async function switchToRevealPhase() {
	const latestBlock = (await network.provider.request({method: 'eth_getBlockByNumber', params: ["latest", false]})) as EIP1193Block;

	const time = parseInt(latestBlock.timestamp.slice(2), 16);
	const totalTimePassed = time - START_TIMESTAMP;
	const epoch = Math.floor(totalTimePassed / TOTAL + 1);
	const epochStartTime = (epoch - 1) * TOTAL;
	const timePassed = time - epochStartTime;
	const isActionPhase = timePassed < ACTION_PERIOD;
	const timeLeftToCommit = ACTION_PERIOD - timePassed;
	const timeLeftToReveal = isActionPhase ? -1 : TOTAL - timePassed;
	const timeLeftToEpochEnd = TOTAL - timePassed;

	// console.log({
	// 	timeLeftToCommit,
	// 	time,
	// 	totalTimePassed,
	// 	timePassed,
	// 	epochStartTime,
	// 	isActionPhase
	// })
	await network.provider.request({method: 'evm_setNextBlockTimestamp', params: [`0x` + (time + timeLeftToCommit).toString(16)]})
}


function hashCommitment(actions: {pickTreasure: boolean, position: bigint}[], combatStance: number){
	const secret = (`0x` +
				[...crypto.getRandomValues(new Uint8Array(32))]
					.map((m) => ('0' + m.toString(16)).slice(-2))
					.join('')) as `0x${string}`;
			
					const commitmentHash = keccak256(
		encodeAbiParameters(
			[
				{type: 'bytes32', name: 'secret'},
				{
					type: 'tuple[]',
					components: [
						{
							name: 'position',
							type: 'uint64',
						},
						{
							name: 'pickTreasure',
							type: 'bool',
						},
					],
				},
				{type: 'uint16', name: 'combatStance'},
			],
			[secret, actions, combatStance]
		)
	).slice(0, 50) as `0x${string}`

	return {secret, hash: commitmentHash, actions, combatStance}
}
	

const setup = deployments.createFixture(async () => {
	await deployments.fixture('Dungeon');
	const contracts = {
		Dungeon: (await ethers.getContract('Dungeon')) as Dungeon,
	};
	const users = await setupUsers(await getUnnamedAccounts(), contracts);
	return {
		...contracts,
		users,
	};
});
describe('Dungeon', function () {


	it('can commit', async function () {
		const {users, Dungeon} = await setup();
		await users[0].Dungeon.enter({value: "1000000000000000"});
		await users[1].Dungeon.enter({value: "1000000000000000"});
		
		const commitment_0 = hashCommitment([{
			pickTreasure: true,
			position: xyToBigIntID(1,0)
		}], 7);
		const commitment_1 = hashCommitment([{
			pickTreasure: true,
			position: xyToBigIntID(1,0)
		}], 11);
		
		await users[0].Dungeon.makeCommitment(users[0].address, commitment_0.hash);
		await users[1].Dungeon.makeCommitment(users[1].address, commitment_1.hash);
		await switchToRevealPhase();
		await users[0].Dungeon.resolve(users[0].address, commitment_0.secret, commitment_0.actions, commitment_0.combatStance, "0x000000000000000000000000000000000000000000000000");
		await users[1].Dungeon.resolve(users[1].address, commitment_1.secret, commitment_1.actions, commitment_1.combatStance, "0x000000000000000000000000000000000000000000000000");

		const character_0 = await Dungeon.callStatic.characters(users[0].address);
		const character_1 = await Dungeon.callStatic.characters(users[1].address);
		console.log({
			character_0,
			character_1
		})

		const goldBattle = await Dungeon.callStatic.goldBattles(xyToBigIntID(1,0));
		console.log(goldBattle)
	});

	
});
