<script lang="ts">
	import ConnectButton from '$lib/web3/ConnectButton.svelte';
	import Web3ConnectionUI from '$lib/web3/Web3ConnectionUI.svelte';
	import {account, connection, network} from '$lib/web3';
	import {status, state} from '$lib/blockchain/state/State';
	import Canvas2D from '$lib/render/Canvas2D.svelte';
	import {gameState} from '$lib/game/GameState';

	let messageToSend: string;
</script>

<div class="navbar bg-base-100">
	<div class="navbar-start">
		<span class="normal-case text-xl">Demo</span>
	</div>
	<div class="navbar-center hidden lg:flex" />
	<div class="navbar-end">
		<ConnectButton />
	</div>
</div>

<section class="py-8 px-4">
	<!-- {#if !$messages.step}
		<div>Messages not loaded</div>
	{:else if $messages.error}
		<div>Error: {$messages.error}</div>
		-->
	{#if $connection.state !== 'Connected'}
		Please connect
	{:else if $network.notSupported}
		Wrong network
	{:else if $status.state !== 'Loaded'}
		<div>Loading ...</div>
	{/if}

	<Canvas2D {gameState} />
	<!-- {/if} -->
</section>

<Web3ConnectionUI />
