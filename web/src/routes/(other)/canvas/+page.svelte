<script lang="ts">
	import Canvas2D from '$lib/render/Canvas2D.svelte';
	import {state} from '$lib/blockchain/state/State';
</script>

<Canvas2D {state} />
