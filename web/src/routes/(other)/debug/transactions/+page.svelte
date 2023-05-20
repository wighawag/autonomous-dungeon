<script lang="ts">
	import {accountData} from '$lib/web3';
	const onchainActions = accountData.onchainActions;

	$: transactions = Object.keys($onchainActions).map((v) => ({hash: v, transaction: ($onchainActions as any)[v]}));
</script>

<ul>
	{#each transactions as transaction}
		<li>{transaction.hash}: {transaction.transaction.inclusion}</li>
	{/each}
</ul>
