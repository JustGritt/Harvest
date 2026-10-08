<script lang="ts">
	import type { ArtId } from './ids';

	export let id: ArtId;
	/** Any CSS length. 1em sits inline with text, like the emoji it replaces. */
	export let size = '1em';
	/** Accessible name. Without one the sprite is decorative. */
	export let label = '';
	let klass = '';
	export { klass as class };
</script>

<svg
	class="inline-block shrink-0 align-[-0.15em] {klass}"
	style="width: {size}; height: {size};"
	role={label ? 'img' : undefined}
	aria-label={label || undefined}
	aria-hidden={label ? undefined : 'true'}
>
	<use href="#art-{id}" />
</svg>
