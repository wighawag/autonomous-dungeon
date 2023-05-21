import {bigIntIDToXY, getEpochHash} from 'jolly-roger-common';
import {MergedAbis, JSProcessor, fromJSProcessor} from 'ethereum-indexer-js-processor';
import contractsInfo from './contracts';

export type Data = {
	characters: {id: `0x${string}`; position: {x: number; y: number}; life: number; revealed: boolean}[];
	epoch: {
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
		};
	},
	onCommitmentMade(state, event) {
		console.log(`onCommitmentMade`);
		const {player: id} = event.args;
		const findIndex = state.characters.findIndex((v) => v.id === id);

		if (findIndex === -1) {
			state.characters.push({
				id: event.args.player,
				position: {x: 0, y: 0}, // TODO
				life: 1, // TODO
				revealed: false,
			});
		} else {
			state.characters[findIndex].revealed = false;
		}
	},
	onPlayerUpdate(state, event) {
		console.log(`onStateUpdate`);
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
		console.log(`onEpochHash`, event.args.epoch, event.args.epochHash);
		state.epoch = {
			hash: event.args.epochHash,
			number: Number(event.args.epoch),
		};
	},
};

export const createProcessor = fromJSProcessor(() => TinyRogerIndexerProcessor);
