import {writable} from 'svelte/store';
import {connection, devProvider} from './web3';
import {encodeFunctionData} from 'viem';
import {initialContractsInfos} from './config';

let timestamp = Date.now();
const _time = writable({timestamp, synced: false}, (set) => {
	let timeout: NodeJS.Timeout | undefined;
	async function getTime() {
		try {
			if (typeof window !== 'undefined' && devProvider) {
				const rawTimestamp = await devProvider.request({
					method: 'eth_call',
					params: [{data: '0xb80777ea', to: initialContractsInfos.contracts.Dungeon.address}],
				});
				timestamp = parseInt(rawTimestamp.slice(2), 16);

				// TODO offer option to use Dungeon time or blockTime

				// const block = await devProvider.request({
				// 	method: 'eth_getBlockByNumber',
				// 	params: ['latest', false],
				// });
				// timestamp = (await connection.$state.provider?.syncTime(block)) || Math.floor(Date.now() / 1000);
			} else {
				const rawTimestamp = await connection.$state.provider?.request({
					method: 'eth_call',
					params: [{data: '0xb80777ea', to: initialContractsInfos.contracts.Dungeon.address}],
				});
				if (rawTimestamp) {
					timestamp = parseInt(rawTimestamp.slice(2), 16);
				}

				// TODO offer option to use Dungeon time or blockTime

				// timestamp = connection.$state.provider?.currentTime() || Math.floor(Date.now() / 1000);
			}

			set({timestamp, synced: true});
		} finally {
			if (timeout) {
				timeout = setTimeout(getTime, 3000);
			}
		}
	}
	timeout = setTimeout(getTime, 3000);
	return () => {
		clearTimeout(timeout);
		timeout = undefined;
	};
});

export const time = {
	subscribe: _time.subscribe,
	get now() {
		return timestamp;
	},
};
