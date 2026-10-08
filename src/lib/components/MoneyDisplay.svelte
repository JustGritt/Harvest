<script lang="ts">
	import { formatNumber } from '$lib/utils/gameUtils';

	export let money: number;
	export let incomePerSec: number;
	/** Changing this replays the bump animation (player harvests). */
	export let bump = 0;
	export let compact = false;
</script>

<div class="flex flex-col {compact ? 'items-end' : ''}">
	{#key bump}
		<span
			class="font-display text-gold-700 inline-block font-semibold tabular-nums {compact
				? 'origin-right text-xl'
				: 'origin-left text-3xl'} {bump ? 'motion-safe:animate-bump' : ''}"
		>
			💰 {formatNumber(money)}
		</span>
	{/key}
	<span class="text-wood-600 text-xs tabular-nums">≈ {formatNumber(incomePerSec)} / s</span>
</div>
