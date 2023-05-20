import {writable} from 'svelte/store';
import {logs} from 'named-logs';
import {type Position, type Action, generateEpoch} from 'jolly-roger-common';
import {encodePacked, keccak256} from 'viem';
const logger = logs('offchain-state');

export type OffchainState = {
	position: Position;
	actions: Action[];
};

const TOTAL = 24 * 3600;
const ACTION_PERIOD = 23 * 3600;
const START_TIMESTAMP = 0;
export function initCharacter() {
	const max = 64;
	const $state: OffchainState = {
		position: {cx: 0, cy: 0},
		actions: [],
	};
	const store = writable($state);

	let dungeon = generateEpoch(epochHash());

	function move(to: Position) {
		if ($state.actions.length < 64 && dungeon.isValidMove($state.position, to)) {
			$state.actions.push({type: 'move', to, from: {...$state.position}});
			$state.position.cx = to.cx;
			$state.position.cy = to.cy;
			store.set($state);
		}
	}

	function reset() {
		const firstAction = $state.actions[0];
		$state.actions.splice(0, $state.actions.length);
		if (firstAction) {
			$state.position.cx = firstAction.from.cx;
			$state.position.cy = firstAction.from.cy;
		} else {
			$state.position.cx = 0;
			$state.position.cy = 0;
		}

		store.set($state);
	}

	function back() {
		if ($state.actions.length > 0) {
			$state.position.cx = $state.actions[$state.actions.length - 1].from.cx;
			$state.position.cy = $state.actions[$state.actions.length - 1].from.cy;
		}
		$state.actions.splice($state.actions.length - 1, 1);
		store.set($state);
	}

	function timestamp() {
		return Math.floor(Date.now() / 1000);
	}

	function epoch() {
		return Math.floor((timestamp() - START_TIMESTAMP) / TOTAL);
	}

	function isActionPeriod() {
		return timestamp() - epoch() * TOTAL < ACTION_PERIOD;
	}

	function epochHash(epochToGenerate?: number) {
		if (!epochToGenerate) {
			epochToGenerate = epoch();
		}
		// TODO fetch from contract
		return keccak256(encodePacked(['uint256'], [BigInt(epochToGenerate)]));
	}

	function getView(left: number, top: number, right: number, bottom: number) {
		const rooms = [];
		for (let y = top; y <= bottom; y++) {
			for (let x = left; x <= right; x++) {
				const room = dungeon.getRoom(x, y);
				rooms.push(room);
			}
		}
	}

	return {
		$state,
		subscribe: store.subscribe,
		move,
		reset,
		back,
		max,
		epochHash,
		dungeon,
	};
}

export const offchainState = initCharacter();

function positionFrom(position: Position, x: 0 | -1 | 1, y: 0 | -1 | 1) {
	return {
		cx: position.cx + x,
		cy: position.cy + y,
	};
}

if (typeof document !== 'undefined') {
	window.addEventListener('keydown', (ev) => {
		logger.info(ev);
		if (ev.key === 'ArrowLeft' || ev.key === 'Left' || ev.key === 'a') {
			offchainState.move(positionFrom(offchainState.$state.position, -1, 0));
		} else if (ev.key === 'ArrowUp' || ev.key === 'Up' || ev.key === 'w') {
			offchainState.move(positionFrom(offchainState.$state.position, 0, -1));
		} else if (ev.key === 'ArrowDown' || ev.key === 'Down' || ev.key === 's') {
			offchainState.move(positionFrom(offchainState.$state.position, 0, 1));
		} else if (ev.key === 'ArrowRight' || ev.key === 'Right' || ev.key === 'd') {
			offchainState.move(positionFrom(offchainState.$state.position, 1, 0));
		} else if (ev.key === 'Backspace') {
			offchainState.back();
		}
	});
}
