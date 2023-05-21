import {logs} from 'named-logs';
// import {type CellPosition, type CellAction, generateEpoch, cellPositionFrom, getEpochHash} from 'jolly-roger-common';

import {accountData} from '$lib/web3';
import {derived, writable} from 'svelte/store';
import {time} from '$lib/time';
import {gameState, type GameState} from './GameState';
import {generateEpoch, getEpochHash, roomPositionFrom, type RoomPosition} from 'jolly-roger-common';

const logger = logs('controller');

const TOTAL = 24 * 3600;
const ACTION_PERIOD = 23 * 3600;
const START_TIMESTAMP = 0;

export function initController() {
	const max = 64;

	// TODO remove this
	let $dungeon = generateEpoch(getEpochHash(0));
	const dungeon = writable($dungeon);

	let $gameState: GameState | undefined;
	gameState.subscribe((v) => {
		$gameState = v;
		const currentHash = $gameState.epoch.hash;
		if (currentHash !== $dungeon.epoch.hash) {
			$dungeon = generateEpoch(currentHash);
			accountData.offchainState.reset();
			dungeon.set($dungeon);
		}
	});
	// function move(to: CellPosition) {
	// 	if (!$gameState) {
	// 		throw new Error(`Game not initialised`);
	// 	}
	// 	if (!$gameState.player) {
	// 		throw new Error(`No player`);
	// 	}
	// 	const $state = accountData.$offchainState;
	// 	if ($state.actions.length < 64 && $dungeon.isValidCellMove($gameState.player.cellPosition, to)) {
	// 		accountData.offchainState.move($gameState.epoch, $gameState.player.cellPosition, to);
	// 	}
	// }
	function move(to: RoomPosition) {
		if (!$gameState) {
			throw new Error(`Game not initialised`);
		}
		if (!$gameState.player) {
			throw new Error(`No player`);
		}
		const $state = accountData.$offchainState;
		if ($state.actions.length < 64 && $dungeon.isValidMove($gameState.player.position, to)) {
			accountData.offchainState.move($gameState.epoch, $gameState.player.position, to);
		}
	}

	function reset() {
		accountData.offchainState.reset();
	}

	function back() {
		accountData.offchainState.back();
	}

	function getEpoch(time: number) {
		return Math.floor((time - START_TIMESTAMP) / TOTAL);
	}

	if (typeof document !== 'undefined') {
		window.addEventListener('keydown', (ev) => {
			logger.info(ev);
			if (!$gameState) {
				throw new Error(`Game not initialised`);
			}
			if (!$gameState.player) {
				throw new Error(`No player`);
			}
			if (ev.key === 'ArrowLeft' || ev.key === 'Left' || ev.key === 'a') {
				move(roomPositionFrom($gameState.player.position, -1, 0));
			} else if (ev.key === 'ArrowUp' || ev.key === 'Up' || ev.key === 'w') {
				move(roomPositionFrom($gameState.player.position, 0, -1));
			} else if (ev.key === 'ArrowDown' || ev.key === 'Down' || ev.key === 's') {
				move(roomPositionFrom($gameState.player.position, 0, 1));
			} else if (ev.key === 'ArrowRight' || ev.key === 'Right' || ev.key === 'd') {
				move(roomPositionFrom($gameState.player.position, 1, 0));
			} else if (ev.key === 'Backspace') {
				back();
			}
		});
	}

	function onRoomClicked(x: number, y: number, cx: number, cy: number) {
		console.log(x, y, cx, cy);
	}

	return {
		move,
		reset,
		back,
		max,
		dungeon: {
			subscribe: dungeon.subscribe,
			get $state() {
				return $dungeon;
			},
		},
		onRoomClicked,
	};
}

export const controller = initController();

export const phase = derived(time, ($time) => {
	const epoch = Math.floor(($time - START_TIMESTAMP) / TOTAL);
	const epochStartTime = epoch * TOTAL;
	const timePassed = $time - epochStartTime;
	const isActionPhase = timePassed < ACTION_PERIOD;
	const timeLeftToCommit = ACTION_PERIOD - timePassed;
	const timeLeftToReveal = isActionPhase ? -1 : TOTAL - timePassed;
	const timeLeftToEpochEnd = TOTAL - timePassed;

	return {
		comitting: isActionPhase,
		epoch,
		timeLeftToReveal,
		timeLeftToCommit,
		timeLeftToEpochEnd,
	};
});
