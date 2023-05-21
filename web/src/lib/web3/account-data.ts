import {writable} from 'svelte/store';

import type {EIP1193TransactionWithMetadata} from 'web3-connection';
import {initEmitter} from '$external/callbacks';
import type {PendingTransaction} from '$external/tx-observer';
// import {bnReplacer, bnReviver, type CellAction, type CellPosition, type RoomAction} from 'jolly-roger-common';
import {bnReplacer, bnReviver, type RoomAction, type RoomPosition} from 'jolly-roger-common';
import {logs} from 'named-logs';

const logger = logs('account-data');

export type CommitMetadata = {
	type: 'commit'; // TODO remove undefined
	// cellActions: CellAction[];
	roomActions: RoomAction[]; // no
	actions: RoomAction[];
	secret: `0x${string}`;
};

export type RevealMetadata = {
	type: 'reveal';

	commitTx: `0x${string}`;
};

export type AnyMetadata = CommitMetadata | RevealMetadata;

export type DungeonTransaction<T = AnyMetadata> = EIP1193TransactionWithMetadata & {
	metadata: {
		epoch: {
			hash: `0x${string}`;
			number: number;
		};
	} & T;
};

export type OnChainAction<T = AnyMetadata> = {
	tx: DungeonTransaction<T>;
} & (
	| {
			inclusion: 'BeingFetched' | 'Broadcasted' | 'NotFound' | 'Cancelled';
			final: undefined;
			status: undefined;
	  }
	| {
			inclusion: 'Included';
			status: 'Failure' | 'Success';
			final: number;
	  }
);

export type Epoch = {hash: `0x${string}`};
export type OnChainActions = {[hash: `0x${string}`]: OnChainAction};

export type OffchainState = {
	epoch?: Epoch;
	// actions: CellAction[];
	actions: RoomAction[];
};

const defaultOffchainState: OffchainState = {
	actions: [],
};

export type AccountData = {
	onchainActions: OnChainActions;
	offchainState: OffchainState;
};

const emptyAccountData: AccountData = {onchainActions: {}, offchainState: defaultOffchainState};

function fromOnChainActionToPendingTransaction(hash: `0x${string}`, onchainAction: OnChainAction): PendingTransaction {
	return {
		hash,
		request: onchainAction.tx,
		final: onchainAction.final,
		inclusion: onchainAction.inclusion,
		status: onchainAction.status,
	} as PendingTransaction;
}

export function initAccountData() {
	const emitter = initEmitter<{name: 'newTx'; txs: PendingTransaction[]} | {name: 'clear'}>();

	const $onchainActions: OnChainActions = {};
	const onchainActions = writable<OnChainActions>($onchainActions);

	const $offchainState: OffchainState = defaultOffchainState;
	const offchainState = writable<OffchainState>($offchainState);

	let key: string | undefined;
	async function load(address: `0x${string}`, chainId: string, genesisHash?: string) {
		const data = await _load(address, chainId, genesisHash);

		if (data.offchainState) {
			$offchainState.actions = data.offchainState.actions;
			$offchainState.epoch = data.offchainState.epoch;
			offchainState.set($offchainState);
		}

		for (const hash in data.onchainActions) {
			const onchainAction = (data.onchainActions as any)[hash];
			($onchainActions as any)[hash] = onchainAction;
		}
		onchainActions.set($onchainActions);
		handleTxs($onchainActions);
	}

	function handleTxs(onChainActions: OnChainActions) {
		const pending_transactions: PendingTransaction[] = [];
		for (const hash in onChainActions) {
			const onchainAction = (onChainActions as any)[hash];
			pending_transactions.push(fromOnChainActionToPendingTransaction(hash as `0x${string}`, onchainAction));
		}
		emitter.emit({name: 'newTx', txs: pending_transactions});
	}

	async function unload() {
		//save before unload
		await save();

		// delete all
		for (const hash of Object.keys($onchainActions)) {
			delete ($onchainActions as any)[hash];
		}
		onchainActions.set($onchainActions);
		$offchainState.actions = [];
		$offchainState.epoch = undefined;
		offchainState.set($offchainState);
		emitter.emit({name: 'clear'});
	}

	async function save() {
		_save({
			onchainActions: $onchainActions,
			offchainState: $offchainState,
		});
	}

	async function _load(address: `0x${string}`, chainId: string, genesisHash?: string): Promise<AccountData> {
		key = `account_${address}_${chainId}_${genesisHash}`;
		let dataSTR: string | undefined | null;
		try {
			dataSTR = localStorage.getItem(key);
		} catch {}
		const data: AccountData = dataSTR ? JSON.parse(dataSTR, bnReviver) : emptyAccountData;
		return data;
	}

	async function _save(accountData: AccountData) {
		if (key) {
			logger.info(`saving account data`);
			localStorage.setItem(key, JSON.stringify(accountData, bnReplacer));
		}
	}

	function addAction(tx: EIP1193TransactionWithMetadata, hash: `0x${string}`, inclusion?: 'Broadcasted') {
		if (!tx.metadata) {
			console.error(`no metadata on the tx, we still save it, but this will not let us know what this tx is about`);
		} else if (typeof tx.metadata !== 'object') {
			console.error(`metadata is not an object and so do not conform to DungeonTransaction`);
		} else {
			if (!('type' in tx.metadata)) {
				console.error(`no field "type" in the metadata and so do not conform to DungeonTransaction`);
			}
		}

		const onchainAction: OnChainAction = {
			tx: tx as DungeonTransaction,
			inclusion: inclusion || 'BeingFetched',
			final: undefined,
			status: undefined,
		};

		$onchainActions[hash] = onchainAction;
		save();
		onchainActions.set($onchainActions);

		emitter.emit({
			name: 'newTx',
			txs: [fromOnChainActionToPendingTransaction(hash, onchainAction)],
		});
	}

	function _updateTx(pendingTransaction: PendingTransaction) {
		const action = $onchainActions[pendingTransaction.hash];
		if (action) {
			action.inclusion = pendingTransaction.inclusion;
			action.status = pendingTransaction.status;
			action.final = pendingTransaction.final;

			// for autonomous-dungeon we need to keep the secret data when commiting
			// // TODO specific to jolly-roger which does not need user acknowledgement for deleting the actions
			// if (action.final) {
			// 	delete $onchainActions[pendingTransaction.hash];
			// }
		}
	}

	function updateTx(pendingTransaction: PendingTransaction) {
		_updateTx(pendingTransaction);
		onchainActions.set($onchainActions);
		save();
	}

	function updateTxs(pendingTransactions: PendingTransaction[]) {
		for (const p of pendingTransactions) {
			_updateTx(p);
		}
		onchainActions.set($onchainActions);
		save();
	}

	// use with caution
	async function _reset() {
		await unload();
		if (key) {
			localStorage.removeItem(key);
		}
	}

	function resetOffchainState(alsoSave: boolean = true) {
		$offchainState.actions.splice(0, $offchainState.actions.length);

		$offchainState.epoch = undefined;
		if (alsoSave) {
			save();
		}
		offchainState.set($offchainState);
	}

	// function move(epoch: Epoch, from: CellPosition, to: CellPosition) {
	// 	if ($offchainState.epoch && epoch.hash !== $offchainState.epoch.hash) {
	// 		resetOffchainState(false);
	// 		$offchainState.epoch = epoch;
	// 	}
	// 	$offchainState.actions.push({type: 'move', to, from});
	// 	save();
	// 	offchainState.set($offchainState);
	// }

	function move(epoch: Epoch, from: RoomPosition, to: RoomPosition) {
		if ($offchainState.epoch && epoch.hash !== $offchainState.epoch.hash) {
			resetOffchainState(false);
			$offchainState.epoch = epoch;
		}
		$offchainState.actions.push({type: 'move', to, from});
		save();
		offchainState.set($offchainState);
	}

	function back() {
		$offchainState.actions.splice($offchainState.actions.length - 1, 1);
		save();
		offchainState.set($offchainState);
	}

	return {
		$onchainActions,
		onchainActions: {
			subscribe: onchainActions.subscribe,
		},

		$offchainState,
		offchainState: {
			subscribe: offchainState.subscribe,
			move,
			back,
			reset: resetOffchainState,
		},

		load,
		unload,
		updateTx,
		updateTxs,

		onTxSent(tx: EIP1193TransactionWithMetadata, hash: `0x${string}`) {
			addAction(tx, hash, 'Broadcasted');
			save();
		},

		on: emitter.on,
		off: emitter.off,

		_reset,
	};
}
