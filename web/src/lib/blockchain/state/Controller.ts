import {logs} from 'named-logs';
import {type CellPosition, type CellAction, generateEpoch, cellPositionFrom} from 'jolly-roger-common';
import {encodePacked, keccak256} from 'viem';
import {accountData} from '$lib/web3';

const logger = logs('controller');

const TOTAL = 24 * 3600;
const ACTION_PERIOD = 23 * 3600;
const START_TIMESTAMP = 0;
export function initController() {
	const max = 64;

	const epoch = {
		hash: getEpochHash(),
	};
	let dungeon = generateEpoch(epoch.hash);

	function move(to: CellPosition) {
		const $state = accountData.$offchainState;
		if ($state.actions.length < 64 && dungeon.isValidCellMove($state.position, to)) {
			// TODO epochHash from dungeon?
			accountData.offchainState.move(epoch, to);
		}
	}

	function reset() {
		accountData.offchainState.reset();
	}

	function back() {
		accountData.offchainState.back();
	}

	function timestamp() {
		return Math.floor(Date.now() / 1000);
	}

	function getEpoch() {
		return Math.floor((timestamp() - START_TIMESTAMP) / TOTAL);
	}

	function isActionPeriod() {
		return timestamp() - getEpoch() * TOTAL < ACTION_PERIOD;
	}

	function getEpochHash(epochToGenerate?: number) {
		if (!epochToGenerate) {
			epochToGenerate = getEpoch();
		}
		// TODO fetch from contract
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
		dungeon,
	};
}

export const controller = initController();
