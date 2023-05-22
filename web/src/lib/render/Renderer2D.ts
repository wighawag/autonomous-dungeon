import {writable, type Readable, type Subscriber, type Unsubscriber, type Writable} from 'svelte/store';
import type {CameraState} from './camera';
import type {RenderViewState} from './renderview';
import {Blockie} from '$lib/utils/eth/blockie';
import {roomDirection, type Room} from 'jolly-roger-common';
import {controller} from '$lib/game/Controller';
import type {GameState} from '$lib/game/GameState';

const CELL_SIZE = 50;
const ROOM_CELL_SIZE = 3;
const ROOM_PADDING = 10;
export const ROOM_SIZE = CELL_SIZE * ROOM_CELL_SIZE + ROOM_PADDING * 2;
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

export class Canvas2DRenderer implements Readable<RenderViewState> {
	private $gameState: GameState | undefined;
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
	updateState(gameState: GameState) {
		this.$gameState = gameState;
	}

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

				if (room.treasure) {
					ctx.fillText('💰', cx + 1 * CELL_SIZE, cy + 1 * CELL_SIZE);
					// 🗝
				}
			}
		}

		const playerCharacter = this.$gameState?.playerCharacter;

		// if (playerCharacter) {
		// 	const startingRoom = playerCharacter.position;
		// 	ctx.fillStyle = 'green';
		// 	ctx.strokeStyle = 'green';
		// 	const cx = startingRoom.x * ROOM_SIZE;
		// 	const cy = startingRoom.y * ROOM_SIZE;
		// 	// drawWalls(ctx, getRoomFromCell(character.cx, character.cy), cx, cy);
		// 	// for (let suby = -1; suby <= 1; suby++) {
		// 	// 	for (let subx = -1; subx <= 1; subx++) {
		// 	// 		// ctx.fillText('-', cx + subx * CELL_SIZE, cy + suby * CELL_SIZE);
		// 	// 		// ctx.fillText('.', cx + subx * CELL_SIZE, cy + suby * CELL_SIZE);
		// 	// 		ctx.strokeRect(cx + subx * CELL_SIZE, cy + suby * CELL_SIZE, 3, 3);
		// 	// 	}
		// 	// }
		// 	const prev_lineWidth = ctx.lineWidth;
		// 	ctx.lineWidth = 5;
		// 	ctx.strokeRect(cx - ROOM_SIZE / 2, cy - ROOM_SIZE / 2, ROOM_SIZE, ROOM_SIZE);
		// 	ctx.lineWidth = prev_lineWidth;
		// }

		const player = this.$gameState?.player;
		const playerRoom = player ? player.position : undefined;

		if (player && playerRoom) {
			ctx.fillStyle = 'white';
			ctx.strokeStyle = 'white';
			const cx = playerRoom.x * ROOM_SIZE;
			const cy = playerRoom.y * ROOM_SIZE;
			// drawWalls(ctx, getRoomFromCell(character.cx, character.cy), cx, cy);
			for (let suby = -1; suby <= 1; suby++) {
				for (let subx = -1; subx <= 1; subx++) {
					// ctx.fillText('-', cx + subx * CELL_SIZE, cy + suby * CELL_SIZE);
					// ctx.fillText('.', cx + subx * CELL_SIZE, cy + suby * CELL_SIZE);
					ctx.strokeRect(cx + subx * CELL_SIZE, cy + suby * CELL_SIZE, 3, 3);
				}
			}

			for (let i = 0; i < player.actions.length; i++) {
				const action = player.actions[i];
				ctx.globalAlpha = 0.3 + 0.5 * (i / player.actions.length);

				// ctx.fillText('👣', actionRoom.x * ROOM_SIZE, actionRoom.y * ROOM_SIZE);
				ctx.strokeStyle = 'white';
				const prev_lineWidth = ctx.lineWidth;
				ctx.lineWidth = 5;
				const direction = roomDirection(action.from, action.to);
				const LEAD_FROM = -ROOM_SIZE / 8;
				const LEAD_TO = ROOM_SIZE / 1.8;
				switch (direction) {
					case 0:
						drawArrow(
							ctx,
							action.from.x * ROOM_SIZE,
							action.from.y * ROOM_SIZE + LEAD_FROM,
							action.to.x * ROOM_SIZE,
							action.to.y * ROOM_SIZE + LEAD_TO
						);
						break;
					case 1:
						drawArrow(
							ctx,
							action.from.x * ROOM_SIZE - LEAD_FROM,
							action.from.y * ROOM_SIZE,
							action.to.x * ROOM_SIZE - LEAD_TO,
							action.to.y * ROOM_SIZE
						);
						break;
					case 2:
						drawArrow(
							ctx,
							action.from.x * ROOM_SIZE,
							action.from.y * ROOM_SIZE - LEAD_FROM,
							action.to.x * ROOM_SIZE,
							action.to.y * ROOM_SIZE - LEAD_TO
						);
						break;
					case 3:
						drawArrow(
							ctx,
							action.from.x * ROOM_SIZE + LEAD_FROM,
							action.from.y * ROOM_SIZE,
							action.to.x * ROOM_SIZE + LEAD_TO,
							action.to.y * ROOM_SIZE
						);
						break;
				}
				ctx.lineWidth = prev_lineWidth;
				ctx.globalAlpha = 1;
			}
		}

		// console.log({characters: state.$state.characters});
		if (this.$gameState) {
			for (const character of this.$gameState.characters) {
				const cx = character.position.x * ROOM_SIZE - CELL_SIZE / 2;
				const cy = character.position.y * ROOM_SIZE - CELL_SIZE / 2;
				Blockie.get(character.player).draw(ctx, cx, cy, 8);
			}
		}

		if (player && playerRoom) {
			Blockie.get(player.address).draw(
				ctx,
				playerRoom.x * ROOM_SIZE - CELL_SIZE / 2,
				playerRoom.y * ROOM_SIZE - CELL_SIZE / 2,
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

	fromCameraToRoom(x: number, y: number) {
		const rx = x + ROOM_SIZE / 2;
		const ry = y + ROOM_SIZE / 2;
		const room = {
			x: Math.floor(rx / ROOM_SIZE),
			y: Math.floor(ry / ROOM_SIZE),
		};
		const rx_diff = rx - room.x * ROOM_SIZE;
		const ry_diff = ry - room.y * ROOM_SIZE;
		// const x_diff = x - room.x * ROOM_SIZE;
		// const y_diff = y - room.y * ROOM_SIZE;
		const cx = Math.floor((rx_diff / ROOM_SIZE) * 3 - 1);
		const cy = Math.floor((ry_diff / ROOM_SIZE) * 3 - 1);

		// console.log('xy', x, y);
		// console.log('r', rx, ry);
		// console.log('room_xy', room.x, room.y);
		// console.log('cxy', cx, cy);
		// console.log('r_diff', rx_diff, ry_diff);
		// console.log('_diff', x_diff, y_diff);
		// console.log('ROOM_SIZE', ROOM_SIZE);
		return {
			room,
			cell: {
				x: cx,
				y: cy,
			},
		};
	}
}

function drawArrow(
	ctx: CanvasRenderingContext2D,
	fromx: number,
	fromy: number,
	tox: number,
	toy: number,
	head?: number
) {
	ctx.beginPath();
	head = head || 10;
	const dx = tox - fromx;
	const dy = toy - fromy;
	const angle = Math.atan2(dy, dx);
	ctx.moveTo(fromx, fromy);
	ctx.lineTo(tox, toy);
	ctx.lineTo(tox - head * Math.cos(angle - Math.PI / 6), toy - head * Math.sin(angle - Math.PI / 6));
	ctx.moveTo(tox, toy);
	ctx.lineTo(tox - head * Math.cos(angle + Math.PI / 6), toy - head * Math.sin(angle + Math.PI / 6));
	ctx.stroke();
}
