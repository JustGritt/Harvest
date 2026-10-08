<script lang="ts" context="module">
	let nextId = 0;
</script>

<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import Art from '$lib/art/Art.svelte';
	import type { ArtId } from '$lib/art/ids';

	export let open: boolean;
	export let title: string;
	export let icon: ArtId | null = null;

	const dispatch = createEventDispatcher<{ close: void }>();
	let dialog: HTMLDialogElement;
	const titleId = `dialog-title-${nextId++}`;

	// Native modal: focus trap, Escape and backdrop come from the browser
	$: if (dialog) {
		if (open && !dialog.open) dialog.showModal();
		else if (!open && dialog.open) dialog.close();
	}

	function onBackdropClick(event: MouseEvent) {
		if (event.target === dialog) dialog.close();
	}
</script>

<dialog
	bind:this={dialog}
	class="border-wood-600 bg-parchment-100 text-wood-900 backdrop:bg-soil-900/50 m-auto w-[min(26rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border-4 p-0 shadow-2xl"
	aria-labelledby={titleId}
	on:close={() => dispatch('close')}
	on:click={onBackdropClick}
>
	<h2
		id={titleId}
		class="font-display bg-wood-500 text-parchment-50 flex items-center gap-2 px-4 py-2 text-xl font-semibold"
	>
		{#if icon}<Art id={icon} size="1.5em" />{/if}
		{title}
	</h2>
	<div class="space-y-3 p-4 text-sm">
		<slot />
	</div>
	<div class="flex justify-end gap-2 px-4 pb-4">
		<slot name="actions" />
	</div>
</dialog>
