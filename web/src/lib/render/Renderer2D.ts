import {writable, type Readable, type Subscriber, type Unsubscriber, type Writable} from 'svelte/store';
import type {CameraState} from './camera';
import type {RenderViewState} from './renderview';
import {account, accountData} from '$lib/web3';
import {Blockie} from '$lib/utils/eth/blockie';
import type {Room} from 'jolly-roger-common';
import {controller} from '$lib/blockchain/state/Controller';
import {state} from '$lib/blockchain/state/State';

const CELL_SIZE = 50;
const ROOM_CELL_SIZE = 3;
const ROOM_PADDING = 10;
const ROOM_SIZE = CELL_SIZE * ROOM_CELL_SIZE + ROOM_PADDING * 2;
const DOOR_SIZE = ROOM_SIZE / 1;
const WALL_STROKE_SIZE = 7;
const FONT = `${CELL_SIZE}px serif`;

const DOOR_SIDE_WALL_SIZE = (ROOM_SIZE - DOOR_SIZE) / 2;

function drawWalls(ctx: CanvasRenderingContext2D, room: Room, cx: number, cy: number) {
	const left = cx - ROOM_SIZE / 2;
	const top = cy - ROOM_SIZE / 2;
	const right = cx + ROOM_SIZE / 2;
	const bottom = cy + ROOM_SIZE / 2;
	// ctx.fillText(`${room.x},${room.y}`, left, top);
	// north ctx.fillRect(left, top, ROOM_SIZE, WALL_STROKE_SIZE);
	ctx.fillRect(left, top, DOOR_SIDE_WALL_SIZE, WALL_STROKE_SIZE);
	if (!room.exits[0]) {
		ctx.fillRect(left + DOOR_SIDE_WALL_SIZE, top, DOOR_SIZE, WALL_STROKE_SIZE);
	}
	ctx.fillRect(left + DOOR_SIDE_WALL_SIZE + DOOR_SIZE, top, DOOR_SIDE_WALL_SIZE, WALL_STROKE_SIZE);

	// east: ctx.fillRect(cx + ROOM_SIZE / 2, top, WALL_STROKE_SIZE, ROOM_SIZE);
	ctx.fillRect(right, top, WALL_STROKE_SIZE, DOOR_SIDE_WALL_SIZE);
	if (!room.exits[1]) {
		ctx.fillRect(right, top + DOOR_SIDE_WALL_SIZE, WALL_STROKE_SIZE, DOOR_SIZE);
	}
	ctx.fillRect(right, top + DOOR_SIDE_WALL_SIZE + DOOR_SIZE, WALL_STROKE_SIZE, DOOR_SIDE_WALL_SIZE);

	// south ctx.fillRect(left, bottom, ROOM_SIZE, WALL_STROKE_SIZE);
	ctx.fillRect(left, bottom, DOOR_SIDE_WALL_SIZE, WALL_STROKE_SIZE);
	if (!room.exits[2]) {
		ctx.fillRect(left + DOOR_SIDE_WALL_SIZE, bottom, DOOR_SIZE, WALL_STROKE_SIZE);
	}
	ctx.fillRect(left + DOOR_SIDE_WALL_SIZE + DOOR_SIZE, bottom, DOOR_SIDE_WALL_SIZE, WALL_STROKE_SIZE);

	// west ctx.fillRect(left, top, WALL_STROKE_SIZE, ROOM_SIZE);
	ctx.fillRect(left, top, WALL_STROKE_SIZE, DOOR_SIDE_WALL_SIZE);
	if (!room.exits[3]) {
		ctx.fillRect(left, top + DOOR_SIDE_WALL_SIZE, WALL_STROKE_SIZE, DOOR_SIZE);
	}
	ctx.fillRect(left, top + DOOR_SIDE_WALL_SIZE + DOOR_SIZE, WALL_STROKE_SIZE, DOOR_SIDE_WALL_SIZE);
}

export class WebGLRenderer implements Readable<RenderViewState> {
	// private state: Data;
	private canvas!: HTMLCanvasElement;
	private ctx!: CanvasRenderingContext2D;
	private store: Writable<RenderViewState>;
	private cameraState!: CameraState;

	constructor() {
		this.store = writable({devicePixelRatio: 1, width: 0, height: 0});
	}

	subscribe(run: Subscriber<RenderViewState>, invalidate?: (value?: RenderViewState) => void): Unsubscriber {
		return this.store.subscribe(run, invalidate);
	}
	// updateState(state: Data) {
	// 	this.state = state;
	// }

	updateView(cameraState: CameraState) {
		this.cameraState = cameraState;
	}

	initialize(canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D) {
		this.canvas = canvas;
		this.ctx = ctx;
		this.store.set({
			devicePixelRatio: window.devicePixelRatio,
			width: this.canvas.width,
			height: this.canvas.height,
		});
		// state.subscribe(() => {});
	}

	render(time: number) {
		const ctx = this.ctx as CanvasRenderingContext2D;

		const scale = window.devicePixelRatio;
		const clientWidth = this.canvas.clientWidth;
		const clientHeight = this.canvas.clientHeight;
		const width = Math.floor(clientWidth * scale);
		const height = Math.floor(clientHeight * scale);

		if (width != this.canvas.width || height != this.canvas.height) {
			this.canvas.width = width;
			this.canvas.height = height;
			this.store.set({
				devicePixelRatio: window.devicePixelRatio,
				width,
				height,
			});
		}

		ctx.fillStyle = '#5a4e3a';
		ctx.fillRect(0, 0, width, height);

		ctx.translate(this.cameraState.renderX, this.cameraState.renderY);
		ctx.scale(this.cameraState.renderScale, this.cameraState.renderScale);

		ctx.textAlign = 'center';
		ctx.textBaseline = 'middle';
		ctx.fillStyle = 'black';
		ctx.strokeStyle = 'black';

		ctx.font = FONT;

		const visualWidth = Math.ceil(this.cameraState.width / ROOM_SIZE);
		const visualHeight = Math.ceil(this.cameraState.height / ROOM_SIZE);
		const left = Math.floor(this.cameraState.x / ROOM_SIZE - visualWidth / 2);
		const top = Math.floor(this.cameraState.y / ROOM_SIZE - visualHeight / 2);
		const right = left + visualWidth;
		const bottom = top + visualHeight;

		for (let y = top; y <= bottom; y++) {
			for (let x = left; x <= right; x++) {
				const room = controller.dungeon.$state.getRoom(x, y);

				const cx = x * ROOM_SIZE;
				const cy = y * ROOM_SIZE;
				drawWalls(ctx, room, cx, cy);

				for (let suby = -1; suby <= 1; suby++) {
					for (let subx = -1; subx <= 1; subx++) {
						// ctx.fillText('-', cx + subx * CELL_SIZE, cy + suby * CELL_SIZE);
						// ctx.fillText('.', cx + subx * CELL_SIZE, cy + suby * CELL_SIZE);
						ctx.strokeRect(cx + subx * CELL_SIZE, cy + suby * CELL_SIZE, 3, 3);
					}
				}

				if (room.monster) {
					ctx.fillText('🐉', cx + -1 * CELL_SIZE, cy + -1 * CELL_SIZE);
				}

				if (room.chest) {
					ctx.fillText('💰', cx + 1 * CELL_SIZE, cy + 1 * CELL_SIZE);
					// 🗝
				}
			}
		}

		const $state = accountData.$offchainState;
		const character = $state.position;
		const characterRoom = {
			x: Math.floor(($state.position.cx + 1) / 3),
			y: Math.floor(($state.position.cy + 1) / 3),
		};
		ctx.fillStyle = 'white';
		ctx.strokeStyle = 'white';
		const cx = characterRoom.x * ROOM_SIZE;
		const cy = characterRoom.y * ROOM_SIZE;
		// drawWalls(ctx, getRoomFromCell(character.cx, character.cy), cx, cy);
		for (let suby = -1; suby <= 1; suby++) {
			for (let subx = -1; subx <= 1; subx++) {
				// ctx.fillText('-', cx + subx * CELL_SIZE, cy + suby * CELL_SIZE);
				// ctx.fillText('.', cx + subx * CELL_SIZE, cy + suby * CELL_SIZE);
				ctx.strokeRect(cx + subx * CELL_SIZE, cy + suby * CELL_SIZE, 3, 3);
			}
		}
		const characterRoomPosition = {
			x: $state.position.cx - characterRoom.x * 3,
			y: $state.position.cy - characterRoom.y * 3,
		};

		for (const action of $state.actions) {
			const actionRoom = {
				x: Math.floor((action.from.cx + 1) / 3),
				y: Math.floor((action.from.cy + 1) / 3),
			};
			const positionInRoom = {
				x: action.from.cx - actionRoom.x * 3,
				y: action.from.cy - actionRoom.y * 3,
			};
			ctx.globalAlpha = 0.3;
			ctx.fillText(
				'👣',
				actionRoom.x * ROOM_SIZE + positionInRoom.x * CELL_SIZE,
				actionRoom.y * ROOM_SIZE + positionInRoom.y * CELL_SIZE
			);
			ctx.globalAlpha = 1;
		}

		// console.log({characters: state.$state.characters});
		for (const character of state.$state.characters) {
			const cx = character.position.x * ROOM_SIZE - CELL_SIZE / 2;
			const cy = character.position.y * ROOM_SIZE - CELL_SIZE / 2;
			Blockie.get(character.id).draw(ctx, cx, cy, 8);
		}

		if (account.$state.address) {
			Blockie.get(account.$state.address).draw(
				ctx,
				characterRoom.x * ROOM_SIZE + characterRoomPosition.x * CELL_SIZE - CELL_SIZE / 2,
				characterRoom.y * ROOM_SIZE + characterRoomPosition.y * CELL_SIZE - CELL_SIZE / 2,
				8
			);

			// ctx.fillText(
			// 	'🧙‍♂️',
			// 	characterRoom.x * ROOM_SIZE + characterRoomPosition.x * CELL_SIZE,
			// 	characterRoom.y * ROOM_SIZE + characterRoomPosition.y * CELL_SIZE
			// );
		}

		// ctx.fillText('W', 0, 0);
		// for (let y = 0; y < height; y += 50) {
		// 	for (let x = 0; x < width; x += 50) {
		// 		ctx.fillText('A', x, y);
		// 	}
		// }

		// ctx.fillText('W', 40, 5);
		ctx.resetTransform();
	}
}
