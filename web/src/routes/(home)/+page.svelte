<script lang="ts">
	import Canvas2D from '$lib/render/Canvas2D.svelte';
	import {gameState} from '$lib/game/GameState';
	import Web3ConnectionUi from '$lib/web3/Web3ConnectionUI.svelte';
	import ConnectButton from '$lib/web3/ConnectButton.svelte';
	import Welcome from '$lib/components/Welcome.svelte';
	import Actions from '$lib/components/dungeon/Actions.svelte';
	import Choices from '$lib/components/dungeon/Choices.svelte';
	import Modal from '$lib/components/modals/Modal.svelte';
	import WelcomeFlow from '$lib/components/dungeon/WelcomeFlow.svelte';
	import {accountData} from '$lib/web3';
</script>

<Canvas2D {gameState} />

<div class="fixed top-0 right-0 z-10">
	<ConnectButton />
</div>

{#if $gameState.player}
	{#if $gameState.playerCharacter}
		<div class="fixed top-0 left-0 z-10">
			<div class="card">
				<div class="card-body bg-purple-300 text-red-600">
					<p>life: {$gameState.playerCharacter.life}</p>
					<p>gold: {$gameState.playerCharacter.gold}</p>
				</div>
			</div>
		</div>
		{#if $gameState.playerCharacter.life == 0}
			<Modal>
				<h3 class="text-lg font-bold">You Are Dead</h3>
			</Modal>
		{/if}

		<Actions />

		<Choices />

		{#if $gameState.player?.needRecap.diff}
			<Modal>
				<h3 class="text-lg font-bold">Summary</h3>
				{#if $gameState.player?.needRecap.diff.gold > 0}
					<p>{$gameState.player?.needRecap.diff.gold} Gold acquired</p>
				{:else if $gameState.player?.needRecap.diff.gold < 0}
					<p>{-$gameState.player?.needRecap.diff.gold} Gold lost</p>
				{/if}

				{#if $gameState.player?.needRecap.diff.life > 0}
					<p>{$gameState.player?.needRecap.diff.life} life gained</p>
				{:else if $gameState.player?.needRecap.diff.life < 0}
					<p>{-$gameState.player?.needRecap.diff.life} life lost</p>
				{/if}

				<button
					on:click={async () => {
						accountData.offchainState.acknowledgeEpoch($gameState.epoch.number);
					}}
					class="btn">OK</button
				>
			</Modal>
		{/if}
	{:else if $gameState.player.pendingActions.length > 0}
		<Modal>
			<h3 class="text-lg font-bold">Waiting for Tx...</h3>
		</Modal>
	{:else}
		<WelcomeFlow />
	{/if}
{:else}
	<Welcome />
{/if}

<Web3ConnectionUi />
