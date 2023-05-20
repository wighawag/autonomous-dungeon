<script lang="ts">
	import {controller} from '$lib/blockchain/state/Controller';
	import {accountData} from '$lib/web3';
	import {contracts} from '$lib/web3/viem';
	import {fromCellActionsToRoomActions, xyToBigIntID} from 'jolly-roger-common';
	import {encodeAbiParameters, keccak256} from 'viem';

	const offchainState = accountData.offchainState;

	function reset() {
		controller.reset();
	}

	function commit() {
		contracts.execute(async ({contracts, connection}) => {
			const cellActions = accountData.$offchainState.actions;
			const roomActions = fromCellActionsToRoomActions(cellActions);
			const actions = roomActions.map((v) => ({
				position: xyToBigIntID(v.to.x, v.to.y),
			}));
			// TODO random
			const secret = '0x0000000000000000000000000000000000000000000000000000000000000000';
			const commitmentHash = keccak256(
				encodeAbiParameters(
					[
						{type: 'bytes32', name: 'secret'},
						{
							type: 'tuple[]',
							components: [
								{
									name: 'position',
									type: 'uint64',
								},
							],
						},
					],
					[secret, actions]
				)
			).slice(0, 50) as `0x${string}`;

			connection.provider.setNextMetadata({
				actions,
				cellActions,
				secret,
			});
			contracts.Dungeon.write({
				functionName: 'makeCommitment',
				args: [commitmentHash],
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
