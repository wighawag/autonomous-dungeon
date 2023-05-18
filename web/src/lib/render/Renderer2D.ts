import {writable, type Readable, type Subscriber, type Unsubscriber, type Writable} from 'svelte/store';
import type {CameraState} from './camera';
import type {RenderViewState} from './renderview';

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
		ctx.font = '50px serif';
		ctx.fillText('W', 0, 0);
		for (let y = 0; y < height; y += 50) {
			for (let x = 0; x < width; x += 50) {
				ctx.fillText('A', x, y);
			}
		}

		// ctx.fillText('W', 40, 5);
		ctx.resetTransform();
	}
}
