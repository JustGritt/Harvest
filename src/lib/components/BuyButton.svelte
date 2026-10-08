<script lang="ts">
	import Art from '$lib/art/Art.svelte';
	import type { ArtId } from '$lib/art/ids';
	import { formatNumber } from '$lib/utils/gameUtils';

	export let art: ArtId;
	export let name: string;
	/** Small tag after the name, e.g. "Lv 3" or "×5". */
	export let badge = '';
	/** Shows a padlock: buying unlocks something. */
	export let locked = false;
	/** What buying changes, shown in bold. */
	export let effect = '';
	export let description = '';
	export let cost: number;
	export let money: number;
	export let maxed = false;

	$: canAfford = money >= cost;
	$: fill = Math.min(1, money / cost);
</script>

<button
	on:click
	disabled={maxed || !canAfford}
	class="relative w-full overflow-hidden rounded-lg border-2 text-left transition {maxed
		? 'border-gold-400 bg-gold-100 text-wood-800'
		: canAfford
			? 'border-leaf-700 bg-leaf-500 hover:bg-leaf-600 text-white shadow-[0_3px_0_var(--color-leaf-700)] active:translate-y-0.5 active:shadow-none'
			: 'border-soil-200 bg-parchment-50 text-wood-700 cursor-not-allowed'}"
>
	{#if !maxed && !canAfford}
		<!-- How close the player is to affording it -->
		<span
			class="bg-gold-200/60 absolute inset-y-0 left-0 transition-[width] duration-300"
			style="width: {fill * 100}%"
			aria-hidden="true"
		></span>
	{/if}
	<span class="relative flex items-center gap-2.5 px-2 py-1.5">
		<span class="bg-parchment-50 grid size-9 shrink-0 place-items-center rounded-md shadow-inner">
			<Art id={art} size="1.75rem" />
		</span>
		<span class="min-w-0 flex-1 leading-tight">
			<span class="flex items-baseline gap-1.5">
				<span class="truncate font-semibold">{name}</span>
				{#if badge}<span class="shrink-0 text-xs opacity-80">{badge}</span>{/if}
				{#if locked}<Art id="lock" size="0.9rem" label="locked" />{/if}
			</span>
			{#if effect}<span class="block text-xs font-semibold">{effect}</span>{/if}
			{#if description}<span class="block text-[11px] opacity-80">{description}</span>{/if}
		</span>
		<span class="font-display shrink-0 font-semibold tabular-nums">
			{#if maxed}
				<span class="bg-gold-400 text-wood-900 rounded px-1.5 py-0.5 text-xs">MAX</span>
			{:else}
				{formatNumber(cost)} <Art id="coin" />
			{/if}
		</span>
	</span>
</button>
