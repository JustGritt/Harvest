<script lang="ts">
	import Art from '$lib/art/Art.svelte';
	import CropArt from '$lib/art/CropArt.svelte';
	import { cropArt } from '$lib/art/ids';
	import soilDry from '$lib/art/svg/field/soil-dry.svg?url';
	import soilWet from '$lib/art/svg/field/soil-wet.svg?url';
	import { CROPS } from '$lib/data/crops';
	import { MUTATIONS } from '$lib/data/mutations';
	import { replay } from '$lib/fx/replay';
	import { COMBO_LABEL_FROM } from '$lib/fx/streak';
	import type { Cell, CropId, HarvestEvent } from '$lib/types';
	import { formatNumber, growProgress, growStage } from '$lib/utils/gameUtils';

	export let cell: Cell;
	export let now: number;
	/** Seed that a click on an empty plot will plant. */
	export let selectedCrop: CropId;
	/** Harvest value of this plot's crop. */
	export let value: number;
	/** Floating "+N" pops; `streak` is set on the player's own reaps. */
	export let pops: (HarvestEvent & { key: number; streak?: number })[] = [];

	$: crop = cell.crop ? CROPS[cell.crop] : null;
	$: progress = growProgress(cell, now);
	$: stage = growStage(progress);
	$: ready = cell.status === 'ready';
	$: soil = cell.status === 'empty' ? soilDry : soilWet;
	// A mutation shows once the seed sprouts
	$: mutation =
		cell.mutation && (ready || stage.stage !== 'seed') ? MUTATIONS[cell.mutation] : null;
	// The plot thumps each time the player reaps it
	$: lastReap = pops.findLast((p) => !p.auto)?.key;
	// Offsets each plot's glint so a field of ripe crops doesn't sparkle in sync
	$: glintDelay = -([...cell.id].reduce((h, ch) => h * 31 + ch.charCodeAt(0), 7) % 2600);
</script>

<button
	data-cell={cell.id}
	class="group border-soil-800/50 relative flex aspect-square w-full touch-none items-center justify-center overflow-hidden rounded-md border-2 pb-1.5 shadow-[inset_0_-3px_0_rgb(0_0_0/0.15)] transition-transform duration-100 select-none hover:-translate-y-0.5 hover:brightness-110 active:translate-y-0 active:scale-[0.94] sm:rounded-lg sm:pb-2 {ready
		? 'border-gold-300 shadow-[0_0_12px_var(--color-gold-300),inset_0_0_10px_rgb(255_229_138/0.5)]'
		: ''}"
	style={`background: url("${soil}") 0 0 / 28px;${ready && mutation ? ` border-color: ${mutation.tint};` : ''}`}
	aria-label={crop
		? `${mutation ? `${mutation.name} ` : ''}${crop.name}, ${cell.status}`
		: `Empty plot, plant ${CROPS[selectedCrop].name}`}
	use:replay={{ key: lastReap, cls: 'motion-safe:animate-thump', when: lastReap !== undefined }}
	on:pointerdown
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
			<!-- Drops in when planted -->
			<span class="motion-safe:animate-plant flex size-[78%] items-end justify-center">
				<!-- Pops each time the crop reaches a new stage -->
				<span
					class="block size-full origin-bottom"
					use:replay={{ key: ready ? 'mature' : stage.stage, cls: 'motion-safe:animate-pop' }}
				>
					<!-- Sways from the base once ripe -->
					<span class="block size-full origin-bottom {ready ? 'motion-safe:animate-sway' : ''}">
						<span
							class="block size-full origin-bottom transition-transform duration-300"
							style="transform: scale({ready ? 1.05 : stage.scale})"
						>
							<CropArt
								crop={crop.id}
								stage={ready ? 'mature' : stage.stage}
								mutation={mutation?.id ?? null}
								class="drop-shadow-[0_2px_1px_rgb(0_0_0/0.25)]"
							/>
						</span>
					</span>
				</span>
			</span>
		{/key}
		{#if ready || mutation?.id === 'golden' || mutation?.id === 'rainbow'}
			<span
				class="motion-safe:animate-glint absolute top-[12%] right-[14%] hidden size-[24%] motion-safe:block"
				style="animation-delay: {glintDelay}ms"
			>
				<Art id="sparkle" size="100%" />
			</span>
		{/if}
		{#if ready}
			<span
				class="font-display absolute bottom-1 hidden rounded px-1.5 text-xs font-semibold tabular-nums sm:block {mutation
					? 'text-white'
					: 'bg-parchment-100/90 text-gold-700'}"
				style:background={mutation?.tint}
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
		{#if pop.auto}
			<span
				class="motion-safe:animate-float-up motion-reduce:animate-fade-out pointer-events-none absolute top-1/4 left-1/2 z-[1] -translate-x-1/2 text-xs whitespace-nowrap tabular-nums [text-shadow:0_1px_1px_rgb(0_0_0/0.6)] {pop.mutation
					? 'text-gold-200 font-semibold'
					: 'text-parchment-100'}"
			>
				+{formatNumber(pop.value)}
			</span>
		{:else}
			<!-- With motion the FX layer draws the player's "+N" (floatText); this is the still fallback -->
			<span
				class="motion-reduce:animate-fade-out font-display pointer-events-none absolute top-1/4 left-1/2 z-[1] hidden -translate-x-1/2 flex-col items-center leading-none whitespace-nowrap tabular-nums motion-reduce:flex"
			>
				{#if pop.mutation}
					<span class="mb-0.5 text-xs font-bold" style:color={MUTATIONS[pop.mutation].tint}>
						{MUTATIONS[pop.mutation].name}!
					</span>
				{/if}
				<span
					class="text-gold-100 text-sm font-bold [-webkit-text-stroke:3px_var(--color-wood-900)] [paint-order:stroke_fill] sm:text-xl"
				>
					+{formatNumber(pop.value)}
				</span>
				{#if (pop.streak ?? 0) >= COMBO_LABEL_FROM}
					<span
						class="bg-berry-500 border-berry-700 mt-0.5 rounded-full border px-1.5 py-px text-[0.65rem] font-bold text-white sm:text-xs"
					>
						×{pop.streak}
					</span>
				{/if}
			</span>
		{/if}
	{/each}
</button>
