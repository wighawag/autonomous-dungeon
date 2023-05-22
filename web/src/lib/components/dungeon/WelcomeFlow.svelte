<script lang="ts">
	import {contracts} from '$lib/web3/viem';
	import Modal from '../modals/Modal.svelte';
	let step = 0;

	function enter() {
		contracts.execute(async ({contracts, connection}) => {
			connection.provider.setNextMetadata({
				type: 'enter',
				id: 1,
			});
			await contracts.Dungeon.write({
				functionName: 'enter',
				args: [1n],
				value: 1000000000000000n,
			});
		});
	}
</script>

<Modal>
	{#if step == 0}
		<h3 class="text-lg font-bold">Are you sure you want to enter the dungeon?</h3>
		<h2 class="text-sm">A Friend at the tavern was asking you</h2>
		<div class="modal-action">
			<button on:click={() => step++} class="btn btn-error">Yes, you said</button>
		</div>
	{:else if step == 1}
		<p class="text-sm">
			Everybody in the tavern who overheard you though you were crazy. Everybody knew the dungeon was dangerous. The
			only one who manage to get back from it promised to never go back.
		</p>
		<p class="text-sm">
			The dungeon was a mistery. The ever shifting nature was an anomaly. Legends told of an pwoerful sorceress leaving
			there ages ago.
		</p>
		<p class="text-sm">The dungeon was only discovered recently</p>
		<div class="modal-action">
			<button on:click={() => step++} class="btn btn-error">Walk toward the entrance...</button>
		</div>
	{:else if step == 2}
		<p class="text-sm">As you arrive near the entrance, a Giant stand by and ask: "who are you ?"</p>
		<div class="modal-action">
			<button on:click={() => step++} class="btn btn-error">Create your character</button>
		</div>
	{:else if step == 3}
		<p class="text-sm">Take that, you ll need it.</p>
		<div class="modal-action">
			<button on:click={() => step++} class="btn btn-error">Take</button>
		</div>
	{:else if step == 4}
		<p class="text-sm">That will be 1000 gwei my friend!</p>
		<div class="modal-action">
			<button on:click={() => enter()} class="btn btn-error">Enter</button>
		</div>
	{/if}
</Modal>
