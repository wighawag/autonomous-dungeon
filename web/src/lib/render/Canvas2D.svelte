<script lang="ts">
	import {onMount} from 'svelte';
	import {Camera, camera} from './camera';
	import {Canvas2DRenderer} from './Renderer2D';
	import type {GameState} from '$lib/game/GameState';
	import type {Readable} from 'svelte/store';
	import {controller} from '$lib/game/Controller';

	export let gameState: Readable<GameState>;
	let renderer: Canvas2DRenderer = new Canvas2DRenderer();
	function render(time: number) {
		renderer.render(time);
		requestAnimationFrame(render);
	}

	let error: string | undefined;
	onMount(() => {
		const canvas = document.querySelector('#canvas') as HTMLCanvasElement;
		const ctx = canvas.getContext('2d');
		if (!ctx) {
			error = `could not create 2d context`;
			throw new Error(error);
		}

		renderer.initialize(canvas, ctx);

		camera.start(canvas, renderer);
		camera.subscribe((v) => renderer.updateView(v));

		camera.onClick = (x, y) => {
			const {room, cell} = renderer.fromCameraToRoom(x, y);
			controller.onRoomClicked(room.x, room.y, cell.x, cell.y);
		};

		gameState.subscribe(($gameState) => {
			renderer.updateState($gameState);
		});

		requestAnimationFrame(render);
	});
</script>

{#if error}
	{error}
{:else}
	<canvas id="canvas" style="width:100%; height: 100%; display: block; margin: 0;" />
{/if}
