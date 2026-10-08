<script lang="ts">
	import Art from '$lib/art/Art.svelte';
	import { ART_IDS } from '$lib/art/ids';
	import soilDry from '$lib/art/svg/field/soil-dry.svg?url';
	import soilWet from '$lib/art/svg/field/soil-wet.svg?url';

	const SIZES = [24, 40, 64, 96];
	const BACKGROUNDS = [
		{ name: 'parchment', style: 'background: var(--color-parchment-100)' },
		{ name: 'dry soil', style: `background: url("${soilDry}") 0 0 / 28px` },
		{ name: 'wet soil', style: `background: url("${soilWet}") 0 0 / 28px` },
		{ name: 'wood', style: 'background: var(--color-wood-500)' }
	];
	const sprites = ART_IDS.filter((id) => !id.startsWith('soil-'));
</script>

<div class="space-y-6 p-4">
	<h1 class="font-display text-2xl font-semibold">Art contact sheet</h1>

	{#each BACKGROUNDS as bg (bg.name)}
		<section class="border-wood-600 overflow-x-auto rounded-xl border-2 p-3" style={bg.style}>
			<h2
				class="font-display bg-parchment-100 mb-2 inline-block rounded px-2 text-sm font-semibold"
			>
				{bg.name}
			</h2>
			<div class="flex flex-wrap gap-4">
				{#each sprites as id (id)}
					<figure class="flex flex-col items-center gap-1">
						<div class="flex items-end gap-2">
							{#each SIZES as size (size)}
								<Art {id} size="{size}px" />
							{/each}
						</div>
						<figcaption class="bg-parchment-100 rounded px-1 font-mono text-[10px]">
							{id}
						</figcaption>
					</figure>
				{/each}
			</div>
		</section>
	{/each}

	<section class="flex gap-6">
		{#each [soilDry, soilWet] as tile (tile)}
			<div class="space-y-1">
				<p class="font-mono text-xs">3×3 tiling, 28px</p>
				<div
					class="border-wood-900 size-[84px] border-2"
					style={`background: url("${tile}") 0 0 / 28px`}
				></div>
				<p class="font-mono text-xs">plot-sized, 110px</p>
				<div
					class="border-wood-900 size-[110px] rounded-lg border-2"
					style={`background: url("${tile}") 0 0 / 28px`}
				></div>
			</div>
		{/each}
	</section>
</div>
