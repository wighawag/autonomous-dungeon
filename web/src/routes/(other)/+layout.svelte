<script>
	import ThemeChanger from '$lib/components/daisyui/ThemeChanger.svelte';
	import NavTabs from '$lib/components/daisyui/NavTabs.svelte';
</script>

<div class="sticky top-0 z-50 navbar bg-base-100 min-h-0 p-1 border-b-2 border-primary">
	<div class="flex-1">
		<NavTabs
			pages={[
				{pathname: '/', title: 'Home'},
				{pathname: '/demo/', title: 'Demo'},
				{pathname: '/debug/', title: 'Debug'},
			]}
		/>
	</div>
	<div class="flex-none">
		<ThemeChanger />
	</div>
</div>

<!-- use -my-20 to ensure the navbar is considered when using min-h-screen to offset the footer (when content is too small)-->
<div class="-my-20 flex flex-col min-h-screen justify-between">
	<!--div to revert -my-20-->
	<div class="mt-20">
		<slot />
	</div>
</div>
