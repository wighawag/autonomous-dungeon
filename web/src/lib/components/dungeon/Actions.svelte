<script lang="ts">
	import {controller, phase} from '$lib/game/Controller';
	import {gameState} from '$lib/game/GameState';
	import {accountData, devProvider, execute} from '$lib/web3';
	import type {OnChainAction} from '$lib/web3/account-data';
	import {contracts} from '$lib/web3/viem';
	import {xyToBigIntID, type RoomAction} from 'jolly-roger-common';
	import {get} from 'svelte/store';
	import {encodeAbiParameters, encodePacked, keccak256} from 'viem';
	import {createExecutor, increaseBlockTime} from '$lib/utils/debug';
	import {timeToText} from '$lib/utils/time';
	import {camera} from '$lib/render/camera';
	import {ROOM_SIZE} from '$lib/render/Renderer2D';
	import CombatStanceSelection, {chooseCombatStance} from './CombatStanceSelection.svelte';

	const execute_increaseBlockTime = createExecutor(increaseBlockTime);

	const offchainState = accountData.offchainState;

	function reset() {
		controller.reset();
	}

	function commit() {
		contracts.execute(async ({contracts, connection}) => {
			const actions = accountData.$offchainState.actions;
			const combatStance = await chooseCombatStance();
			const contractActions = actions.map((v) => ({
				position: xyToBigIntID(v.to.x, v.to.y),
				pickTreasure: v.treasure === 'pick',
			}));

			// TODO use deterministic secret using private wallet:
			// const secret = keccak256(['bytes32', 'bytes32'], [privateWallet.hashString(), epochHash]);
			const secret = (`0x` +
				[...crypto.getRandomValues(new Uint8Array(32))]
					.map((m) => ('0' + m.toString(16)).slice(-2))
					.join('')) as `0x${string}`;
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
								{
									name: 'pickTreasure',
									type: 'bool',
								},
							],
						},
						{type: 'uint16', name: 'combatStance'},
					],
					[secret, contractActions, combatStance]
				)
			).slice(0, 50) as `0x${string}`;

			connection.provider.setNextMetadata({
				type: 'commit',
				epoch: get(gameState).epoch,
				actions,
				secret,
			});
			contracts.Dungeon.write({
				functionName: 'makeCommitment',
				args: [$gameState.playerCharacter!.id, commitmentHash],
			});
		});
	}

	function reveal(force = false) {
		contracts.execute(async ({contracts, connection, account}) => {
			const onchainActions = accountData.$onchainActions;
			const combatStance = 7; // TODO
			let actionToCommit: OnChainAction | undefined;
			let actions: RoomAction[] | undefined;
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

			const contractActions = actions.map((v) => ({
				position: xyToBigIntID(v.to.x, v.to.y),
				pickTreasure: v.treasure === 'pick',
			}));

			// TODO jolly-rogeR: type-safe via web3-connection type config (AccountData Management)
			connection.provider.setNextMetadata({
				type: 'reveal',
				epoch: get(gameState).epochBeforeReveal,
				commitTx: txHash,
			});
			contracts.Dungeon.write({
				functionName: 'resolve',
				args: [
					$gameState.playerCharacter!.id,
					secret,
					contractActions,
					combatStance,
					'0x000000000000000000000000000000000000000000000000',
				],
				gas: force ? 1000000n : undefined,
			});
		});
	}

	$: actionsLeft = controller.max - $offchainState.actions.length;
</script>

<div
	class={`fixed top-20 right-0 card w-96 ${actionsLeft <= 0 ? 'bg-red-500' : 'bg-neutral'} text-neutral-content m-1`}
>
	{#if !$gameState.playerCharacter}
		<!-- <div class="card-body items-center text-center">
			<h2 class="card-title">Do You Want to Enter The Dungeon?</h2>
			<button class="btn btn-secondary" on:click={() => 2}>Enter</button>
		</div> -->
	{:else if $gameState.player}
		<div class="card-body items-center text-center">
			{#if $phase.comitting}
				{#if $offchainState.actions.length == 0}
					<p>{timeToText($phase.timeLeftToCommit)} left</p>
					<h2 class="card-title">Make your move</h2>
					<button
						class="btn btn-secondary"
						on:click={() =>
							$gameState.player
								? camera.navigate(
										$gameState.player.position.x * ROOM_SIZE,
										$gameState.player.position.y * ROOM_SIZE,
										0.5
								  )
								: undefined}>Center</button
					>
				{:else}
					<p>{timeToText($phase.timeLeftToCommit)} left</p>

					{#if $gameState.player?.committed}
						<h2 class="card-title">Action Commited</h2>
						<p>Please wait for the reveal phase</p>
						<div class="card-actions justify-end">
							{#if $execute_increaseBlockTime.error}
								{$execute_increaseBlockTime.error}
								<button class={`btn btn-error m-2`} on:click={() => execute_increaseBlockTime.acknowledgeError()}
									>Ok</button
								>
							{:else}
								<button
									class={`btn btn-secondary ${$execute_increaseBlockTime.executing ? 'btn-disabled' : ''} m-2`}
									on:click={() => execute_increaseBlockTime.execute($phase.timeLeftToCommit)}
									>Switch to Reveal Phase</button
								>
							{/if}
							<!-- <button class="btn btn-primary" on:click={() => commit()}>Commit</button> -->
							<!-- <button class="btn btn-ghost" on:click={() => reset()}>Reset</button> -->
						</div>
					{:else}
						<h2 class="card-title">Ready to Commit?</h2>
						<p>You have {actionsLeft} actions left</p>
						<div class="card-actions justify-end">
							<button class="btn btn-primary" on:click={() => commit()}>Commit</button>
							<button class="btn btn-ghost" on:click={() => reset()}>Reset</button>
						</div>
					{/if}
				{/if}
			{:else if $gameState.player?.revealed}
				<h2 class="card-title">Action Revealed</h2>
				<div class="card-actions justify-end">
					<p>Please wait for the next epoch and see the results of all player's actions!</p>
					{#if $execute_increaseBlockTime.error}
						{$execute_increaseBlockTime.error}
						<button class={`btn btn-error m-2`} on:click={() => execute_increaseBlockTime.acknowledgeError()}>Ok</button
						>
					{:else}
						<button
							class={`btn btn-secondary ${$execute_increaseBlockTime.executing ? 'btn-disabled' : ''} m-2`}
							on:click={() => execute_increaseBlockTime.execute($phase.timeLeftToReveal)}>Switch to Commit Phase</button
						>
					{/if}
				</div>
			{:else if $gameState.player?.commited_from_past && !$gameState.player?.revealed}
				<p>{timeToText($phase.timeLeftToReveal)} left</p>
				<h2 class="card-title">Reveal your move!</h2>
				<div class="card-actions justify-end">
					<button class="btn btn-primary" on:click={() => reveal()}>Reveal</button>
					{#if devProvider}
						<button class="btn btn-error" on:click={() => reveal(true)}>Force Reveal</button>
					{/if}
				</div>
			{:else}
				<p>{timeToText($phase.timeLeftToReveal)} left</p>
				<h2 class="card-title">Wait Until The Resolution Phase ends</h2>
				<button
					class={`btn btn-secondary ${$execute_increaseBlockTime.executing ? 'btn-disabled' : ''} m-2`}
					on:click={() => execute_increaseBlockTime.execute($phase.timeLeftToReveal)}>Switch to Commit Phase</button
				>
			{/if}
		</div>
	{/if}
</div>

<CombatStanceSelection />
