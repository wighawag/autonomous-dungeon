<script lang="ts">
	import {connection} from '$lib/web3';
	import {onMount} from 'svelte';
	import {createTestClient, http} from 'viem';
	import {foundry} from 'viem/chains';

	let date: Date = new Date();
	onMount(() => {
		const interval = setInterval(() => {
			const timestamp = connection.$state.provider?.currentTime() || Math.floor(Date.now() / 1000);
			date = new Date(timestamp * 1000);
		}, 1000);
		return () => clearInterval(interval);
	});

	async function add1hour() {
		const client = createTestClient({
			chain: foundry,
			mode: 'anvil',
			transport: http(),
		});

		const timestamp = BigInt(Math.floor(date.getTime() / 1000));
		await client.setNextBlockTimestamp({
			timestamp: timestamp + 3600n,
		});
		await $connection.provider?.waitNewBlock();
		await $connection.provider?.syncTime();
	}
</script>

<label class="m-2 font-bold" for="date">Date/Time</label>
<p class="m-2" id="date">{date.toLocaleDateString() + `  ` + date.toLocaleTimeString()}</p>

<button class="btn m-2" on:click={() => add1hour()}>Add 1 hour</button>
