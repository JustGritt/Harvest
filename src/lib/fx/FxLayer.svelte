<script lang="ts">
	import { onMount } from 'svelte';
	import { setFxLayer } from './fx';

	let el: HTMLDivElement;

	onMount(() => {
		setFxLayer(el);
		return () => setFxLayer(null);
	});
</script>

<div
	bind:this={el}
	class="pointer-events-none fixed inset-0 z-40 overflow-hidden"
	aria-hidden="true"
></div>
