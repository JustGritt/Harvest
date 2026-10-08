<script lang="ts">
	export let title: string;
	export let icon = '';
	/** Gold is reserved for Legacy. */
	export let accent: 'wood' | 'gold' = 'wood';
	let klass = '';
	export { klass as class };
</script>

<section
	class="bg-parchment-100 overflow-hidden rounded-xl border-2 shadow-md {accent === 'gold'
		? 'border-gold-500'
		: 'border-wood-600'} {klass}"
>
	<h2
		class="font-display flex items-center gap-2 px-3 py-1 text-lg font-semibold {accent === 'gold'
			? 'bg-gold-400 text-wood-900'
			: 'bg-wood-500 text-parchment-50'}"
	>
		{#if icon}<span aria-hidden="true">{icon}</span>{/if}
		{title}
	</h2>
	<div class="space-y-2 p-2.5">
		<slot />
	</div>
</section>
