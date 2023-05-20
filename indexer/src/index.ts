import {bigIntIDToXY} from 'jolly-roger-common';
import {MergedAbis, JSProcessor, fromJSProcessor} from 'ethereum-indexer-js-processor';
import contractsInfo from './contracts';

export type Data = {
	characters: {id: `0x${string}`; position: {x: number; y: number}; life: number}[];
};

const TinyRogerIndexerProcessor: JSProcessor<MergedAbis<typeof contractsInfo.contracts>, Data> = {
	version: '__VERSION_HASH__',
	construct(): Data {
		return {characters: []};
	},
	onStateUpdate(state, event) {
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
};

export const createProcessor = fromJSProcessor(() => TinyRogerIndexerProcessor);
