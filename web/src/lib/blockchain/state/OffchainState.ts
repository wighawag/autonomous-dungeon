import {writable} from 'svelte/store';
import {logs} from 'named-logs';
import {encodePacked, keccak256} from 'viem';
const logger = logs('offchain-state');

export type Position = {
	cx: number;
	cy: number;
};

export type Action = {
	type: 'move';
	from: Position; // not really needed, // TODO remove
	to: Position;
};

export type OffchainState = {
	position: Position;
	actions: Action[];
};

export function direction(from: Position, to: Position): 0 | 1 | 2 | 3 | undefined {
	const x_diff = to.cx - from.cx;
	const y_diff = to.cy - from.cy;
	if (x_diff === 0) {
		if (y_diff === 1) {
			return 2;
		} else if (y_diff === -1) {
			return 0;
		} else {
			return undefined;
		}
	} else if (from.cy == from.cy) {
		if (x_diff === 1) {
			return 1;
		} else if (x_diff === -1) {
			return 3;
		} else {
			return undefined;
		}
	} else {
		return undefined;
	}
}

export function getRoomFromCell(x: number, y: number): Room {
	return getRoom(Math.floor((x + 1) / 3), Math.floor((y + 1) / 3));
}

export function isValidMove(from: Position, to: Position) {
	const dir = direction(from, to);
	if (typeof dir !== 'number') {
		return false;
	}
	const from_room = getRoomFromCell(from.cx, from.cy);
	const to_room = getRoomFromCell(to.cx, to.cy);
	if (from_room === to_room) {
		return true;
	} else {
		return from_room.exits[dir]; //  && (from.cx % 3 === 0 || from.cy % 3 === 0);
	}
}

export function initCharacter() {
	const max = 64;
	const $state: OffchainState = {
		position: {cx: 0, cy: 0},
		actions: [],
	};
	const store = writable($state);

	function move(to: Position) {
		if ($state.actions.length < 64 && isValidMove($state.position, to)) {
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

	const TOTAL = 24 * 3600;
	const ACTION_PERIOD = 23 * 3600;
	const START_TIMESTAMP = 0;

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

	return {
		$state,
		subscribe: store.subscribe,
		move,
		reset,
		back,
		max,
		epochHash,
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

export type RawRoom = {
	// north, east, west, south
	exits: [boolean, boolean, boolean, boolean];
	chest: boolean;
	monster: boolean;
};

export type Room = RawRoom & {
	x: number;
	y: number;
};

// using 64 bits room id
const leftMostBit = BigInt('0x8000000000000000');
const bn32 = BigInt('0x10000000000000000');
export function bigIntIDToXYID(position: string) {
	const bn = BigInt(position);
	const x = BigInt.asUintN(32, bn) - 2n ** 31n;
	const y = (bn >> 32n) - 2n ** 31n;
	const rx = x >= leftMostBit ? -(bn32 - x) : x;
	const ry = y >= leftMostBit ? -(bn32 - y) : y;
	return '' + rx + ',' + ry;
}

export function xyToXYID(x: number, y: number) {
	return '' + x + ',' + y;
}

export function xyToBigIntID(x: number, y: number): bigint {
	// we add half the range to avoid dealing with negative
	// TODO improve thta handling
	const bn = BigInt(x) + 2n ** 31n + ((BigInt(y) + 2n ** 31n) << 32n);
	return bn;
}

export function value(data: string, leastSignificantBit: number, size: number): number {
	return parseInt(((BigInt(data) >> BigInt(leastSignificantBit)) % 2n ** BigInt(size)).toString());
}

export function value8Mod(data: string, leastSignificantBit: number, mod: number): number {
	return parseInt(((BigInt(data) >> BigInt(leastSignificantBit)) % BigInt(mod)).toString());
}

const raw_room_cache: {[coords: string]: RawRoom} = {};
export function getRawRoom(x: number, y: number): RawRoom {
	const key = `${x},${y}`;

	let room = raw_room_cache[key];
	if (!room) {
		const epochHash = offchainState.epochHash();
		const roomID = xyToBigIntID(x, y);
		const roomHashData = keccak256(encodePacked(['bytes32', 'uint64'], [epochHash, roomID]));

		// take from the first 0 (right side) and take 2 bits to give you a number between [0,2**2[
		const firstExit = value(roomHashData, 0, 2);

		const hasSecondExit = value(roomHashData, 2, 5) < 3; // take 32 values [0,2**5[
		const secondExitRaw = value(roomHashData, 7, 2); // this has one value too much. if
		const secondExit = hasSecondExit && secondExitRaw < 3 ? secondExitRaw : 4;
		// const thirdExist = firstExit + ((Math.floor(Math.random() * 3) + 1) % 4);
		// const fourthExit = firstExit + ((Math.floor(Math.random() * 3) + 1) % 4);

		const chest = value(roomHashData, 9, 10) < 7; // take 1024 values [0,2**10[
		const monsterRaw = value(roomHashData, 19, 7); // take 128 values [0,2**7[
		const monster = chest ? monsterRaw < 30 : monsterRaw < 1;

		room = {
			exits: [
				firstExit === 0 || secondExit === 0,
				firstExit === 1 || secondExit === 1,
				firstExit === 2 || secondExit === 2,
				firstExit === 3 || secondExit === 3,
			] as [boolean, boolean, boolean, boolean],
			chest,
			monster,
		};
		raw_room_cache[key] = room;
	}

	// console.log({room, firstExit, secondExit});
	return room;
}

const room_cache: {[coords: string]: Room} = {};

export function getRoom(x: number, y: number): Room {
	const key = `${x},${y}`;

	let room = room_cache[key];
	if (!room) {
		const rawRoom = getRawRoom(x, y);

		const neighbors = [getRawRoom(x, y - 1), getRawRoom(x + 1, y), getRawRoom(x, y + 1), getRawRoom(x - 1, y)];

		const exits = [
			rawRoom.exits[0] || neighbors[0].exits[2],
			rawRoom.exits[1] || neighbors[1].exits[3],
			rawRoom.exits[2] || neighbors[2].exits[0],
			rawRoom.exits[3] || neighbors[3].exits[1],
		] as [boolean, boolean, boolean, boolean];

		room = {
			...rawRoom,
			exits,
			x,
			y,
		};

		room_cache[key] = room;
	}
	return room;
}

export function getView(left: number, top: number, right: number, bottom: number) {
	const rooms = [];
	for (let y = top; y <= bottom; y++) {
		for (let x = left; x <= right; x++) {
			const room = getRoom(x, y);
			rooms.push(room);
		}
	}
}

if (typeof window !== 'undefined') {
	(window as any).raw_room_cache = raw_room_cache;
	(window as any).room_cache = room_cache;
}
