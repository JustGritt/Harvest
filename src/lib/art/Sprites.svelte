<script lang="ts">
	import { SPRITE_SHEET } from './sprites';
</script>

<div aria-hidden="true">
	<!-- eslint-disable-next-line svelte/no-at-html-tags -- built from our own SVG files at build time -->
	{@html SPRITE_SHEET}
	<svg width="0" height="0" class="absolute">
		<!-- Golden mutation: a gradient map from brightness to the gold ramp, keeping outlines dark -->
		<filter id="mut-golden" color-interpolation-filters="sRGB">
			<feColorMatrix
				type="matrix"
				values="0.3 0.59 0.11 0 0  0.3 0.59 0.11 0 0  0.3 0.59 0.11 0 0  0 0 0 1 0"
			/>
			<feComponentTransfer>
				<feFuncR type="table" tableValues="0.231 0.231 0.561 0.878 0.988 1 1" />
				<feFuncG type="table" tableValues="0.153 0.153 0.353 0.608 0.827 0.898 0.957" />
				<feFuncB type="table" tableValues="0.106 0.106 0.035 0.043 0.302 0.541 0.761" />
			</feComponentTransfer>
		</filter>
	</svg>
</div>
