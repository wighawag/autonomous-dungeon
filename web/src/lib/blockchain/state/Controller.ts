import {logs} from 'named-logs';
import {type CellPosition, type CellAction, generateEpoch, cellPositionFrom} from 'jolly-roger-common';
import {encodePacked, keccak256} from 'viem';
import {accountData} from '$lib/web3';
import {derived, writable} from 'svelte/store';
import {time} from '$lib/time';
import {state} from './State';

const logger = logs('controller');

const TOTAL = 24 * 3600;
const ACTION_PERIOD = 23 * 3600;
const START_TIMESTAMP = 0;

export function initController() {
	const max = 64;

	let $dungeon = generateEpoch(getEpochHash(0));
	const dungeon = writable($dungeon);

	state.subscribe((v) => {
		// if (v)
		// TODO update epochHash
	});
	//for now it is based on time
	time.subscribe((v) => {
		const currentHash = getEpochHash(getEpoch(v));
		if (currentHash !== $dungeon.epoch.hash) {
			$dungeon = generateEpoch(currentHash);
			dungeon.set($dungeon);
		}
	});

	function move(to: CellPosition) {
		const $state = accountData.$offchainState;
		if ($state.actions.length < 64 && $dungeon.isValidCellMove($state.position, to)) {
			accountData.offchainState.move($dungeon.epoch, to);
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

	function getEpochHash(epochToGenerate: number) {
		return keccak256(encodePacked(['uint256'], [BigInt(epochToGenerate)]));
	}

	if (typeof document !== 'undefined') {
		window.addEventListener('keydown', (ev) => {
			logger.info(ev);
			const $state = accountData.$offchainState;
			if (ev.key === 'ArrowLeft' || ev.key === 'Left' || ev.key === 'a') {
				move(cellPositionFrom($state.position, -1, 0));
			} else if (ev.key === 'ArrowUp' || ev.key === 'Up' || ev.key === 'w') {
				move(cellPositionFrom($state.position, 0, -1));
			} else if (ev.key === 'ArrowDown' || ev.key === 'Down' || ev.key === 's') {
				move(cellPositionFrom($state.position, 0, 1));
			} else if (ev.key === 'ArrowRight' || ev.key === 'Right' || ev.key === 'd') {
				move(cellPositionFrom($state.position, 1, 0));
			} else if (ev.key === 'Backspace') {
				back();
			}
		});
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
