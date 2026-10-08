<script lang="ts">
	import Art from '$lib/art/Art.svelte';
	import { cropArt } from '$lib/art/ids';
	import soilDry from '$lib/art/svg/field/soil-dry.svg?url';
	import soilWet from '$lib/art/svg/field/soil-wet.svg?url';
	import { CROPS } from '$lib/data/crops';
	import type { Cell, CropId, HarvestEvent } from '$lib/types';
	import { formatNumber, growProgress, growStage } from '$lib/utils/gameUtils';

	export let cell: Cell;
	export let now: number;
	/** Seed that a click on an empty plot will plant. */
	export let selectedCrop: CropId;
	/** Harvest value of this plot's crop. */
	export let value: number;
	export let pops: (HarvestEvent & { key: number })[] = [];

	$: crop = cell.crop ? CROPS[cell.crop] : null;
	$: progress = growProgress(cell, now);
	$: stage = growStage(progress);
	$: ready = cell.status === 'ready';
	$: soil = cell.status === 'empty' ? soilDry : soilWet;
</script>

<button
	class="group border-soil-800/50 relative flex aspect-square touch-manipulation items-center justify-center overflow-hidden rounded-md border-2 pb-1.5 shadow-[inset_0_-3px_0_rgb(0_0_0/0.15)] select-none hover:brightness-110 sm:rounded-lg sm:pb-2 {ready
		? 'border-gold-300 shadow-[0_0_12px_var(--color-gold-300),inset_0_0_10px_rgb(255_229_138/0.5)]'
		: ''}"
	style={`background: url("${soil}") 0 0 / 28px`}
	aria-label={crop
		? `${crop.name}, ${cell.status}`
		: `Empty plot, plant ${CROPS[selectedCrop].name}`}
	on:click
>
	{#if cell.status === 'empty'}
		<Art
			id={cropArt(selectedCrop, 'mature')}
			size="70%"
			class="opacity-0 transition-opacity group-hover:opacity-50"
		/>
	{:else if crop}
		{#key cell.plantedAt}
			<span
				class="flex size-[78%] items-end justify-center {ready
					? 'motion-safe:animate-ready'
					: 'motion-safe:animate-plant'}"
			>
				<span
					class="block size-full origin-bottom transition-transform duration-300"
					style="transform: scale({ready ? 1.05 : stage.scale})"
				>
					<Art
						id={cropArt(crop.id, ready ? 'mature' : stage.stage)}
						size="100%"
						class="drop-shadow-[0_2px_1px_rgb(0_0_0/0.25)]"
					/>
				</span>
			</span>
		{/key}
		{#if ready}
			<span
				class="font-display bg-parchment-100/90 text-gold-700 absolute bottom-1 hidden rounded px-1.5 text-xs font-semibold tabular-nums sm:block"
			>
				+{formatNumber(value)}
			</span>
		{:else}
			<span class="absolute inset-x-1 bottom-1 h-1 rounded-full bg-black/30 sm:inset-x-2 sm:h-1.5">
				<span
					class="block h-full rounded-full"
					style="width: {progress * 100}%; background: {crop.tint};"
				></span>
			</span>
		{/if}
	{/if}
	{#each pops as pop (pop.key)}
		<span
			class="motion-safe:animate-float-up motion-reduce:animate-fade-out pointer-events-none absolute top-1/4 left-1/2 z-[1] -translate-x-1/2 whitespace-nowrap tabular-nums {pop.auto
				? 'text-parchment-100 text-xs [text-shadow:0_1px_1px_rgb(0_0_0/0.6)]'
				: 'font-display text-gold-200 text-sm font-bold [text-shadow:0_1px_2px_rgb(0_0_0/0.6)] sm:text-lg'}"
		>
			+{formatNumber(pop.value)}
		</span>
	{/each}
</button>
