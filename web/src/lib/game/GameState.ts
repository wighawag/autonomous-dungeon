import {pendingState} from '$lib/blockchain/state/PendingState';
import {account, accountData} from '$lib/web3';
import type {CellAction, CellPosition} from 'jolly-roger-common';
import type {Data} from 'jolly-roger-indexer';
import {derived, type Readable} from 'svelte/store';

export type GameState = {
	player:
		| {
				address: `0x${string}`;
				cellPosition: CellPosition;
				actions: CellAction[];
		  }
		| undefined;
	epoch: {
		hash: `0x${string}`;
		number: number;
	};
	characters: Data['characters'];
};

export const gameState: Readable<GameState> = derived(
	[account, pendingState, accountData.offchainState, accountData.onchainActions],
	([$account, $pendingState, $offchainState, $onchainActions]) => {
		const player = $account.address
			? $pendingState.characters.find((v) => v.id.toLowerCase() === $account.address?.toLowerCase())
			: undefined;
		const characters = !player ? $pendingState.characters : $pendingState.characters.filter((v) => player.id !== v.id);

		const data = {
			player: $account.address
				? {
						address: $account.address,
						cellPosition:
							$offchainState.actions.length > 0
								? $offchainState.actions[$offchainState.actions.length - 1].to
								: player
								? {cx: player.position.x * 3, cy: player.position.y * 3}
								: {cx: 0, cy: 0},
						actions: $offchainState.actions,
				  }
				: undefined,
			epoch: $pendingState.epoch,
			characters,
		};

		console.log({gameState: data});

		return data;
	}
);
