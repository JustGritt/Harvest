<!-- src/routes/+layout.svelte -->
<script lang="ts">
	import '../app.css';
</script>

<svelte:head>
	<title>Harvest</title>
</svelte:head>

<main class="bg-meadow min-h-screen">
	<slot />
</main>
