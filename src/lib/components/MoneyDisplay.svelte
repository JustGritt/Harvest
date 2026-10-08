<script lang="ts">
	import { onMount } from 'svelte';
	import { cubicOut } from 'svelte/easing';
	import { tweened } from 'svelte/motion';
	import Art from '$lib/art/Art.svelte';
	import { moneyTarget, reducedMotion } from '$lib/fx/fx';
	import { replay } from '$lib/fx/replay';
	import { formatNumber } from '$lib/utils/gameUtils';

	export let money: number;
	export let incomePerSec: number;
	/** Changing this replays the bump animation (player harvests). */
	export let bump = 0;
	export let compact = false;

	// Counts up to the new amount; drops (purchases, prestige) jump straight there
	const shown = tweened(money, { easing: cubicOut });
	let previous = money;
	let animate = false;
	onMount(() => (animate = !reducedMotion()));
	$: {
		shown.set(money, { duration: animate && money > previous ? 300 : 0 });
		previous = money;
	}
</script>

<div class="flex flex-col {compact ? 'items-end' : ''}">
	<span
		class="font-display text-gold-700 inline-block font-semibold tabular-nums {compact
			? 'origin-right text-xl'
			: 'origin-left text-3xl'}"
		use:replay={{ key: bump, cls: 'motion-safe:animate-bump' }}
	>
		<span use:moneyTarget><Art id="coin" label="money" /></span>
		{formatNumber($shown)}
	</span>
	<span class="text-wood-600 text-xs tabular-nums">≈ {formatNumber(incomePerSec)} / s</span>
</div>
