<script lang="ts">
	import Canvas2D from '$lib/render/Canvas2D.svelte';
	import {gameState} from '$lib/game/GameState';
	import Web3ConnectionUi from '$lib/web3/Web3ConnectionUI.svelte';
	import ConnectButton from '$lib/web3/ConnectButton.svelte';
	import Welcome from '$lib/components/Welcome.svelte';
	import Actions from '$lib/components/dungeon/Actions.svelte';
</script>

<Canvas2D {gameState} />

<div class="fixed top-0 right-0 z-10">
	<ConnectButton />
</div>

<Welcome />

<Actions />

<Web3ConnectionUi />
