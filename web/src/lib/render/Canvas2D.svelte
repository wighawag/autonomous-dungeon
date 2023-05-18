<script lang="ts">
	import {onMount} from 'svelte';
	import {Camera} from './camera';
	import {WebGLRenderer} from './Renderer2D';

	export let state: any; // TODO
	let renderer: WebGLRenderer = new WebGLRenderer();
	let camera: Camera;
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

		camera = new Camera();
		camera.start(canvas, renderer);
		camera.subscribe((v) => renderer.updateView(v));

		// const actionHandler = new ActionHandler();
		// camera.onClick = (x, y) => {
		// 	actionHandler.onCell(Math.floor(x), Math.floor(y));
		// };

		// state.subscribe(($state) => {
		// 	renderer.updateState($state);
		// });

		requestAnimationFrame(render);
	});
</script>

{#if error}
	{error}
{:else}
	<canvas id="canvas" style="width:100%; height: 100%; display: block; margin: 0;" />
{/if}
