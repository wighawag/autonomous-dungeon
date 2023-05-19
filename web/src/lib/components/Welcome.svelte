<script lang="ts">
	import {connection, account} from '$lib/web3';
	import Modal from './modals/Modal.svelte';
</script>

{#if $connection.initialised && $connection.state === 'Disconnected'}
	<Modal>
		<h3 class="text-lg font-bold">Welcome to the "Forever Shifting Dungeon"</h3>
		<p class="py-4">Enter with Caution...</p>
		<div class="modal-action">
			<button on:click={() => connection.connect()} class="btn btn-error">Connect</button>
		</div>
	</Modal>
{/if}
