import {writable} from 'svelte/store';
import {logs} from 'named-logs';
const logger = logs('offchain-state');

export type Position = {
	x: number;
	y: number;
};

export type Action = {
	type: 'move';
	to: Position;
};

export type OffchainState = {
	position: Position;
	actions: Action[];
};

export function initCharacter() {
	const $state: OffchainState = {
		position: {x: 0, y: 0},
		actions: [],
	};
	const store = writable($state);

	function move(to: Position) {
		$state.actions.push({type: 'move', to});
		$state.position.x = to.x;
		$state.position.y = to.y;
		store.set($state);
	}

	return {
		$state,
		subscribe: store.subscribe,
		move,
	};
}

export const offchainState = initCharacter();

function positionFrom(position: Position, x: 0 | -1 | 1, y: 0 | -1 | 1) {
	return {
		x: position.x + x,
		y: position.y + y,
	};
}

if (typeof document !== 'undefined') {
	window.addEventListener('keydown', (ev) => {
		logger.info(ev);
		if (ev.key === 'ArrowLeft' || ev.key === 'Left') {
			offchainState.move(positionFrom(offchainState.$state.position, -1, 0));
		} else if (ev.key === 'ArrowUp' || ev.key === 'Up') {
			offchainState.move(positionFrom(offchainState.$state.position, 0, -1));
		} else if (ev.key === 'ArrowDown' || ev.key === 'Down') {
			offchainState.move(positionFrom(offchainState.$state.position, 0, 1));
		} else if (ev.key === 'ArrowRight' || ev.key === 'Right') {
			offchainState.move(positionFrom(offchainState.$state.position, 1, 0));
		}
	});
}
