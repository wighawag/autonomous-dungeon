import {writable} from 'svelte/store';
import {logs} from 'named-logs';
import {slice} from 'viem';
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

const raw_room_cache: {[coords: string]: RawRoom} = {};
export function getRawRoom(x: number, y: number): RawRoom {
	const key = `${x},${y}`;

	let room = raw_room_cache[key];
	if (!room) {
		const firstExit = Math.floor(Math.random() * 4);
		const secondExit = (firstExit + (Math.floor(Math.random() * 3) + 1)) % 4;
		// const thirdExist = firstExit + ((Math.floor(Math.random() * 3) + 1) % 4);
		// const fourthExit = firstExit + ((Math.floor(Math.random() * 3) + 1) % 4);

		const chest = Math.random() < 0.007;
		const monster = chest ? Math.random() < 0.3 : Math.random() < 0.01;

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
