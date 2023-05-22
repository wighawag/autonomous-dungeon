import {bigIntIDToXY, getEpochHash} from 'jolly-roger-common';
import {MergedAbis, JSProcessor, fromJSProcessor} from 'ethereum-indexer-js-processor';
import contractsInfo from './contracts';

export type Character = {
	player: `0x${string}`;
	id: bigint;
	position: {x: number; y: number};
	gold: bigint;
	life: number;
	equipment: `0x${string}`;
	combatStanceAvailable: number;
	revealed: boolean;
};

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
	onCharacterEnterTheDungeon(state, event) {
		const {characterID: id, player} = event.args;
		const findIndex = state.characters.findIndex((v) => v.id === id);

		if (findIndex === -1) {
			// this is not possible as of now
			// the contract emit PlayerUpdate first
			// and onPlayerUpdate will add the character
			state.characters.push({
				player,
				id,
				position: {x: 0, y: 0},
				life: 0,
				gold: 0n,
				equipment: '0x0000000000000000000000000000000000000000000000000000000000000000',
				combatStanceAvailable: 0,
				revealed: false,
			});
		} else {
			state.characters[findIndex].revealed = false;
		}
	},
	onCommitmentMade(state, event) {
		const {characterID: id} = event.args;
		const findIndex = state.characters.findIndex((v) => v.id === id);

		if (findIndex === -1) {
			throw new Error(`cannot reach there`);
			// this is not possible as of now
			// the contract emit onCharacterEnterTheDungeon first
			// and onCharacterEnterTheDungeon will add the character
		} else {
			// we are not using this anymore
			state.characters[findIndex].revealed = false;
		}

		if (state.epochBeforeReveal.number !== state.epoch.number) {
			state.epochBeforeReveal = {
				hash: state.epoch.hash,
				number: state.epoch.number,
			};
		}
	},
	onCharacterUpdate(state, event) {
		// TODO
		// for now the id is the player
		// but we need to change that
		const {characterID: id, life, position: positionBigInt} = event.args;

		const position = bigIntIDToXY(positionBigInt);

		const findIndex = state.characters.findIndex((v) => v.id === id);

		if (findIndex === -1) {
			throw new Error(`cannot reach there`);
			// this is not possible as of now
			// the contract emit onCharacterEnterTheDungeon first
			// and onCharacterEnterTheDungeon will add the character
		} else {
			state.characters[findIndex].position = position;
			state.characters[findIndex].life = event.args.life;
			state.characters[findIndex].gold = event.args.gold;
			state.characters[findIndex].equipment = event.args.equipment;
			state.characters[findIndex].combatStanceAvailable = event.args.combatStanceAvailable;
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
