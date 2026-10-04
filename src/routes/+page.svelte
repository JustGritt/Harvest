<script lang="ts">
	import { onMount } from 'svelte';
	import { gameStore } from '$lib/store';
	import { BALANCE } from '$lib/data/balance';
	import { CROPS, CROP_ORDER } from '$lib/data/crops';
	import { UPGRADES, UPGRADE_ORDER, type UpgradeCategory } from '$lib/data/upgrades';
	import UpgradeButton from '$lib/components/UpgradeButton.svelte';
	import type { Cell, OfflineReport, UpgradeId } from '$lib/types';
	import {
		describeEffect,
		farmerInterval,
		formatDuration,
		formatNumber,
		formatSeconds,
		growTime,
		harvestValue,
		isMaxed,
		planterInterval,
		prestigeGain,
		prestigeThreshold,
		upgradeCost
	} from '$lib/utils/gameUtils';

	const SECTIONS: { category: UpgradeCategory; title: string }[] = [
		{ category: 'workers', title: 'Workers' },
		{ category: 'growth', title: 'Growth & Value' },
		{ category: 'field', title: 'Field' }
	];

	$: game = $gameStore;
	$: now = game.lastTick;
	$: cols = game.field[0]?.length ?? BALANCE.baseCols;
	$: gain = prestigeGain(game.runEarned);
	$: showPrestige = gain > 0 || game.prestigeCount > 0;

	let offline: OfflineReport | null = null;

	// Income/s averaged over the last 10s of run earnings
	let samples: { t: number; earned: number }[] = [];
	let incomePerSec = 0;

	function sampleIncome() {
		const t = Date.now();
		const earned = $gameStore.runEarned;
		const last = samples[samples.length - 1];
		if (last && earned < last.earned) samples = []; // run was reset
		samples = [...samples.filter((s) => t - s.t <= 10_000), { t, earned }];
		const first = samples[0];
		incomePerSec = t > first.t ? (earned - first.earned) / ((t - first.t) / 1000) : 0;
	}

	onMount(() => {
		const report = gameStore.load();
		if (report && report.earned > 0 && report.elapsed >= 60_000) offline = report;

		const tickInterval = setInterval(() => gameStore.tick(), BALANCE.tickMs);
		const incomeInterval = setInterval(sampleIncome, 1000);
		const saveInterval = setInterval(gameStore.save, BALANCE.saveIntervalMs);
		const onVisibility = () => {
			if (document.visibilityState === 'hidden') gameStore.save();
		};
		document.addEventListener('visibilitychange', onVisibility);
		window.addEventListener('beforeunload', gameStore.save);

		return () => {
			clearInterval(tickInterval);
			clearInterval(incomeInterval);
			clearInterval(saveInterval);
			document.removeEventListener('visibilitychange', onVisibility);
			window.removeEventListener('beforeunload', gameStore.save);
			gameStore.save();
		};
	});

	function clickCell(r: number, c: number, cell: Cell) {
		if (cell.status === 'empty') {
			gameStore.plantCrop(r, c);
		} else {
			gameStore.harvestCrop(r, c);
		}
	}

	function isVisible(id: UpgradeId) {
		const requires = UPGRADES[id].requires;
		return !requires || game.upgrades[requires] > 0;
	}

	function growProgress(cell: Cell) {
		if (cell.plantedAt === null || cell.readyAt === null) return 0;
		return Math.min(100, ((now - cell.plantedAt) / (cell.readyAt - cell.plantedAt)) * 100);
	}

	function sellFarm() {
		if (
			confirm(
				`Sell the farm for ${gain} 🌟 legacy seed${gain === 1 ? '' : 's'}? Money, upgrades and crops reset.`
			)
		) {
			gameStore.prestige();
		}
	}

	function hardReset() {
		if (confirm('Delete your save and start over from scratch? This cannot be undone.')) {
			gameStore.hardReset();
		}
	}
</script>

{#if offline}
	<div
		class="mx-4 mt-4 flex items-center justify-between gap-4 rounded border border-green-700 bg-yellow-50 p-3"
	>
		<span>
			While you were away for <b>{formatDuration(offline.elapsed)}</b>, your farm earned
			<b>{formatNumber(offline.earned)} 💰</b>.
			{#if offline.elapsed > BALANCE.maxOfflineMs}
				<span class="text-sm text-gray-600"
					>(Offline progress is capped at {formatDuration(BALANCE.maxOfflineMs)}.)</span
				>
			{/if}
		</span>
		<button class="rounded px-2 text-gray-600 hover:bg-yellow-100" on:click={() => (offline = null)}
			>✕</button
		>
	</div>
{/if}

<section class="relative flex flex-col lg:flex-row">
	<div class="flex-1 p-4 lg:pr-0">
		<div
			class="mx-auto grid max-w-3xl gap-2"
			style="grid-template-columns: repeat({cols}, minmax(0, 1fr));"
		>
			{#each game.field as row, r (r)}
				{#each row as cell, c (cell.id)}
					<button
						class="group relative flex aspect-square flex-col items-center justify-center rounded border border-green-700 bg-green-100 p-2 text-center hover:bg-green-200"
						class:ring-4={cell.status === 'ready'}
						class:ring-yellow-300={cell.status === 'ready'}
						on:click={() => clickCell(r, c, cell)}
					>
						{#if cell.status === 'empty'}
							<div class="text-sm text-gray-500">Empty</div>
							<div class="text-xs text-gray-500 opacity-0 group-hover:opacity-100">
								Plant {CROPS[game.selectedCrop].icon}
							</div>
						{:else if cell.status === 'growing' && cell.crop}
							<div class="text-2xl opacity-50">{CROPS[cell.crop].icon}</div>
							<div class="mt-2 h-2 w-full rounded bg-gray-300">
								<div
									class="h-full rounded bg-green-500"
									style="width: {growProgress(cell)}%;"
								></div>
							</div>
						{:else if cell.status === 'ready' && cell.crop}
							<div class="text-3xl">{CROPS[cell.crop].icon}</div>
							<div class="text-sm font-semibold">
								+{formatNumber(harvestValue(cell.crop, game))}
							</div>
						{/if}
					</button>
				{/each}
			{/each}
		</div>
	</div>

	<section class="p-4">
		<div
			class="sticky top-4 w-full space-y-4 rounded border border-green-700 bg-green-100 p-4 lg:w-80"
		>
			<div>
				<h3 class="truncate text-xl font-bold">💰 {formatNumber(game.money)}</h3>
				<p class="text-sm text-gray-600">≈ {formatNumber(incomePerSec)} / s</p>
			</div>

			<div class="space-y-2 rounded border border-green-700 bg-white p-2">
				<h4 class="font-bold">Seeds</h4>
				{#each CROP_ORDER as id (id)}
					{@const crop = CROPS[id]}
					{@const unlocked = game.unlockedCrops.includes(id)}
					{#if unlocked}
						<button
							class="flex w-full items-center justify-between rounded border px-3 py-1.5 text-left hover:bg-green-50"
							class:border-green-700={game.selectedCrop === id}
							class:bg-green-50={game.selectedCrop === id}
							class:border-gray-200={game.selectedCrop !== id}
							on:click={() => gameStore.selectCrop(id)}
						>
							<span>{crop.icon} {crop.name}</span>
							<span class="text-xs text-gray-600">
								{formatSeconds(growTime(id, game.upgrades))} · {formatNumber(
									harvestValue(id, game)
								)} 💰
							</span>
						</button>
					{:else}
						<button
							class="flex w-full items-center justify-between rounded bg-blue-500 px-3 py-1.5 text-white hover:bg-blue-600 disabled:cursor-not-allowed disabled:bg-gray-300 disabled:text-gray-600"
							disabled={game.money < crop.unlockCost}
							on:click={() => gameStore.unlockCrop(id)}
						>
							<span>🔒 {crop.icon} {crop.name}</span>
							<span class="text-sm font-bold">{formatNumber(crop.unlockCost)} 💰</span>
						</button>
					{/if}
				{/each}
				<p class="text-xs text-gray-600">
					Slower crops earn more per plot and far more per harvest, so they need fewer clicks and
					workers.
				</p>
			</div>

			{#each SECTIONS as section (section.category)}
				<div class="space-y-3 rounded border border-green-700 bg-white p-2">
					<h4 class="font-bold">{section.title}</h4>
					{#each UPGRADE_ORDER.filter((id) => UPGRADES[id].category === section.category && isVisible(id)) as id (id)}
						<UpgradeButton
							def={UPGRADES[id]}
							level={game.upgrades[id]}
							cost={upgradeCost(id, game.upgrades[id])}
							canAfford={game.money >= upgradeCost(id, game.upgrades[id])}
							maxed={isMaxed(id, game.upgrades[id])}
							effect={describeEffect(id, game)}
							on:click={() => gameStore.buyUpgrade(id)}
						/>
					{/each}
				</div>
			{/each}

			{#if showPrestige}
				<div class="space-y-2 rounded border border-purple-700 bg-white p-2">
					<h4 class="font-bold">🌟 Legacy</h4>
					<p class="text-sm">
						{game.legacySeeds} legacy seeds:
						<b>+{Math.round(game.legacySeeds * BALANCE.legacySeedBonus * 100)}%</b>
						income
					</p>
					<button
						class="w-full rounded bg-purple-600 px-3 py-2 text-white hover:bg-purple-700 disabled:cursor-not-allowed disabled:bg-gray-300 disabled:text-gray-600"
						disabled={gain < 1}
						on:click={sellFarm}
					>
						Sell farm for +{gain} 🌟
					</button>
					<p class="text-xs text-gray-600">
						Next seed at {formatNumber(prestigeThreshold(gain + 1))} 💰 earned this run.
					</p>
				</div>
			{/if}

			<div class="rounded border border-green-700 bg-white p-2 text-sm">
				<h4 class="mb-2 font-bold">Stats</h4>
				<div class="flex justify-between">
					Farmers <b>{game.upgrades.farmer} · {formatSeconds(farmerInterval(game.upgrades))} each</b
					>
				</div>
				<div class="flex justify-between">
					Seed planters
					<b>{game.upgrades.seedPlanter} · {formatSeconds(planterInterval(game.upgrades))} each</b>
				</div>
				<div class="flex justify-between">
					Field <b>{cols} × {game.field.length}</b>
				</div>
				<div class="flex justify-between">
					This run <b>{formatDuration(now - game.runStartedAt)}</b>
				</div>
				<div class="flex justify-between">
					Earned this run <b>{formatNumber(game.runEarned)}</b>
				</div>
				<div class="flex justify-between">
					Lifetime earned <b>{formatNumber(game.lifetimeEarned)}</b>
				</div>
				<div class="flex justify-between">
					Crops harvested <b>{formatNumber(game.totalHarvested)}</b>
				</div>
				{#if game.prestigeCount > 0}
					<div class="flex justify-between">
						Farms sold <b>{game.prestigeCount}</b>
					</div>
				{/if}
				<button class="mt-2 text-xs text-red-600 hover:underline" on:click={hardReset}>
					Reset save
				</button>
			</div>
		</div>
	</section>
</section>
