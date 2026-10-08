<script lang="ts">
	import { onMount } from 'svelte';
	import { gameStore } from '$lib/store';
	import { BALANCE } from '$lib/data/balance';
	import { CROPS, CROP_ORDER } from '$lib/data/crops';
	import { UPGRADES, UPGRADE_ORDER, type UpgradeCategory } from '$lib/data/upgrades';
	import UpgradeButton from '$lib/components/UpgradeButton.svelte';
	import MoneyDisplay from '$lib/components/MoneyDisplay.svelte';
	import type { Cell, HarvestEvent, OfflineReport, UpgradeId } from '$lib/types';
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

	// Mobile: the shop lives in a bottom sheet opened from a tab bar. Desktop shows every panel.
	type Tab = 'seeds' | 'upgrades' | 'legacy' | 'stats';
	interface TabDef {
		id: Tab;
		label: string;
		icon: string;
		/** Shows a dot when something in the tab can be bought. */
		alert: boolean;
	}
	let activeTab: Tab | null = null;
	let tabs: TabDef[];
	$: if (activeTab === 'legacy' && !showPrestige) activeTab = null;
	$: tabs = [
		{
			id: 'seeds',
			label: 'Seeds',
			icon: '🌾',
			alert: CROP_ORDER.some(
				(id) => !game.unlockedCrops.includes(id) && game.money >= CROPS[id].unlockCost
			)
		},
		{
			id: 'upgrades',
			label: 'Upgrades',
			icon: '🛒',
			alert: UPGRADE_ORDER.some(
				(id) =>
					isVisible(id) &&
					!isMaxed(id, game.upgrades[id]) &&
					game.money >= upgradeCost(id, game.upgrades[id])
			)
		},
		...(showPrestige
			? [{ id: 'legacy' as const, label: 'Legacy', icon: '🌟', alert: gain > 0 }]
			: []),
		{ id: 'stats', label: 'Stats', icon: '📊', alert: false }
	];

	/** Hidden on mobile unless its tab is open; always shown on desktop. */
	function panelVisibility(tab: Tab, active: Tab | null) {
		return `${active === tab ? '' : 'hidden'} lg:block`;
	}

	let offline: OfflineReport | null = null;

	// Floating "+N" pops shown over harvested plots
	const POP_MS = 900;
	const MAX_POPS = 30;
	let pops: (HarvestEvent & { key: number })[] = [];
	let nextPopKey = 0;
	/** Bumped on player harvests to replay the money animation. */
	let moneyBump = 0;

	function addPop(event: HarvestEvent) {
		if (!event.auto) moneyBump++;
		// Under heavy automation, drop farmer pops rather than flood the DOM
		if (event.auto && pops.length >= MAX_POPS) return;
		const key = nextPopKey++;
		pops = [...pops.slice(-(MAX_POPS - 1)), { ...event, key }];
		setTimeout(() => {
			pops = pops.filter((p) => p.key !== key);
		}, POP_MS);
	}

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
		// Subscribed after load so offline catch-up doesn't spawn pops
		const stopPops = gameStore.onHarvest(addPop);

		const tickInterval = setInterval(() => gameStore.tick(), BALANCE.tickMs);
		const incomeInterval = setInterval(sampleIncome, 1000);
		const saveInterval = setInterval(gameStore.save, BALANCE.saveIntervalMs);
		const onVisibility = () => {
			if (document.visibilityState === 'hidden') gameStore.save();
		};
		document.addEventListener('visibilitychange', onVisibility);
		window.addEventListener('beforeunload', gameStore.save);

		return () => {
			stopPops();
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

	// Save transfer between browsers
	let showTransfer = false;
	let transferText = '';
	let transferStatus: { ok: boolean; message: string } | null = null;

	async function exportSave() {
		transferText = gameStore.exportSave();
		try {
			await navigator.clipboard.writeText(transferText);
			transferStatus = { ok: true, message: 'Save copied to clipboard.' };
		} catch {
			transferStatus = { ok: true, message: 'Copy the text above to keep your save.' };
		}
	}

	function importSave() {
		if (!transferText.trim()) {
			transferStatus = { ok: false, message: 'Paste an exported save first.' };
			return;
		}
		if (!confirm('Replace your current game with this save? Your current progress will be lost.')) {
			return;
		}
		if (gameStore.importSave(transferText)) {
			gameStore.save();
			transferText = '';
			transferStatus = { ok: true, message: 'Save imported.' };
		} else {
			transferStatus = { ok: false, message: "That doesn't look like a valid Harvest save." };
		}
	}
</script>

{#if offline}
	<div
		class="mx-2 mt-2 flex items-center justify-between gap-4 rounded border border-green-700 bg-yellow-50 p-3 sm:mx-4 sm:mt-4"
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

<!-- Top bar: title everywhere, plus money on mobile (desktop shows it in the sidebar) -->
<header
	class="border-wood-700 bg-wood-500 text-parchment-100 sticky top-0 z-10 flex items-center justify-between gap-3 border-b-4 px-3 py-1.5 shadow-md lg:static lg:px-4 lg:py-2"
>
	<h1
		class="font-display flex items-center gap-1.5 text-xl font-semibold tracking-wide lg:text-2xl"
	>
		<span aria-hidden="true">🌾</span> Harvest
	</h1>
	<div class="bg-parchment-100 rounded-lg px-2.5 py-0.5 lg:hidden">
		<MoneyDisplay money={game.money} {incomePerSec} bump={moneyBump} compact />
	</div>
</header>

<section class="relative flex flex-col pb-16 lg:flex-row lg:pb-0">
	<div class="flex-1 p-2 sm:p-4 lg:pr-0">
		<div
			class="mx-auto grid max-w-3xl gap-1 sm:gap-2"
			style="grid-template-columns: repeat({cols}, minmax(0, 1fr));"
		>
			{#each game.field as row, r (r)}
				{#each row as cell, c (cell.id)}
					<button
						class="group relative flex aspect-square touch-manipulation flex-col items-center justify-center rounded border border-green-700 bg-green-100 p-0.5 text-center select-none hover:bg-green-200 sm:p-2"
						class:ring-2={cell.status === 'ready'}
						class:sm:ring-4={cell.status === 'ready'}
						class:ring-yellow-300={cell.status === 'ready'}
						aria-label={cell.crop
							? `${CROPS[cell.crop].name}, ${cell.status}`
							: `Empty plot, plant ${CROPS[game.selectedCrop].name}`}
						on:click={() => clickCell(r, c, cell)}
					>
						{#if cell.status === 'empty'}
							<div class="hidden text-sm text-gray-500 sm:block">Empty</div>
							<div class="hidden text-xs text-gray-500 opacity-0 group-hover:opacity-100 sm:block">
								Plant {CROPS[game.selectedCrop].icon}
							</div>
						{:else if cell.status === 'growing' && cell.crop}
							<div class="text-lg opacity-50 sm:text-2xl">{CROPS[cell.crop].icon}</div>
							<div class="mt-1 h-1 w-full rounded bg-gray-300 sm:mt-2 sm:h-2">
								<div
									class="h-full rounded bg-green-500"
									style="width: {growProgress(cell)}%;"
								></div>
							</div>
						{:else if cell.status === 'ready' && cell.crop}
							<div class="motion-safe:animate-ready text-xl sm:text-3xl">
								{CROPS[cell.crop].icon}
							</div>
							<div class="hidden text-sm font-semibold sm:block">
								+{formatNumber(harvestValue(cell.crop, game))}
							</div>
						{/if}
						{#each pops.filter((p) => p.cellId === cell.id) as pop (pop.key)}
							<span
								class="motion-safe:animate-float-up motion-reduce:animate-fade-out pointer-events-none absolute top-1/4 left-1/2 z-[1] -translate-x-1/2 whitespace-nowrap {pop.auto
									? 'text-xs text-gray-600'
									: 'text-sm font-bold text-green-800 sm:text-base'}"
							>
								+{formatNumber(pop.value)}
							</span>
						{/each}
					</button>
				{/each}
			{/each}
		</div>
	</div>

	<!-- Desktop: sticky sidebar. Mobile: bottom sheet above the tab bar, open only when a tab is. -->
	<section
		class="{activeTab
			? 'block'
			: 'hidden'} fixed inset-x-0 bottom-14 z-20 max-h-[40vh] overflow-y-auto border-t border-green-700 bg-green-100 p-3 shadow-[0_-4px_12px_rgba(0,0,0,0.1)] lg:static lg:block lg:max-h-none lg:overflow-visible lg:border-0 lg:bg-transparent lg:p-4 lg:shadow-none"
	>
		<div
			class="w-full space-y-4 lg:sticky lg:top-4 lg:max-h-[calc(100vh-2rem)] lg:w-80 lg:overflow-y-auto lg:rounded lg:border lg:border-green-700 lg:bg-green-100 lg:p-4"
		>
			<div class="hidden lg:block">
				<MoneyDisplay money={game.money} {incomePerSec} bump={moneyBump} />
			</div>

			<div
				class="{panelVisibility(
					'seeds',
					activeTab
				)} space-y-2 rounded border border-green-700 bg-white p-2"
			>
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

			<div class="{panelVisibility('upgrades', activeTab)} space-y-4">
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
			</div>

			{#if showPrestige}
				<div
					class="{panelVisibility(
						'legacy',
						activeTab
					)} space-y-2 rounded border border-purple-700 bg-white p-2"
				>
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

			<div
				class="{panelVisibility(
					'stats',
					activeTab
				)} rounded border border-green-700 bg-white p-2 text-sm"
			>
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
				<div class="mt-2 flex gap-3 text-xs">
					<button
						class="text-green-800 hover:underline"
						on:click={() => {
							showTransfer = !showTransfer;
							transferStatus = null;
						}}
					>
						{showTransfer ? 'Hide' : 'Export / import'}
					</button>
					<button class="text-red-600 hover:underline" on:click={hardReset}>Reset save</button>
				</div>
				{#if showTransfer}
					<div class="mt-2 space-y-2">
						<textarea
							bind:value={transferText}
							rows="3"
							class="w-full rounded border border-gray-300 p-1 font-mono text-xs break-all"
							placeholder="Paste an exported save here"
							aria-label="Save text"
						></textarea>
						<div class="flex gap-2">
							<button
								class="flex-1 rounded bg-green-600 px-2 py-1 text-xs text-white hover:bg-green-700"
								on:click={exportSave}>Export</button
							>
							<button
								class="flex-1 rounded bg-blue-500 px-2 py-1 text-xs text-white hover:bg-blue-600"
								on:click={importSave}>Import</button
							>
						</div>
						{#if transferStatus}
							<p
								class="text-xs"
								class:text-green-700={transferStatus.ok}
								class:text-red-600={!transferStatus.ok}
							>
								{transferStatus.message}
							</p>
						{/if}
					</div>
				{/if}
			</div>
		</div>
	</section>
</section>

<!-- Mobile tab bar -->
<nav
	class="fixed inset-x-0 bottom-0 z-30 flex h-14 border-t border-green-700 bg-white lg:hidden"
	aria-label="Shop"
>
	{#each tabs as tab (tab.id)}
		<button
			class="relative flex flex-1 flex-col items-center justify-center text-xs"
			class:bg-green-100={activeTab === tab.id}
			class:font-bold={activeTab === tab.id}
			aria-pressed={activeTab === tab.id}
			on:click={() => (activeTab = activeTab === tab.id ? null : tab.id)}
		>
			<span class="text-lg leading-none">{tab.icon}</span>
			{tab.label}
			{#if tab.alert}
				<span
					class="absolute top-1.5 right-1/4 h-2 w-2 rounded-full bg-orange-500"
					aria-hidden="true"
				></span>
			{/if}
		</button>
	{/each}
</nav>
