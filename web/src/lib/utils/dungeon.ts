import {contracts} from '$lib/web3/viem';

export async function increaseDungeonTime(numSeconds: number) {
	contracts.execute(async (contracts) => {
		await contracts.contracts.Dungeon.write({
			functionName: 'increaseTime',
			args: [BigInt(numSeconds)],
		});
	});
}
