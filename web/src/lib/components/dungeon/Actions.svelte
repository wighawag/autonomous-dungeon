<script lang="ts">
	import {controller} from '$lib/blockchain/state/Controller';
	import {accountData} from '$lib/web3';
	import {contracts} from '$lib/web3/viem';

	const offchainState = accountData.offchainState;

	function reset() {
		controller.reset();
	}

	function commit() {
		contracts.execute(async ({contracts}) => {
			contracts.Dungeon.write({
				functionName: 'makeCommitment',
				args: ['0x'], // TODO
			});
		});
	}

	$: actionsLeft = controller.max - $offchainState.actions.length;
</script>

{#if $offchainState.actions.length > 0}
	<div
		class={`fixed top-20 right-0 card w-96 ${actionsLeft <= 0 ? 'bg-red-500' : 'bg-neutral'} text-neutral-content m-1`}
	>
		<div class="card-body items-center text-center">
			<h2 class="card-title">Ready to Commit?</h2>
			<p>You have {actionsLeft} actions left</p>
			<div class="card-actions justify-end">
				<button class="btn btn-primary" on:click={() => commit()}>Commit</button>
				<button class="btn btn-ghost" on:click={() => reset()}>Reset</button>
			</div>
		</div>
	</div>
{/if}
