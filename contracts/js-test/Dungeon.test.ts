import {expect} from './chai-setup';
import {ethers, deployments, getUnnamedAccounts} from 'hardhat';
import {setupUsers} from './utils';
import { time } from "@nomicfoundation/hardhat-network-helpers";
import {keccak256, encodePacked} from 'viem';

const setup = deployments.createFixture(async () => {
	await deployments.fixture('Dungeon');
	const contracts = {
		Dungeon: await ethers.getContract('Dungeon'),
	};
	const users = await setupUsers(await getUnnamedAccounts(), contracts);
	return {
		...contracts,
		users,
	};
});
describe('Dungeon', function () {

	it('epochHash works', async function () {
		const epochToGenerate = 1;
		const {users, Dungeon} = await setup();
		await expect(await Dungeon.callStatic["epochHash(uint256)"](epochToGenerate)).to.equals(keccak256(encodePacked(['uint256'], [BigInt(epochToGenerate)])))

		const lastBlockTime = await time.latest();
		const epoch =  Math.floor((lastBlockTime - 0) / (24 * 3600));
		const currentEpoch = (await Dungeon.callStatic["epoch()"]()).toString();
		await expect(currentEpoch).to.equals(epoch.toString());
		const currentEpochHash = await Dungeon.callStatic["epochHash()"]();
		const expectedEpochHash = keccak256(encodePacked(['uint256'], [BigInt(epoch)]));
		await expect(currentEpochHash).to.equals(expectedEpochHash)
	});


	it('roomID works', async function () {
		const {users, Dungeon} = await setup();
		const expectedRoomID45 = xyToBigIntID(4,5);
		const roomID45 = (await Dungeon.callStatic.roomID(4,5)).toString();
		expect(roomID45).to.equals(expectedRoomID45.toString())
	});


	it('roomHash works', async function () {
		const {users, Dungeon} = await setup();


		const expectedRoomID45 = xyToBigIntID(4,5);
		// const roomID45 = (await Dungeon.callStatic.roomID(4,5)).toString();
		// expect(roomID45).to.equals(expectedRoomID45.toString())

		const lastBlockTime = await time.latest();
		const epoch =  Math.floor((lastBlockTime - 0) / (24 * 3600));
		// const currentEpoch = (await Dungeon.callStatic["epoch()"]()).toString();
		// await expect(currentEpoch).to.equals(epoch.toString());
		// const currentEpochHash = await Dungeon.callStatic["epochHash()"]();
		const expectedEpochHash = keccak256(encodePacked(['uint256'], [BigInt(epoch)]));
		// await expect(currentEpochHash).to.equals(expectedEpochHash)

		const expectedRoomHash45 = keccak256(encodePacked(['bytes32', 'uint256'], [expectedEpochHash, expectedRoomID45]));
		const roomHash45 = await Dungeon.callStatic["roomHash(int32,int32)"](4, 5);
		expect(roomHash45).to.equals(expectedRoomHash45)
	});


	
});

export function xyToBigIntID(x: number, y: number): bigint {
	// we add half the range to avoid dealing with negative
	// TODO improve thta handling
	const bn = BigInt(x) + 2n ** 31n + ((BigInt(y) + 2n ** 31n) << 32n);
	return bn;
}