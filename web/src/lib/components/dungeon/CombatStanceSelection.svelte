<script context="module" lang="ts">
	import {readable, writable, type Writable} from 'svelte/store';
	import Modal from '../modals/Modal.svelte';
	import {gameState} from '$lib/game/GameState';
	import {onMount} from 'svelte';

	type PromiseResolver = {resolve: (result: number) => void; reject: (error: any) => void};
	let _promise: PromiseResolver | undefined;
	let promise: Writable<PromiseResolver | undefined> = writable();

	export function chooseCombatStance(): Promise<number> {
		return new Promise((resolve, reject) => {
			_promise = {resolve, reject};
			promise.set(_promise);
		});
	}

	function fromArrayToNumber(selection: number[]): number {
		return selection.reduce((prev, curr) => {
			return prev + Math.pow(2, curr - 1);
		}, 0);
	}

	export function resolveCombatStance(selection: number[]) {
		if (selection.length === 3) {
			_promise?.resolve(fromArrayToNumber(selection));
			_promise = undefined;
			promise.set(undefined);
		} else {
			throw new Error(`only accept 3 cards`);
		}
	}
</script>

<script lang="ts">
	$: options = [1, 2, 3, 4, 5, 6, 7, 8, 9];

	let selection: number[] = [];

	function toggle(option: number) {
		const index = selection.indexOf(option);
		if (index >= 0) {
			selection.splice(index, 1);
		} else {
			selection.length < 3 && selection.push(option);
		}
		selection = selection;
	}

	function previouslySelected(option: number) {
		if ($gameState.playerCharacter) {
			const combatStanceAvailable = $gameState.playerCharacter.combatStanceAvailable;
			const value = Math.pow(2, option - 1);

			const available = (value & combatStanceAvailable) === value;
			console.log({
				value,
				combatStanceAvailable,
				available,
			});
			return !available;
		}

		return true;
	}

	onMount(() => {
		selection = [];
	});
</script>

{#if $promise}
	<Modal>
		<h3 class="text-lg font-bold">What Battle stance will you adopt this round ?</h3>

		<div class="tabs tabs-boxed">
			{#each options as option}
				<!-- svelte-ignore a11y-click-events-have-key-events-->
				<button
					on:click={() => toggle(option)}
					class={`tab tab-lg ${
						selection.indexOf(option) >= 0 ? 'tab-active' : previouslySelected(option) ? 'btn-disabled' : ''
					}`}>{option}</button
				>
			{/each}
		</div>
		<div class="modal-action">
			<button on:click={() => resolveCombatStance(selection)} class="btn btn-error">Go</button>
		</div>
	</Modal>
{/if}
