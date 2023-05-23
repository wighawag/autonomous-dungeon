import {pendingState} from '$lib/blockchain/state/PendingState';
import {phase} from '$lib/time';
import {account, accountData} from '$lib/web3';
import type {CommitMetadata, OffchainState, OnChainAction, RevealMetadata} from '$lib/web3/account-data';
import type {RoomAction, RoomPosition} from 'jolly-roger-common';
// import type {CellAction, CellPosition} from 'jolly-roger-common';
import type {Character, Data} from 'jolly-roger-indexer';
import {derived, get, type Readable} from 'svelte/store';

export type GameState = {
	player:
		| {
				address: `0x${string}`;
				// cellPosition: CellPosition;
				// actions: CellAction[];
				position: RoomPosition;
				actions: RoomAction[];
				committed?: OnChainAction<CommitMetadata>;
				revealed?: OnChainAction<RevealMetadata>;
				commited_from_past?: OnChainAction<CommitMetadata>;
				needRecap: boolean;
		  }
		| undefined;
	playerCharacter?: Character;
	epoch: {
		hash: `0x${string}`;
		number: number;
	};
	epochBeforeReveal: {
		hash: `0x${string}`;
		number: number;
	};
	characters: Data['characters'];
};

export const gameState: Readable<GameState> = derived(
	[account, pendingState, accountData.offchainState, accountData.onchainActions],
	([$account, $pendingState, $offchainState, $onchainActions]) => {
		const playerCharacter = $account.address
			? $pendingState.characters.find((v) => v.player.toLowerCase() === $account.address?.toLowerCase())
			: undefined;
		const characters = !playerCharacter
			? $pendingState.characters
			: $pendingState.characters.filter((v) => playerCharacter.id !== v.id);

		let commitForEpoch: OnChainAction<CommitMetadata> | undefined;
		let commitForBeforeRevealEpoch: OnChainAction<CommitMetadata> | undefined;
		let revealForEpoch: OnChainAction<RevealMetadata> | undefined;

		// this special cases should not be needed anymore as we emit hash Update in Dungeon constructor
		const epoch = {...$pendingState.epoch};
		if (epoch.number === 0) {
			// special case
			epoch.number = get(phase).epoch;
		}
		const epochBeforeReveal = {...$pendingState.epochBeforeReveal};
		if (epochBeforeReveal.number === 0) {
			// special case
			epochBeforeReveal.number = get(phase).epoch;
		}
		// console.log({epochBeforeReveal, epoch});

		const needRecap = get(phase).epoch > $offchainState.lastEpochAcknowledged;

		// const $phase = get(phase);
		// const epochFromClient = $phase?.epoch;
		// console.log({epochFromClient});
		for (const entry of Object.entries($onchainActions)) {
			const txHash = entry[0];
			const action = entry[1];
			if (!action.tx.metadata) {
				continue;
			}
			if (action.tx.metadata.type === 'commit') {
				// console.log({action_epoch: action.tx.metadata.epoch.number});
				if (
					action.status === 'Success' &&
					action.inclusion === 'Included' &&
					action.tx.metadata.epoch.hash === epoch.hash &&
					action.tx.metadata.epoch.number === epoch.number
					// && epochFromClient === action.tx.metadata.epoch.number
				) {
					if (!commitForEpoch || commitForEpoch.tx.timestamp < action.tx.timestamp) {
						// we use the latest
						// TODO use nonce instead or block Number
						commitForEpoch = action as OnChainAction<CommitMetadata>; // TODO use type === "commit for typescript check
					}
				}
				if (
					action.status === 'Success' &&
					action.inclusion === 'Included' &&
					action.tx.metadata.epoch.hash === epochBeforeReveal.hash &&
					action.tx.metadata.epoch.number === epochBeforeReveal.number
				) {
					if (!commitForBeforeRevealEpoch || commitForBeforeRevealEpoch.tx.timestamp < action.tx.timestamp) {
						// we use the latest
						// TODO use nonce instead or block Number
						commitForBeforeRevealEpoch = action as OnChainAction<CommitMetadata>; // TODO use type === "commit for typescript check
					}
				}
			} else if (action.tx.metadata.type === 'reveal') {
				if (
					action.status === 'Success' &&
					action.inclusion === 'Included' &&
					action.tx.metadata.epoch.hash === epochBeforeReveal.hash &&
					action.tx.metadata.epoch.number === epochBeforeReveal.number
				) {
					if (!revealForEpoch || revealForEpoch.tx.timestamp < action.tx.timestamp) {
						// we use the latest
						// TODO use nonce instead or block Number
						revealForEpoch = action as OnChainAction<RevealMetadata>; // TODO use type === "reveal" for typescript check
					}
				}
			}
		}

		let offchainState: OffchainState = $offchainState;

		const data: GameState = {
			player: $account.address
				? {
						address: $account.address,
						// cellPosition:
						// 	offchainState.actions.length > 0
						// 		? offchainState.actions[offchainState.actions.length - 1].to
						// 		: player
						// 		? {cx: player.position.x * 3, cy: player.position.y * 3}
						// 		: {cx: 0, cy: 0},
						position:
							offchainState.actions.length > 0
								? offchainState.actions[offchainState.actions.length - 1].to
								: playerCharacter
								? playerCharacter.position
								: {x: 0, y: 0},
						actions: offchainState.actions,
						committed: commitForEpoch,
						revealed: revealForEpoch,
						commited_from_past: commitForBeforeRevealEpoch,
						needRecap,
				  }
				: undefined,
			playerCharacter,
			epoch,
			epochBeforeReveal,
			characters,
		};

		return data;
	}
);

if (typeof window !== 'undefined') {
	(window as any).gameState = gameState;
}
