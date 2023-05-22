<script lang="ts">
	import {controller} from '$lib/game/Controller';
	import {gameState} from '$lib/game/GameState';
	import {phase} from '$lib/time';
	import Modal from '../modals/Modal.svelte';
	const dungeon = controller.dungeon;

	$: currentRoom =
		$phase.comitting && $gameState.playerCharacter && $gameState.player
			? $dungeon.getRoom($gameState.player.position.x, $gameState.player.position.y)
			: undefined;

	let picking: undefined | 'pick' | 'ignore';
	$: {
		picking = undefined;
		if (currentRoom && $gameState.player) {
			if ($gameState.player.actions.length > 0) {
				const lastAction = $gameState.player.actions[$gameState.player.actions.length - 1];
				if (lastAction.to.x === currentRoom.x && lastAction.to.y == currentRoom.y && lastAction.treasure) {
					picking = lastAction.treasure;
				} else {
					for (const action of $gameState.player.actions) {
						if (action.to.x === currentRoom.x && action.to.y === currentRoom.y) {
							if (action.treasure === 'pick') {
								picking = action.treasure;
							}
						}
					}
				}
			}
		}
	}
</script>

{#if currentRoom && currentRoom.treasure && !picking}
	<Modal>
		<h3 class="text-lg font-bold">You Stumbled upon some treasure!</h3>

		<div class="modal-action">
			<button on:click={() => controller.pickTreasure(true)} class="btn btn-success">Pick it Up (10 AP)</button>
			<button on:click={() => controller.pickTreasure(false)} class="btn btn-error">Ignore</button>
		</div>
	</Modal>
{/if}
