import {writable} from 'svelte/store';

import type {EIP1193TransactionWithMetadata} from 'web3-connection';
import {initEmitter} from '$external/callbacks';
import type {PendingTransaction} from '$external/tx-observer';

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

export type OnChainActions = {[hash: `0x${string}`]: OnChainAction};

export type AccountData = {onchainActions: OnChainActions};

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

	let key: string | undefined;
	async function load(address: `0x${string}`, chainId: string, genesisHash?: string) {
		key = `account_${address}_${chainId}_${genesisHash}`;
		const dataSTR = localStorage.getItem(key);
		const data: AccountData = dataSTR ? JSON.parse(dataSTR) : {onchainActions: {}};
		const pending_transactions: PendingTransaction[] = [];
		for (const hash in data.onchainActions) {
			const onchainAction = (data.onchainActions as any)[hash];
			($onchainActions as any)[hash] = onchainAction;
			pending_transactions.push(fromOnChainActionToPendingTransaction(hash as `0x${string}`, onchainAction));
		}
		emitter.emit({name: 'newTx', txs: pending_transactions});
		onchainActions.set($onchainActions);
	}

	async function unload() {
		//save before unload
		await save();

		// delete all
		for (const hash of Object.keys($onchainActions)) {
			delete ($onchainActions as any)[hash];
		}
		onchainActions.set($onchainActions);
		emitter.emit({name: 'clear'});
	}

	async function save() {
		if (key) {
			localStorage.setItem(key, JSON.stringify({onchainActions: $onchainActions}));
		}
	}

	function addAction(tx: EIP1193TransactionWithMetadata, hash: `0x${string}`, inclusion?: 'Broadcasted') {
		const onchainAction: OnChainAction = {
			tx,
			inclusion: inclusion || 'BeingFetched',
			final: undefined,
			status: undefined,
		};

		if (key) {
			// TODO optimize this ? currently write on every add, use dedupe
			localStorage.setItem(key, JSON.stringify({actions: $onchainActions}));
		}
		$onchainActions[hash] = onchainAction;
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

	return {
		onchainActions: {
			subscribe: onchainActions.subscribe,
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
