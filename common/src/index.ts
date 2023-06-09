import {encodePacked, keccak256} from 'viem';
export * from './bn';

// export type CellPosition = {
// 	cx: number;
// 	cy: number;
// };

// export type CellAction = {
// 	type: 'move';
// 	from: CellPosition; // not really needed, // TODO remove
// 	to: CellPosition;
// };

export type MoveAction = {
	type: 'move';
	treasure: undefined | 'pick' | 'ignore';
	from: RoomPosition;
	to: RoomPosition;
};
// export type PickTreasureAction = {
// 	type: 'move';
//     from: RoomPosition;
//     to: RoomPosition;
// }
export type RoomAction = MoveAction;

export type RoomPosition = {
	x: number;
	y: number;
};

// export function cellDirection(from: CellPosition, to: CellPosition): 0 | 1 | 2 | 3 | undefined {
// 	const x_diff = to.cx - from.cx;
// 	const y_diff = to.cy - from.cy;
// 	if (x_diff === 0) {
// 		if (y_diff === 1) {
// 			return 2;
// 		} else if (y_diff === -1) {
// 			return 0;
// 		} else {
// 			return undefined;
// 		}
// 	} else {
// 		if (x_diff === 1) {
// 			return 1;
// 		} else if (x_diff === -1) {
// 			return 3;
// 		} else {
// 			return undefined;
// 		}
// 	}
// }

export function roomDirection(from: RoomPosition, to: RoomPosition): 0 | 1 | 2 | 3 | undefined {
	const x_diff = to.x - from.x;
	const y_diff = to.y - from.y;
	if (x_diff === 0) {
		if (y_diff === 1) {
			return 2;
		} else if (y_diff === -1) {
			return 0;
		} else {
			return undefined;
		}
	} else {
		if (x_diff === 1) {
			return 1;
		} else if (x_diff === -1) {
			return 3;
		} else {
			return undefined;
		}
	}
}

// export function getRoomPositionFromCell(x: number, y: number): RoomPosition {
// 	return {
// 		x: Math.floor((x + 1) / 3),
// 		y: Math.floor((y + 1) / 3),
// 	};
// }

// export function fromCellActionsToRoomActions(cellActions: CellAction[]): RoomAction[] {
// 	const roomActions: RoomAction[] = [];
// 	for (const cellAction of cellActions) {
// 		if (cellAction.type === 'move') {
// 			const fromRoom = getRoomPositionFromCell(cellAction.from.cx, cellAction.from.cy);
// 			const toRoom = getRoomPositionFromCell(cellAction.to.cx, cellAction.to.cy);
// 			if (fromRoom.x != toRoom.x || fromRoom.y != toRoom.y) {
// 				roomActions.push({
// 					from: fromRoom,
// 					to: toRoom,
// 					type: 'move',
// 				});
// 			}
// 		} else {
// 			throw new Error(`CellAction type ${cellAction.type} is not supported`);
// 		}
// 	}

// 	return roomActions;
// }

export type RawRoom = {
	// north, east, west, south
	exits: [boolean, boolean, boolean, boolean];
	treasure: boolean;
	monster: boolean;
};

export type Room = RawRoom & {
	x: number;
	y: number;
};

export function bigIntIDToXYID(position: bigint): string {
	const {x, y} = bigIntIDToXY(position);
	return '' + x + ',' + y;
}

// using 64 bits room id
// const leftMostBit = BigInt('0x8000000000000000');
// const bn32 = BigInt('0x10000000000000000');
export function bigIntIDToXY(position: bigint): RoomPosition {
	const bn = BigInt(position);
	const x = Number(BigInt.asIntN(32, bn));
	const y = Number(BigInt.asIntN(32, bn >> 32n));
	// const rx = x >= leftMostBit ? -(bn32 - x) : x;
	// const ry = y >= leftMostBit ? -(bn32 - y) : y;
	return {x, y};
}

export function xyToXYID(x: number, y: number) {
	return '' + x + ',' + y;
}

export function xyToBigIntID(x: number, y: number): bigint {
	const bn = BigInt.asUintN(32, BigInt(x)) + (BigInt.asUintN(32, BigInt(y)) << 32n);
	return bn;
}

export function value(data: string, leastSignificantBit: number, size: number): number {
	return parseInt(((BigInt(data) >> BigInt(leastSignificantBit)) % 2n ** BigInt(size)).toString());
}

export function value8Mod(data: string, leastSignificantBit: number, mod: number): number {
	return parseInt(((BigInt(data) >> BigInt(leastSignificantBit)) % BigInt(mod)).toString());
}

export function generateEpoch(epochHash: `0x${string}`) {
	const raw_room_cache: {[coords: string]: RawRoom} = {};

	function computeRoom(roomHashData: `0x${string}`, roomHashData2: `0x${string}`): RawRoom {
		// take from the first 0 (right side) and take 2 bits to give you a number between [0,2**2[
		const firstExit = value(roomHashData, 0, 2);

		const hasSecondExit = value(roomHashData, 2, 5) < 10; // take 32 values [0,2**5[
		const secondExitRaw = value(roomHashData, 7, 2); // this has one value too much. if
		const secondExit = hasSecondExit && secondExitRaw < 3 ? secondExitRaw : 4;
		// const thirdExist = firstExit + ((Math.floor(Math.random() * 3) + 1) % 4);
		// const fourthExit = firstExit + ((Math.floor(Math.random() * 3) + 1) % 4);

		const treasure = value(roomHashData2, 9, 10) < 20; // take 1024 values [0,2**10[
		// TODO roomHashData3 ?
		const monsterRaw = value(roomHashData, 19, 7); // take 128 values [0,2**7[
		const monster = treasure ? monsterRaw < 30 : monsterRaw < 1;

		return {
			exits: [
				firstExit === 0 || secondExit === 0,
				firstExit === 1 || secondExit === 1,
				firstExit === 2 || secondExit === 2,
				firstExit === 3 || secondExit === 3,
			] as [boolean, boolean, boolean, boolean],
			treasure,
			monster,
		};
	}

	function getRawRoom(x: number, y: number): RawRoom {
		const key = `${x},${y}`;

		let room = raw_room_cache[key];
		if (!room) {
			const roomID = xyToBigIntID(x, y);
			const roomHashData = keccak256(encodePacked(['bytes32', 'uint256'], [epochHash, roomID]));

			room = computeRoom(
				roomHashData,
				keccak256(
					encodePacked(
						['bytes32', 'uint256'],
						// TODO layer 2 epoch Hash
						['0x0000000000000000000000000000000000000000000000000000000000000000', roomID]
					)
				)
			);
			raw_room_cache[key] = room;
		}

		// console.log({room, firstExit, secondExit});
		return room;
	}

	const room_cache: {[coords: string]: Room} = {};

	function getRoom(x: number, y: number): Room {
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

	// function getRoomFromCell(x: number, y: number): Room {
	// 	const roomPosition = getRoomPositionFromCell(x, y);
	// 	return getRoom(roomPosition.x, roomPosition.y);
	// }

	// function isValidCellMove(from: CellPosition, to: CellPosition) {
	// 	const dir = cellDirection(from, to);
	// 	if (typeof dir !== 'number') {
	// 		return false;
	// 	}
	// 	const from_room = getRoomFromCell(from.cx, from.cy);
	// 	const to_room = getRoomFromCell(to.cx, to.cy);
	// 	if (from_room === to_room) {
	// 		return true;
	// 	} else {
	// 		return from_room.exits[dir]; //  && (from.cx % 3 === 0 || from.cy % 3 === 0);
	// 	}
	// }

	function isValidMove(from: RoomPosition, to: RoomPosition) {
		const dir = roomDirection(from, to);
		if (typeof dir !== 'number') {
			return false;
		}
		const from_room = getRoom(from.x, from.y);
		const to_room = getRoom(to.x, to.y);
		if (from_room === to_room) {
			return true;
		} else {
			return from_room.exits[dir]; //  && (from.cx % 3 === 0 || from.cy % 3 === 0);
		}
	}

	return {
		getRawRoom,
		getRoom,
		// getRoomFromCell,
		// isValidCellMove,
		isValidMove,
		epoch: {
			hash: epochHash,
		},
	};
}

// export function cellPositionFrom(position: CellPosition, x: 0 | -1 | 1, y: 0 | -1 | 1) {
// 	return {
// 		cx: position.cx + x,
// 		cy: position.cy + y,
// 	};
// }

export function roomPositionFrom(position: RoomPosition, x: 0 | -1 | 1, y: 0 | -1 | 1) {
	return {
		x: position.x + x,
		y: position.y + y,
	};
}

export function getEpochHash(epochToGenerate: number) {
	return keccak256(encodePacked(['uint256'], [BigInt(epochToGenerate)]));
}
