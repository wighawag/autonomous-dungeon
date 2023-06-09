<script lang="ts">
	import {controller} from '$lib/game/Controller';
	import {gameState} from '$lib/game/GameState';
	import {account, accountData, devProvider, execute} from '$lib/web3';
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
	import {increaseDungeonTime} from '$lib/utils/dungeon';
	import {phase} from '$lib/time';
	import {params} from '$lib/config';

	const execute_increaseBlockTime = createExecutor(increaseDungeonTime); //createExecutor(increaseBlockTime);

	const offchainState = accountData.offchainState;

	function reset() {
		controller.reset();
	}

	function commit() {
		contracts.execute(async ({contracts, connection}) => {
			const epochNumber = get(phase).epoch;
			if (!epochNumber) {
				throw new Error(`no epoch from phase`);
			}
			const epoch = {...get(gameState).epoch};
			if (epoch.number === 0) {
				// special case:
				epoch.number = epochNumber;
			}
			if (epochNumber != epoch.number) {
				throw new Error(`different epoch detected local:${epochNumber} remote:${epoch.number}`);
			}

			const actions = accountData.$offchainState.actions;
			const combatStance = await chooseCombatStance();
			const contractActions = actions.map((v) => ({
				position: xyToBigIntID(v.to.x, v.to.y),
				pickTreasure: v.treasure === 'pick',
			}));

			// TODO use deterministic secret using private wallet:
			// const secret = keccak256(['bytes32', 'bytes32'], [privateWallet.hashString(), epochHash]);
			const secret = params['demo']
				? '0xe9a962e28eff5332c18f8514440376a5336d3005ae5d427ef8e8e619a1ce87f8' // '0xebe98392422852aeb80cd4e114072c205ea0e603949d33eeadfba1ecb04e29f6'
				: // 0xb57c86b3791db14b2967759155c29086f149621fbb5180b192170e93331a560c
				  ((`0x` +
						[...crypto.getRandomValues(new Uint8Array(32))]
							.map((m) => ('0' + m.toString(16)).slice(-2))
							.join('')) as `0x${string}`);
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
				epoch,
				actions,
				secret,
				combatStance,
			});
			contracts.Dungeon.write({
				functionName: 'makeCommitment',
				args: [$gameState.playerCharacter!.id, commitmentHash],
			});
		});
	}

	function reveal(force = false) {
		contracts.execute(async ({contracts, connection, account}) => {
			const epochNumber = get(phase).epoch;
			if (!epochNumber) {
				throw new Error(`no epoch from phase`);
			}
			const epochBeforeReveal = get(gameState).epochBeforeReveal;
			if (epochNumber !== epochBeforeReveal.number) {
				throw new Error(`different epoch detected local:${epochNumber} remote:${epochBeforeReveal.number}`);
			}

			const onchainActions = accountData.$onchainActions;
			let actionToCommit: OnChainAction | undefined;
			let actions: RoomAction[] | undefined;
			let secret: `0x${string}` | undefined;
			let txHash: `0x${string}` | undefined;
			let combatStance: number | undefined;
			for (const onchainAction of Object.entries(onchainActions)) {
				const metadata = onchainAction[1].tx.metadata;
				if (!metadata) {
					continue;
				}
				if (metadata.type === 'reveal') {
				} else if (metadata.type === 'commit') {
					if (!actionToCommit || actionToCommit.tx.timestamp < onchainAction[1].tx.timestamp) {
						actionToCommit = onchainAction[1];
						txHash = onchainAction[0] as `0x${string}`;
						actions = metadata.actions;
						secret = metadata.secret;
						combatStance = metadata.combatStance;
					}
				}
			}

			if (!actionToCommit || !secret || !actions || !combatStance) {
				throw new Error(`no action to commit`);
			}

			const contractActions = actions.map((v) => ({
				position: xyToBigIntID(v.to.x, v.to.y),
				pickTreasure: v.treasure === 'pick',
			}));

			// TODO jolly-rogeR: type-safe via web3-connection type config (AccountData Management)
			connection.provider.setNextMetadata({
				type: 'reveal',
				epoch: epochBeforeReveal,
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

	$: admin =
		$account.address?.toLowerCase() === '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266'.toLowerCase() ||
		$account.address?.toLowerCase() === '0x61c461EcC993aaDEB7e4b47E96d1B8cC37314B20'.toLowerCase();
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

						{#if admin}
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
						{/if}
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
					{#if admin}
						{#if $execute_increaseBlockTime.error}
							{$execute_increaseBlockTime.error}
							<button class={`btn btn-error m-2`} on:click={() => execute_increaseBlockTime.acknowledgeError()}
								>Ok</button
							>
						{:else}
							<button
								class={`btn btn-secondary ${$execute_increaseBlockTime.executing ? 'btn-disabled' : ''} m-2`}
								on:click={() => execute_increaseBlockTime.execute($phase.timeLeftToReveal)}
								>Switch to Commit Phase</button
							>
						{/if}
					{/if}
				</div>
			{:else if $gameState.player?.commited_from_past && !$gameState.player?.revealed}
				<p>{timeToText($phase.timeLeftToReveal)} left</p>
				<h2 class="card-title">Reveal your move!</h2>
				<div class="card-actions justify-end">
					<button class="btn btn-primary" on:click={() => reveal()}>Reveal</button>
					<!-- {#if devProvider}
						<button class="btn btn-error" on:click={() => reveal(true)}>Force Reveal</button>
					{/if} -->
				</div>
			{:else}
				<p>{timeToText($phase.timeLeftToReveal)} left</p>
				<h2 class="card-title">Wait Until The Resolution Phase ends</h2>
				{#if admin}
					<button
						class={`btn btn-secondary ${$execute_increaseBlockTime.executing ? 'btn-disabled' : ''} m-2`}
						on:click={() => execute_increaseBlockTime.execute($phase.timeLeftToReveal)}>Switch to Commit Phase</button
					>
				{/if}
			{/if}
		</div>
	{/if}
</div>

<CombatStanceSelection />
