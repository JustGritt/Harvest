<script lang="ts">
	import CropArt from '$lib/art/CropArt.svelte';
	import { BALANCE } from '$lib/data/balance';
	import { CROPS, CROP_ORDER } from '$lib/data/crops';
	import { MUTATIONS, MUTATION_ORDER } from '$lib/data/mutations';
	import type { Discovery } from '$lib/types';
	import { ALL_DISCOVERIES, discoveryKey } from '$lib/utils/gameUtils';

	export let discoveries: Discovery[];

	$: bonus = Math.round(discoveries.length * BALANCE.discoveryBonus * 100);
</script>

<p class="text-wood-600 text-xs">
	Harvest every mutation of every crop. Each find adds
	<strong>+{BALANCE.discoveryBonus * 100}% value</strong> for good, even after selling the farm.
</p>
<table class="w-full table-fixed border-separate border-spacing-1">
	<thead>
		<tr>
			<th class="w-14"><span class="sr-only">Crop</span></th>
			{#each MUTATION_ORDER as id (id)}
				<th
					class="font-display text-[0.65rem] leading-tight font-semibold"
					style:color={MUTATIONS[id].tint}
				>
					{MUTATIONS[id].name}<br /><span class="text-wood-600">×{MUTATIONS[id].multiplier}</span>
				</th>
			{/each}
		</tr>
	</thead>
	<tbody>
		{#each CROP_ORDER as crop (crop)}
			<tr>
				<th class="text-left text-xs font-semibold">{CROPS[crop].name}</th>
				{#each MUTATION_ORDER as mutation (mutation)}
					{@const found = discoveries.includes(discoveryKey(crop, mutation))}
					<td
						class="aspect-square rounded-md border-2 p-1 {found
							? 'border-gold-300 bg-parchment-50'
							: 'border-soil-200 bg-parchment-200/60 border-dashed'}"
					>
						<span class="sr-only">
							{MUTATIONS[mutation].name}
							{CROPS[crop].name}: {found ? 'found' : 'not found yet'}
						</span>
						<span class="block aspect-square" aria-hidden="true">
							{#if found}
								<CropArt {crop} stage="mature" {mutation} />
							{:else}
								<!-- A silhouette teases what to look for -->
								<CropArt
									{crop}
									stage="mature"
									mutation={mutation === 'bountiful' || mutation === 'giant' ? mutation : null}
									class="opacity-15 brightness-0"
								/>
							{/if}
						</span>
					</td>
				{/each}
			</tr>
		{/each}
	</tbody>
</table>
<p class="font-display text-sm font-semibold tabular-nums">
	{discoveries.length} / {ALL_DISCOVERIES.length} found ·
	<span class="text-leaf-600">+{bonus}% value</span>
</p>
