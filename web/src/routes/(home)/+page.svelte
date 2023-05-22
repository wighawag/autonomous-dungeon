<script lang="ts">
	import Canvas2D from '$lib/render/Canvas2D.svelte';
	import {gameState} from '$lib/game/GameState';
	import Web3ConnectionUi from '$lib/web3/Web3ConnectionUI.svelte';
	import ConnectButton from '$lib/web3/ConnectButton.svelte';
	import Welcome from '$lib/components/Welcome.svelte';
	import Actions from '$lib/components/dungeon/Actions.svelte';
	import Choices from '$lib/components/dungeon/Choices.svelte';
	import Modal from '$lib/components/modals/Modal.svelte';
</script>

<Canvas2D {gameState} />

<div class="fixed top-0 right-0 z-10">
	<ConnectButton />
</div>

<div class="fixed top-0 left-0 z-10">
	{#if $gameState.playerCharacter}
		<div class="card">
			<div class="card-body bg-purple-300 text-red-600">
				<p>life: {$gameState.playerCharacter.life}</p>
				<p>gold: {$gameState.playerCharacter.gold}</p>
			</div>
		</div>
	{/if}
</div>

{#if $gameState.playerCharacter && $gameState.playerCharacter.life == 0}
	<Modal>
		<h3 class="text-lg font-bold">You Are Dead</h3>
	</Modal>
{:else}
	<Welcome />

	<Actions />

	<Choices />
{/if}

<Web3ConnectionUi />
