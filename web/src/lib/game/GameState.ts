import {pendingState} from '$lib/blockchain/state/PendingState';
import {account, accountData} from '$lib/web3';
import type {CommitMetadata, OnChainAction} from '$lib/web3/account-data';
import type {CellAction, CellPosition} from 'jolly-roger-common';
import type {Data} from 'jolly-roger-indexer';
import {derived, type Readable} from 'svelte/store';

export type GameState = {
	player:
		| {
				address: `0x${string}`;
				cellPosition: CellPosition;
				actions: CellAction[];
				committed?: OnChainAction<CommitMetadata>;
				revealed: boolean;
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

		let onchainActionForEpoch: OnChainAction<CommitMetadata> | undefined;
		for (const entry of Object.entries($onchainActions)) {
			const txHash = entry[0];
			const action = entry[1];
			if (
				action.status === 'Success' &&
				action.inclusion === 'Included' &&
				action.tx.metadata.type === 'commit' &&
				action.tx.metadata.epoch.hash === $pendingState.epoch.hash &&
				action.tx.metadata.epoch.number === $pendingState.epoch.number
			) {
				if (!onchainActionForEpoch || onchainActionForEpoch.tx.timestamp < action.tx.timestamp) {
					// we use the latest
					// TODO use nonce instead or block Number
					onchainActionForEpoch = action as OnChainAction<CommitMetadata>; // TODO use type === commit for typescript check
				}
			}
		}

		const data: GameState = {
			player: player
				? {
						address: player.id,
						cellPosition:
							$offchainState.actions.length > 0
								? $offchainState.actions[$offchainState.actions.length - 1].to
								: player
								? {cx: player.position.x * 3, cy: player.position.y * 3}
								: {cx: 0, cy: 0},
						actions: $offchainState.actions,
						committed: onchainActionForEpoch,
						revealed: player.revealed,
				  }
				: undefined,
			epoch: $pendingState.epoch,
			characters,
		};

		return data;
	}
);