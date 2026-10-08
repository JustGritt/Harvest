<!-- src/routes/+layout.svelte -->
<script lang="ts">
	import '../app.css';
	import Sprites from '$lib/art/Sprites.svelte';
	import FxLayer from '$lib/fx/FxLayer.svelte';
</script>

<svelte:head>
	<title>Harvest</title>
</svelte:head>

<Sprites />

<main class="bg-meadow min-h-screen">
	<slot />
</main>

<FxLayer />
