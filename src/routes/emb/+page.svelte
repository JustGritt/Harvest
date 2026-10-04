<script lang="ts">
	import { onMount } from 'svelte';
	let slot: HTMLDivElement;

	onMount(() => {
		const s = document.createElement('script');
		s.src = 'https://markspot.app/embed/embed.v1.js';
		s.setAttribute('data-embed-id', 'f3a6af9f-e230-4d71-aedb-4e09e09435a5');
		s.async = true;
		// The embed renders next to its <script> tag, so it has to live inside this container.
		// Svelte never renders children into `slot`, so there's nothing for it to get out of sync with.
		// eslint-disable-next-line svelte/no-dom-manipulating
		slot.appendChild(s);
	});
</script>

<h4 class="mb-2 font-bold">Hello World</h4>
<div bind:this={slot}></div>
