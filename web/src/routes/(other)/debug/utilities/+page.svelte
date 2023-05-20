<script lang="ts">
	import {time} from '$lib/time';
	import {connection} from '$lib/web3';
	import {createTestClient, http} from 'viem';
	import {foundry} from 'viem/chains';

	async function add1hour() {
		const client = createTestClient({
			chain: foundry,
			mode: 'anvil',
			transport: http(),
		});

		await client.setNextBlockTimestamp({
			timestamp: BigInt(time.now + 3600),
		});
		await $connection.provider?.waitNewBlock();
		await $connection.provider?.syncTime();
	}

	$: date = new Date($time * 1000);
</script>

<label class="m-2 font-bold" for="date">Date/Time</label>
<p class="m-2" id="date">{date.toLocaleDateString() + `  ` + date.toLocaleTimeString()}</p>

<button class="btn m-2" on:click={() => add1hour()}>Add 1 hour</button>
