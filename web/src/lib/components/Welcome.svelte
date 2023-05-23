<script lang="ts">
	import {status, syncing, state} from '$lib/blockchain/state/State';
	import {contractsInfos} from '$lib/config';
	import {connection, account, network, accountData} from '$lib/web3';
	import {onMount} from 'svelte';
	import Modal from './modals/Modal.svelte';
	import {gameState} from '$lib/game/GameState';
	import WelcomeFlow from './dungeon/WelcomeFlow.svelte';
	import {getNetworkConfig} from '$lib/blockchain/networks';

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
	{#if $network.state === 'Disconnected' && $network.notSupported}
		<Modal>
			<h3 class="text-lg font-bold">You are connected to unsupported network</h3>
			<p class="py-4">
				Proceed to switch to {getNetworkConfig($contractsInfos.chainId)?.chainName ||
					`the network with chainID: ${$contractsInfos.chainId}`}.
			</p>
			<div class="modal-action">
				<button
					on:click={async () => {
						console.log('switching...');
						await network.switchTo($contractsInfos.chainId, getNetworkConfig($contractsInfos.chainId));
						console.log('switched');
					}}
					class="btn">Switch</button
				>
			</div>
		</Modal>
	{:else}
		<Modal>
			<h3 class="text-lg font-bold">Please wait While we Index....</h3>
			<div class="radial-progress bg-primary text-primary-content border-4 border-primary" style="--value:{progress};">
				{progress}%
			</div>
		</Modal>
	{/if}
{:else if $gameState.player && !$gameState.playerCharacter}
	<WelcomeFlow />
{:else if !ready}
	<Modal>
		<h3 class="text-lg font-bold">Please wait While the Game Get Setup....</h3>
	</Modal>
{:else if $gameState.player?.needRecap}
	<Modal>
		<h3 class="text-lg font-bold">A New Day</h3>
		<button
			on:click={async () => {
				accountData.offchainState.acknowledgeEpoch($gameState.epoch.number);
			}}
			class="btn">OK</button
		>
	</Modal>
{/if}
