import {expect} from './chai-setup';
import {ethers, deployments, getUnnamedAccounts} from 'hardhat';
import {setupUsers} from './utils';
import { time } from "@nomicfoundation/hardhat-network-helpers";

const setup = deployments.createFixture(async () => {
	await deployments.fixture('GreetingsRegistry');
	const contracts = {
		GreetingsRegistry: await ethers.getContract('GreetingsRegistry'),
	};
	const users = await setupUsers(await getUnnamedAccounts(), contracts);
	return {
		...contracts,
		users,
	};
});
describe('GreetingsRegistry', function () {
	it('setMessage works', async function () {
		const {users, GreetingsRegistry} = await setup();
		const testMessage = 'Hello World';
		const lastBlockTime = await time.latest();
		const timestamp = lastBlockTime + 10;
		await time.setNextBlockTimestamp(timestamp)
		await expect(users[0].GreetingsRegistry.setMessage(testMessage, 1))
			.to.emit(GreetingsRegistry, 'MessageChanged')
			.withArgs(users[0].address, timestamp, testMessage, 1);
	});
});