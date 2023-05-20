import {writable} from 'svelte/store';

import type {EIP1193TransactionWithMetadata} from 'web3-connection';
import {initEmitter} from '$external/callbacks';
import type {PendingTransaction} from '$external/tx-observer';
import type {CellAction, CellPosition} from 'jolly-roger-common';

export type OnChainAction = {
	tx: EIP1193TransactionWithMetadata;
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

export type Epoch = {hash: string};
export type OnChainActions = {[hash: `0x${string}`]: OnChainAction};

export type OffchainState = {
	epoch?: Epoch;
	position: CellPosition;
	actions: CellAction[];
};

export type AccountData = {
	onchainActions: OnChainActions;
	offchainState: OffchainState;
};

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

	const $offchainState: OffchainState = {
		position: {cx: 0, cy: 0},
		actions: [],
	};
	const offchainState = writable<OffchainState>($offchainState);

	let key: string | undefined;
	async function load(address: `0x${string}`, chainId: string, genesisHash?: string) {
		const data = await _load(address, chainId, genesisHash);

		if (data.offchainState) {
			$offchainState.actions = data.offchainState.actions;
			$offchainState.position = data.offchainState.position;
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
		$offchainState.position = {cx: 0, cy: 0};
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
		return dataSTR ? JSON.parse(dataSTR) : {onchainActions: {}};
	}

	async function _save(accountData: AccountData) {
		if (key) {
			localStorage.setItem(key, JSON.stringify(accountData));
		}
	}

	function addAction(tx: EIP1193TransactionWithMetadata, hash: `0x${string}`, inclusion?: 'Broadcasted') {
		const onchainAction: OnChainAction = {
			tx,
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

			// TODO specific to jolly-roger which does not need user acknowledgement for deleting the actions
			if (action.final) {
				delete $onchainActions[pendingTransaction.hash];
			}
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
		const firstAction = $offchainState.actions[0];
		$offchainState.actions.splice(0, $offchainState.actions.length);
		if (firstAction) {
			$offchainState.position.cx = firstAction.from.cx;
			$offchainState.position.cy = firstAction.from.cy;
		} else {
			$offchainState.position.cx = 0;
			$offchainState.position.cy = 0;
		}

		$offchainState.epoch = undefined;
		if (alsoSave) {
			save();
		}
		offchainState.set($offchainState);
	}

	function move(epoch: Epoch, to: CellPosition) {
		if ($offchainState.epoch && epoch.hash !== $offchainState.epoch.hash) {
			resetOffchainState(false);
			$offchainState.epoch = epoch;
		}
		$offchainState.actions.push({type: 'move', to, from: {...$offchainState.position}});
		$offchainState.position.cx = to.cx;
		$offchainState.position.cy = to.cy;
		save();
		offchainState.set($offchainState);
	}

	function back() {
		if ($offchainState.actions.length > 0) {
			$offchainState.position.cx = $offchainState.actions[$offchainState.actions.length - 1].from.cx;
			$offchainState.position.cy = $offchainState.actions[$offchainState.actions.length - 1].from.cy;
		}
		$offchainState.actions.splice($offchainState.actions.length - 1, 1);
		save();
		offchainState.set($offchainState);
	}

	return {
		onchainActions: {
			subscribe: onchainActions.subscribe,
		},

		offchainState: {
			subscribe: offchainState.subscribe,
			move,
			back,
			reset: resetOffchainState,
		},

		$offchainState,

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
