<script lang="ts">
	import Canvas2D from '$lib/render/Canvas2D.svelte';
	import {state} from '$lib/blockchain/state/State';
	import Web3ConnectionUi from '$lib/web3/Web3ConnectionUI.svelte';
	import ConnectButton from '$lib/web3/ConnectButton.svelte';
	import Welcome from '$lib/components/Welcome.svelte';
</script>

<Canvas2D {state} />

<div class="fixed top-0 right-0">
	<ConnectButton />
</div>

<Welcome />

<Web3ConnectionUi />
