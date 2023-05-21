import {bigIntIDToXY, getEpochHash} from 'jolly-roger-common';
import {MergedAbis, JSProcessor, fromJSProcessor} from 'ethereum-indexer-js-processor';
import contractsInfo from './contracts';

export type Data = {
	characters: {id: `0x${string}`; position: {x: number; y: number}; life: number}[];
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
				// TODO
				hash: getEpochHash(0),
				number: 0,
			},
		};
	},
	onStateUpdate(state, event) {
		console.log({event, state});
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
			});
		} else {
			state.characters[findIndex].position = position;
			state.characters[findIndex].life = event.args.life;
		}
	},

	onEpochHash(state, event) {
		state.epoch = {
			hash: event.args.epochHash,
			number: Number(event.args.epoch),
		};
	},
};

export const createProcessor = fromJSProcessor(() => TinyRogerIndexerProcessor);
