import {writable, type Readable, type Subscriber, type Unsubscriber, type Writable} from 'svelte/store';
import type {CameraState} from './camera';
import type {RenderViewState} from './renderview';
import {offchainState} from '$lib/blockchain/state/OffchainState';

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

		const CELL_SIZE = 50;
		const ROOM_CELL_SIZE = 3;
		const ROOM_SIZE = CELL_SIZE * ROOM_CELL_SIZE;
		ctx.font = `${CELL_SIZE}px serif`;

		const visualWidth = Math.ceil(this.cameraState.width / ROOM_SIZE);
		const visualHeight = Math.ceil(this.cameraState.height / ROOM_SIZE);
		const left = Math.floor(this.cameraState.x / ROOM_SIZE - visualWidth / 2);
		const top = Math.floor(this.cameraState.y / ROOM_SIZE - visualHeight / 2);
		const right = left + visualWidth;
		const bottom = top + visualHeight;

		for (let y = top; y <= bottom; y++) {
			for (let x = left; x <= right; x++) {
				const cx = x * ROOM_SIZE;
				const cy = y * ROOM_SIZE;
				ctx.fillRect(cx - ROOM_SIZE / 2, cy - ROOM_SIZE / 2, ROOM_SIZE, 1);
				ctx.fillRect(cx - ROOM_SIZE / 2, cy - ROOM_SIZE / 2, 1, ROOM_SIZE);
				ctx.fillRect(cx - ROOM_SIZE / 2, cy + ROOM_SIZE / 2, ROOM_SIZE, 1);
				ctx.fillRect(cx + ROOM_SIZE / 2, cy - ROOM_SIZE / 2, 1, ROOM_SIZE);
				for (let suby = -1; suby <= 1; suby++) {
					for (let subx = -1; subx <= 1; subx++) {
						ctx.fillText('.', cx + subx * CELL_SIZE, cy + suby * CELL_SIZE);
					}
				}
			}
		}

		const character = offchainState.$state.position;
		ctx.fillText('😀', character.x * CELL_SIZE, character.y * CELL_SIZE);

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
