<script lang="ts">
	import {offchainState} from '$lib/blockchain/state/OffchainState';
	import {contracts} from '$lib/web3/viem';

	function reset() {
		offchainState.reset();
	}

	function commit() {
		contracts.execute(async ({contracts}) => {
			contracts.Registry.write({
				functionName: 'setMessage',
				args: ['dsdwsa', 1],
			});
		});
	}
</script>

{#if $offchainState.actions.length > 0}
	<div class="fixed top-20 right-0 card w-96 bg-neutral text-neutral-content m-1">
		<div class="card-body items-center text-center">
			<h2 class="card-title">Ready to Commit?</h2>
			<p>You have {64 - $offchainState.actions.length} actions left</p>
			<div class="card-actions justify-end">
				<button class="btn btn-primary" on:click={() => commit()}>Commit</button>
				<button class="btn btn-ghost" on:click={() => reset()}>Reset</button>
			</div>
		</div>
	</div>
{/if}
