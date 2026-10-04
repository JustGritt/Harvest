<script lang="ts">
	import type { UpgradeDef } from '$lib/data/upgrades';
	import { formatNumber } from '$lib/utils/gameUtils';

	export let def: UpgradeDef;
	export let level: number;
	export let cost: number;
	export let canAfford: boolean;
	export let maxed: boolean;
	export let effect: string;
</script>

<div class="space-y-1">
	<button
		on:click
		disabled={maxed || !canAfford}
		class="flex w-full items-center justify-between gap-2 rounded bg-orange-500 px-3 py-2 text-left text-white hover:bg-orange-600 disabled:cursor-not-allowed disabled:bg-gray-300 disabled:text-gray-600"
	>
		<span class="truncate">
			{def.icon}
			{def.name}
			<span class="text-xs opacity-80">{def.maxLevel ? `Lv ${level}` : `×${level}`}</span>
		</span>
		<span class="shrink-0 text-sm font-bold">{maxed ? 'MAX' : `${formatNumber(cost)} 💰`}</span>
	</button>
	<p class="text-xs text-gray-600">{def.description} <span class="font-semibold">{effect}</span></p>
</div>
