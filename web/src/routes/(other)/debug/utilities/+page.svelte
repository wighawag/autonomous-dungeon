<script lang="ts">
	import {time} from '$lib/time';
	import {devProvider} from '$lib/web3';

	let error: any;
	let state: undefined | 'setNextBlockTimestamp' | 'mine' | 'syncTime' | 'block';

	async function addTime(numHours: number) {
		try {
			const block = await devProvider?.request({
				method: 'eth_getBlockByNumber',
				params: ['latest', false],
			});
			if (!block) {
				throw new Error(`no block can be fetched`);
			}
			const old_timestamp = parseInt(block.timestamp.slice(2), 16);
			state = 'setNextBlockTimestamp';
			await devProvider?.request({
				method: 'evm_setNextBlockTimestamp',
				params: [`0x` + BigInt(old_timestamp + numHours * 3600).toString(16)],
			} as any);
			state = 'mine';
			await devProvider?.request({
				method: 'evm_mine',
				params: [],
			} as any);
			state = 'block';
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
{:else}
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
{/if}
