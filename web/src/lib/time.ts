import {writable} from 'svelte/store';
import {connection} from './web3';

let timestamp = Date.now();
const _time = writable(timestamp, (set) => {
	const interval = setInterval(() => {
		timestamp = connection.$state.provider?.currentTime() || Math.floor(Date.now() / 1000);
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
