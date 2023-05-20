import {writable} from 'svelte/store';
import {connection, devProvider} from './web3';

let timestamp = Date.now();
const _time = writable(timestamp, (set) => {
	const interval = setInterval(async () => {
		if (typeof window !== 'undefined' && devProvider) {
			const block = await devProvider.request({
				method: 'eth_getBlockByNumber',
				params: ['latest', false],
			});
			timestamp = (await connection.$state.provider?.syncTime(block)) || Math.floor(Date.now() / 1000);
		} else {
			timestamp = connection.$state.provider?.currentTime() || Math.floor(Date.now() / 1000);
		}

		set(timestamp);
	}, 1000);
	return () => clearInterval(interval);
});

export const time = {
	subscribe: _time.subscribe,
	get now() {
		return timestamp;
	},
};
