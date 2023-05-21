import {bigIntIDToXY, getEpochHash} from 'jolly-roger-common';
import {MergedAbis, JSProcessor, fromJSProcessor} from 'ethereum-indexer-js-processor';
import contractsInfo from './contracts';

export type Character = {id: `0x${string}`; position: {x: number; y: number}; life: number; revealed: boolean};

export type Data = {
	characters: Character[];
	epoch: {
		hash: `0x${string}`;
		number: number;
	};
	epochBeforeReveal: {
		hash: `0x${string}`;
		number: number;
	};
};

const TinyRogerIndexerProcessor: JSProcessor<MergedAbis<typeof contractsInfo.contracts>, Data> = {
	version: '__VERSION_HASH__',
	construct(): Data {
		return {
			characters: [],
			epoch: {
				// TODO use an event ? or a constructor arg ?
				hash: '0x0000000000000000000000000000000000000000000000000000000000000000',
				number: 0,
			},
			epochBeforeReveal: {
				hash: '0x0000000000000000000000000000000000000000000000000000000000000000',
				number: 0,
			},
		};
	},
	onCommitmentMade(state, event) {
		const {player: id} = event.args;
		const findIndex = state.characters.findIndex((v) => v.id === id);

		if (findIndex === -1) {
			// this is not possible as of now
			// the contract emit PlayerUpdate first
			// and onPlayerUpdate will add the character
			state.characters.push({
				id: event.args.player,
				position: {x: 0, y: 0}, // TODO
				life: 0, // TODO
				revealed: false,
			});
		} else {
			state.characters[findIndex].revealed = false;
		}

		if (state.epochBeforeReveal.number !== state.epoch.number) {
			state.epochBeforeReveal = {
				hash: state.epoch.hash,
				number: state.epoch.number,
			};
		}
	},
	onPlayerUpdate(state, event) {
		// TODO
		// for now the id is the player
		// but we need to change that
		const {player: id, life, position: positionBigInt} = event.args;

		const position = bigIntIDToXY(positionBigInt);

		const findIndex = state.characters.findIndex((v) => v.id === id);

		if (findIndex === -1) {
			state.characters.push({
				id: event.args.player,
				position,
				life: event.args.life,
				revealed: true,
			});
		} else {
			state.characters[findIndex].position = position;
			state.characters[findIndex].life = event.args.life;
			state.characters[findIndex].revealed = true;
		}
	},

	onEpochHashUpdate(state, event) {
		state.epoch = {
			hash: event.args.epochHash,
			number: Number(event.args.epoch),
		};
	},
};

export const createProcessor = fromJSProcessor(() => TinyRogerIndexerProcessor);
