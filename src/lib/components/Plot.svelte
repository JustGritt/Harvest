<script lang="ts">
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
</script>

<button
	class="group border-soil-800/50 relative flex aspect-square touch-manipulation items-center justify-center overflow-hidden rounded-md border-2 pb-1.5 shadow-[inset_0_-3px_0_rgb(0_0_0/0.15)] select-none hover:brightness-110 sm:rounded-lg sm:pb-2 {cell.status ===
	'empty'
		? 'soil-dry'
		: 'soil-wet'} {ready
		? 'border-gold-300 shadow-[0_0_12px_var(--color-gold-300),inset_0_0_10px_rgb(255_229_138/0.5)]'
		: ''}"
	aria-label={crop
		? `${crop.name}, ${cell.status}`
		: `Empty plot, plant ${CROPS[selectedCrop].name}`}
	on:click
>
	{#if cell.status === 'empty'}
		<span
			class="text-lg opacity-0 transition-opacity group-hover:opacity-50 sm:text-3xl"
			aria-hidden="true">{CROPS[selectedCrop].icon}</span
		>
	{:else if crop}
		{#key cell.plantedAt}
			<span
				class="text-lg drop-shadow-sm sm:text-3xl {ready
					? 'motion-safe:animate-ready'
					: 'motion-safe:animate-plant'}"
				aria-hidden="true"
			>
				<span
					class="inline-block transition-transform duration-300"
					style="transform: scale({ready ? 1.1 : stage.scale})"
				>
					{ready || !stage.sprout ? crop.icon : '🌱'}
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
