import {logs} from 'named-logs';
// import {type CellPosition, type CellAction, generateEpoch, cellPositionFrom, getEpochHash} from 'jolly-roger-common';

import {accountData} from '$lib/web3';
import {get, writable} from 'svelte/store';
import {START_TIMESTAMP, TOTAL, phase, time} from '$lib/time';
import {gameState, type GameState} from './GameState';
import {generateEpoch, getEpochHash, roomPositionFrom, type RoomPosition, type Room} from 'jolly-roger-common';
import type {RoomAction} from 'jolly-roger-common';

const logger = logs('controller');

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
			dungeon.set($dungeon);
		}
		if (accountData.$offchainState.epoch?.hash && accountData.$offchainState.epoch?.hash != currentHash) {
			accountData.offchainState.reset();
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

	function pickTreasure(pick: boolean) {
		if (!$gameState) {
			throw new Error(`Game not initialised`);
		}
		if (!$gameState.player) {
			throw new Error(`No player`);
		}
		const $state = accountData.$offchainState;
		if (
			$state.actions.length < 64 &&
			$dungeon.getRoom($gameState.player.position.x, $gameState.player.position.y).treasure
		) {
			accountData.offchainState.pickTreasure($gameState.epoch, $gameState.player.position, pick);
		}
	}

	function reset() {
		accountData.offchainState.reset();
	}

	function back() {
		accountData.offchainState.back();
	}

	function getEpoch(time: number) {
		const totalTimePassed = time - START_TIMESTAMP;
		const epoch = Math.floor(totalTimePassed / TOTAL + 1);
		return epoch;
	}

	if (typeof document !== 'undefined') {
		const windowAsAny = window as any;
		if (!windowAsAny._controllerAttached) {
			windowAsAny._controllerAttached = true;
			window.addEventListener('keydown', (ev) => {
				if (get(phase).comitting) {
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
				}
			});
		}
	}

	function onRoomClicked(x: number, y: number, cx: number, cy: number) {
		const position = $gameState?.playerCharacter?.position;
		if (!position) {
			console.log(`no position`, x, y, cx, cy);
			return;
		}

		const goal = $dungeon.getRoom(position.x, position.y);
		const start = $dungeon.getRoom(x, y);
		const frontier: Room[] = [];
		frontier.push(start);
		const came_from: Map<Room, Room> = new Map(); // path A->B is stored as came_from[B] == A
		// came_from[clicked] = null

		let found = false;
		while (frontier.length > 0) {
			const current = frontier.shift() as Room;
			if (current.x === goal.x && current.y === goal.y) {
				found = true;
				break;
			}

			const neighboors: Room[] = [];
			if (current.exits[0]) {
				const coords = roomPositionFrom(current, 0, -1);
				neighboors.push($dungeon.getRoom(coords.x, coords.y));
			}
			if (current.exits[1]) {
				const coords = roomPositionFrom(current, 1, 0);
				neighboors.push($dungeon.getRoom(coords.x, coords.y));
			}
			if (current.exits[2]) {
				const coords = roomPositionFrom(current, 0, 1);
				neighboors.push($dungeon.getRoom(coords.x, coords.y));
			}
			if (current.exits[3]) {
				const coords = roomPositionFrom(current, -1, 0);
				neighboors.push($dungeon.getRoom(coords.x, coords.y));
			}
			for (const next of neighboors) {
				if (!came_from.get(next)) {
					frontier.push(next);
					came_from.set(next, current);
				}
			}
		}
		if (found) {
			let backward_current = goal;
			const actions: RoomAction[] = [];
			while (backward_current != start) {
				const from = backward_current;
				backward_current = came_from.get(backward_current) as Room;
				actions.push({
					type: 'move',
					treasure: undefined,
					from: {
						x: from.x,
						y: from.y,
					},
					to: {
						x: backward_current.x,
						y: backward_current.y,
					},
				});
			}
			accountData.offchainState.set($gameState!.epoch, actions);
		}
	}

	return {
		move,
		reset,
		back,
		pickTreasure,
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
