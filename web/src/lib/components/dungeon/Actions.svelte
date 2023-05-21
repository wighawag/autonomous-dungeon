<script lang="ts">
	import {controller, phase} from '$lib/game/Controller';
	import {accountData} from '$lib/web3';
	import type {CommitAction, OnChainAction} from '$lib/web3/account-data';
	import {contracts} from '$lib/web3/viem';
	import {fromCellActionsToRoomActions, xyToBigIntID, type RoomAction} from 'jolly-roger-common';
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
				type: 'commit',
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

	function reveal() {
		contracts.execute(async ({contracts, connection, account}) => {
			const onchainActions = accountData.$onchainActions;
			let actionToCommit: OnChainAction | undefined;
			let actions: CommitAction[] | undefined;
			let secret: `0x${string}` | undefined;
			let txHash: `0x${string}` | undefined;
			for (const onchainAction of Object.entries(onchainActions)) {
				const metadata = onchainAction[1].tx.metadata;
				console.log({metadata});
				if (metadata.type === 'reveal') {
				} else if (metadata.type === 'commit') {
					if (!actionToCommit || actionToCommit.tx.timestamp < onchainAction[1].tx.timestamp) {
						actionToCommit = onchainAction[1];
						txHash = onchainAction[0] as `0x${string}`;
						actions = metadata.actions;
						secret = metadata.secret;
					}
				}
			}

			if (!actionToCommit || !secret || !actions) {
				throw new Error(`no action to commit`);
			}

			// TODO jolly-rogeR: type-safe via web3-connection type config (AccountData Management)
			connection.provider.setNextMetadata({
				type: 'reveal',
				commitTx: txHash,
			});
			contracts.Dungeon.write({
				functionName: 'resolve',
				args: [account.address, secret, actions, '0x000000000000000000000000000000000000000000000000'],
			});
		});
	}

	$: actionsLeft = controller.max - $offchainState.actions.length;
</script>

<div
	class={`fixed top-20 right-0 card w-96 ${actionsLeft <= 0 ? 'bg-red-500' : 'bg-neutral'} text-neutral-content m-1`}
>
	<!-- {$state.characters.length} characters -->
	{#if $offchainState.actions.length > 0}
		<div class="card-body items-center text-center">
			{#if $phase.comitting}
				<p>{$phase.timeLeftToCommit} seconds left</p>
				<h2 class="card-title">Ready to Commit?</h2>
				<p>You have {actionsLeft} actions left</p>
				<div class="card-actions justify-end">
					<button class="btn btn-primary" on:click={() => commit()}>Commit</button>
					<button class="btn btn-ghost" on:click={() => reset()}>Reset</button>
				</div>
			{:else}
				<p>{$phase.timeLeftToReveal} seconds left</p>
				<h2 class="card-title">Reveal your move!</h2>
				<div class="card-actions justify-end">
					<button class="btn btn-primary" on:click={() => reveal()}>Reveal</button>
				</div>
			{/if}
		</div>
	{/if}
</div>
