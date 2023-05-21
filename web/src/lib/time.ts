import {writable} from 'svelte/store';
import {connection, devProvider} from './web3';

let timestamp = Date.now();
const _time = writable({timestamp, synced: false}, (set) => {
	let timeout: NodeJS.Timeout | undefined;
	async function getTime() {
		try {
			if (typeof window !== 'undefined' && devProvider) {
				const block = await devProvider.request({
					method: 'eth_getBlockByNumber',
					params: ['latest', false],
				});
				timestamp = (await connection.$state.provider?.syncTime(block)) || Math.floor(Date.now() / 1000);
			} else {
				timestamp = connection.$state.provider?.currentTime() || Math.floor(Date.now() / 1000);
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
