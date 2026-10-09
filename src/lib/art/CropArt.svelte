<script lang="ts">
	import Art from './Art.svelte';
	import { cropArt } from './ids';
	import type { GrowStage } from '$lib/utils/gameUtils';
	import type { CropId, MutationId } from '$lib/types';

	export let crop: CropId;
	export let stage: GrowStage | 'mature';
	/** Drawn as twins (Bountiful), bigger (Giant) or recoloured gold (Golden). */
	export let mutation: MutationId | null = null;
	let klass = '';
	export { klass as class };

	$: id = cropArt(crop, stage);
	// Recoloured gold with a warm glow, so it stands out even on wheat
	$: filter =
		mutation === 'golden' ? 'url(#mut-golden) drop-shadow(0 0 3px var(--color-gold-300))' : '';
</script>

<!-- Fills its box; the crop stands on the bottom edge. `class` can add its own filter (shadow). -->
<span class="relative block size-full origin-bottom {klass}">
	<span class="relative block size-full origin-bottom" style:filter>
		{#if mutation === 'bountiful'}
			<Art {id} size="76%" class="absolute bottom-0 left-[-6%]" />
			<Art {id} size="76%" class="absolute right-[-6%] bottom-0" />
		{:else}
			<Art
				{id}
				size="100%"
				class="block origin-bottom {mutation === 'giant' ? 'scale-[1.28]' : ''}"
			/>
		{/if}
	</span>
</span>
