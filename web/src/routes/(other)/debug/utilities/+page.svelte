<script lang="ts">
	import {time} from '$lib/time';
	import {connection} from '$lib/web3';
	import {createTestClient, http} from 'viem';
	import {foundry} from 'viem/chains';

	let error: any;
	let state: undefined | 'setNextBlockTimestamp' | 'mine' | 'syncTime' | 'block';

	async function addTime(numHours: number) {
		const client = createTestClient({
			chain: foundry,
			mode: 'anvil',
			transport: http(),
		});

		try {
			state = 'setNextBlockTimestamp';
			const old_timestamp = await $connection.provider!.syncTime();
			await client.setNextBlockTimestamp({
				timestamp: BigInt(old_timestamp + numHours * 3600),
			});
			state = 'mine';
			await client.mine({
				blocks: 1,
			});
			state = 'block';
			await $connection.provider!.waitNewBlock();
			state = 'syncTime';
			const timestamp = await $connection.provider!.syncTime();
			console.log(new Date(timestamp * 1000).toLocaleTimeString());
		} catch (err: any) {
			console.error(err);
			error = err;
		} finally {
			state = undefined;
		}
	}

	$: date = new Date($time * 1000);

	let hours = 1;
</script>

<label class="m-2 font-bold" for="date">Date/Time</label>
<p class="m-2" id="date">{date.toLocaleDateString() + `  ` + date.toLocaleTimeString()}</p>

{#if error}
	{error.message}
	<button class={`btn btn-error m-2`} on:click={() => (error = undefined)}>OK</button>
{:else if $connection.provider}
	<button class={`btn btn-secondary ${state ? 'btn-disabled' : ''} m-2`} on:click={() => addTime(1)}>Add 1 hour</button>
	<button class={`btn btn-secondary ${state ? 'btn-disabled' : ''} m-2`} on:click={() => addTime(23)}
		>Add 23 hour</button
	>
	<form>
		<label for="hours" />
		<input id="hours" type="number" bind:value={hours} />
		<button class={`btn btn-secondary ${state ? 'btn-disabled' : ''} m-2`} type="submit" on:click={() => addTime(hours)}
			>Add {hours} hours</button
		>
	</form>
{:else}
	<button on:click={() => connection.connect()} class="btn btn-error">Connect</button>
{/if}
