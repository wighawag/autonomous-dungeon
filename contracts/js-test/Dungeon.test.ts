import {expect} from './chai-setup';
import {ethers, deployments, getUnnamedAccounts} from 'hardhat';
import {setupUsers} from './utils';
import { time } from "@nomicfoundation/hardhat-network-helpers";
import {keccak256, encodePacked} from 'viem';
import {bigIntIDToXY, xyToBigIntID} from 'jolly-roger-common'

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
		await expect(await Dungeon.callStatic["getEpochHash(uint256)"](epochToGenerate)).to.equals(keccak256(encodePacked(['uint256'], [BigInt(epochToGenerate)])))

		const lastBlockTime = await time.latest();
		const epoch =  Math.floor((lastBlockTime - 0) / (24 * 3600));
		const currentEpoch = (await Dungeon.callStatic["getEpoch()"]()).toString();
		await expect(currentEpoch).to.equals(epoch.toString());
		const currentEpochHash = await Dungeon.callStatic["getEpochHash()"]();
		const expectedEpochHash = keccak256(encodePacked(['uint256'], [BigInt(epoch)]));
		await expect(currentEpochHash).to.equals(expectedEpochHash)
	});


	it('roomID works', async function () {
		const {users, Dungeon} = await setup();
		const expectedRoomID45 = xyToBigIntID(4,5);
		const roomID45 = (await Dungeon.callStatic.roomID(4,5)).toString();
		expect(roomID45).to.equals(expectedRoomID45.toString())
	});

	it('-4,5 roomID works', async function () {
		const {users, Dungeon} = await setup();
		const expectedRoomID45 = xyToBigIntID(-4,5);
		const roomID45 = (await Dungeon.callStatic.roomID(-4,5)).toString();
		expect(roomID45).to.equals(expectedRoomID45.toString())
	});

	it('-4,-5 roomID works', async function () {
		const {users, Dungeon} = await setup();
		const expectedRoomID45 = xyToBigIntID(-4,-5);
		const roomID45 = (await Dungeon.callStatic.roomID(-4,-5)).toHexString();
		expect(roomID45).to.equals("0x" + expectedRoomID45.toString(16))
	});

	it('-4,5 roomID works', async function () {
		const {users, Dungeon} = await setup();
		const expectedRoomID45 = xyToBigIntID(-4,5);
		const roomID45 = (await Dungeon.callStatic.roomID(-4,5)).toString();
		expect(roomID45).to.equals(expectedRoomID45.toString())
	});

	it('-2300,-1 roomID works', async function () {
		const {users, Dungeon} = await setup();
		const expectedRoomID = xyToBigIntID(-2300,-1);
		console.log({expectedRoomID})
		const roomID45 = (await Dungeon.callStatic.roomID(-2300,-1)).toString();
		expect(roomID45).to.equals(expectedRoomID.toString())
	});

	it('-2300,-1 local roomID + roomCoords works', async function () {
		const {users, Dungeon} = await setup();
		const result = bigIntIDToXY(xyToBigIntID(-2300,-1));
		expect(result.x).to.equal(-2300);
		expect(result.y).to.equal(-1);
	});

	it('-2300,-1 remore roomID + roomCoords works', async function () {
		const {Dungeon} = await setup();	
		const roomID = (await Dungeon.callStatic.roomID(-2300,-1)).toString();
		const coords = (await Dungeon.callStatic.roomCoords(roomID));
		expect(coords.x).to.equal(-2300);
		expect(coords.y).to.equal(-1);
	});

	it('0,0 roomID works', async function () {
		const {users, Dungeon} = await setup();
		const expectedRoomID45 = xyToBigIntID(0,0);
		const roomID45 = (await Dungeon.callStatic.roomID(0,0)).toString();
		expect(roomID45).to.equals(expectedRoomID45.toString())
	});

	it('0,0 roomCoords works', async function () {
		const {users, Dungeon} = await setup();
		const expectedCoords = bigIntIDToXY(0n);
		const coords = (await Dungeon.callStatic.roomCoords(0));
		expect(coords.x).to.equals(expectedCoords.x)
		expect(coords.y).to.equals(expectedCoords.y)
	});

	it('INVALID -2300 roomCoords works', async function () {
		const {users, Dungeon} = await setup();
		const expectedCoords = bigIntIDToXY(-2300n);
		console.log({expectedCoords});
		const coords = (await Dungeon.callStatic.roomCoords(BigInt.asUintN(64, BigInt(-2300)).toString()));
		expect(coords.x).to.equals(expectedCoords.x)
		expect(coords.y).to.equals(expectedCoords.y)
	});
	
	it('18446744073709549316n roomCoords works', async function () {
		const {users, Dungeon} = await setup();
		const expectedCoords = bigIntIDToXY(18446744073709549316n);
		console.log({expectedCoords});
		const coords = (await Dungeon.callStatic.roomCoords(18446744073709549316n));
		expect(coords.x).to.equals(expectedCoords.x)
		expect(coords.y).to.equals(expectedCoords.y)
	});

	it('18446744069414584320n roomCoords works', async function () {
		const {users, Dungeon} = await setup();
		const expectedCoords = bigIntIDToXY(18446744069414584320n);
		console.log({expectedCoords});
		const coords = (await Dungeon.callStatic.roomCoords(18446744069414584320n));
		expect(coords.x).to.equals(expectedCoords.x)
		expect(coords.y).to.equals(expectedCoords.y)
	})

	it('18446744069414584321n roomCoords works', async function () {
		const {users, Dungeon} = await setup();
		const expectedCoords = bigIntIDToXY(18446744069414584321n);
		console.log({expectedCoords});
		const coords = (await Dungeon.callStatic.roomCoords(18446744069414584321n));
		expect(coords.x).to.equals(expectedCoords.x)
		expect(coords.y).to.equals(expectedCoords.y)
	})
	

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


	/*
	 function roomID(int32 x, int32 y) public pure returns (uint256) {
        //  BigInt(x) + 2n ** 31n + ((BigInt(y) + 2n ** 31n) << 32n);
        return uint256(int256(x)) + uint256(int256(y) << 32);
    }

    function roomCoords(uint256 id) public pure returns (int32 x, int32 y) {
        x = int32(int256(id & 0xFFFFFFFF));
        y = int32(int256(id >> 32));
        // x = int32(uint32(bytes4(id)));
        // y = int32(int256(id >> 32));
    }
	*/

	
});

// export function xyToBigIntID(x: number, y: number): bigint {
// 	// we add half the range to avoid dealing with negative
// 	// TODO improve thta handling
// 	const bn = BigInt(x) + 2n ** 31n + ((BigInt(y) + 2n ** 31n) << 32n);
// 	return bn;
// }