<script lang="ts">
	import {status, syncing, state} from '$lib/blockchain/state/State';
	import {connection, account} from '$lib/web3';
	import {onMount} from 'svelte';
	import Modal from './modals/Modal.svelte';
	import {gameState} from '$lib/game/GameState';
	import WelcomeFlow from './dungeon/WelcomeFlow.svelte';

	$: progress = $status.state === 'Loaded' ? 100 : $syncing.lastSync?.syncPercentage || 0;

	let ready = true;
	onMount(() => {
		ready = true;
		const timeout = setTimeout(() => {
			ready = true;
		}, 1000);
		return () => {
			ready = true;
			clearTimeout(timeout);
		};
	});
</script>

{#if $connection.initialised && $connection.state === 'Disconnected'}
	<Modal>
		<h3 class="text-lg font-bold">Welcome to the "Forever Shifting Dungeon"</h3>
		<p class="py-4">Enter with Caution...</p>
		<div class="modal-action">
			<button on:click={() => connection.connect()} class="btn btn-error">Connect</button>
		</div>
	</Modal>
{:else if $status.state !== 'Loaded'}
	<Modal>
		<h3 class="text-lg font-bold">Please wait While we Index....</h3>
		<div class="radial-progress bg-primary text-primary-content border-4 border-primary" style="--value:{progress};">
			{progress}%
		</div>
	</Modal>
{:else if $gameState.player && !$gameState.playerCharacter}
	<WelcomeFlow />
{:else if !ready}
	<Modal>
		<h3 class="text-lg font-bold">Please wait While the Game Get Setup....</h3>
	</Modal>
{/if}
