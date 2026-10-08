<script lang="ts">
	import { onMount } from 'svelte';
	import { gameStore } from '$lib/store';
	import { BALANCE } from '$lib/data/balance';
	import { CROPS, CROP_ORDER } from '$lib/data/crops';
	import { UPGRADES, UPGRADE_ORDER, type UpgradeCategory } from '$lib/data/upgrades';
	import BuyButton from '$lib/components/BuyButton.svelte';
	import Panel from '$lib/components/Panel.svelte';
	import MoneyDisplay from '$lib/components/MoneyDisplay.svelte';
	import Plot from '$lib/components/Plot.svelte';
	import type { Cell, HarvestEvent, OfflineReport, UpgradeId } from '$lib/types';
	import {
		cropRate,
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

	const SECTIONS: { category: UpgradeCategory; title: string; icon: string }[] = [
		{ category: 'workers', title: 'Workers', icon: '🧑‍🌾' },
		{ category: 'growth', title: 'Growth & Value', icon: '🌿' },
		{ category: 'field', title: 'Field', icon: '🚜' }
	];

	$: game = $gameStore;
	$: now = game.lastTick;
	$: cols = game.field[0]?.length ?? BALANCE.baseCols;
	$: gain = prestigeGain(game.runEarned);
	$: showPrestige = gain > 0 || game.prestigeCount > 0;
	$: nextSeedProgress =
		(game.runEarned - prestigeThreshold(gain)) /
		(prestigeThreshold(gain + 1) - prestigeThreshold(gain));

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
		<!-- Wooden frame around the field -->
		<div
			class="border-wood-700 bg-soil-800 mx-auto grid max-w-3xl gap-1 rounded-xl border-4 p-1 shadow-lg sm:gap-2 sm:rounded-2xl sm:p-2"
			style="grid-template-columns: repeat({cols}, minmax(0, 1fr));"
		>
			{#each game.field as row, r (r)}
				{#each row as cell, c (cell.id)}
					<Plot
						{cell}
						{now}
						selectedCrop={game.selectedCrop}
						value={cell.crop ? harvestValue(cell.crop, game) : 0}
						pops={pops.filter((p) => p.cellId === cell.id)}
						on:click={() => clickCell(r, c, cell)}
					/>
				{/each}
			{/each}
		</div>
	</div>

	<!-- Desktop: sticky sidebar. Mobile: bottom sheet above the tab bar, open only when a tab is. -->
	<section
		class="{activeTab
			? 'block'
			: 'hidden'} border-wood-600 bg-parchment-200 fixed inset-x-0 bottom-14 z-20 max-h-[45vh] overflow-y-auto rounded-t-2xl border-t-4 p-3 shadow-[0_-4px_12px_rgba(0,0,0,0.15)] lg:static lg:block lg:max-h-none lg:overflow-visible lg:rounded-none lg:border-0 lg:bg-transparent lg:p-4 lg:shadow-none"
	>
		<div
			class="w-full space-y-3 lg:sticky lg:top-4 lg:max-h-[calc(100vh-2rem)] lg:w-80 lg:overflow-y-auto lg:pb-1"
		>
			<div
				class="border-wood-600 bg-parchment-100 hidden rounded-xl border-2 px-3 py-2 shadow-md lg:block"
			>
				<MoneyDisplay money={game.money} {incomePerSec} bump={moneyBump} />
			</div>

			<Panel title="Seeds" icon="🌾" class={panelVisibility('seeds', activeTab)}>
				{#each CROP_ORDER as id (id)}
					{@const crop = CROPS[id]}
					{@const selected = game.selectedCrop === id}
					{#if game.unlockedCrops.includes(id)}
						<button
							class="flex w-full items-center gap-2.5 rounded-lg border-2 px-2 py-1.5 text-left transition {selected
								? 'border-gold-500 bg-gold-100 shadow-[0_0_0_2px_var(--color-gold-200)]'
								: 'border-soil-200 bg-parchment-50 hover:border-wood-400'}"
							aria-pressed={selected}
							on:click={() => gameStore.selectCrop(id)}
						>
							<span
								class="bg-parchment-100 grid size-9 shrink-0 place-items-center rounded-md text-xl shadow-inner"
								aria-hidden="true">{crop.icon}</span
							>
							<span class="min-w-0 flex-1 leading-tight">
								<span class="block font-semibold">{crop.name}</span>
								<span class="text-wood-600 block text-xs tabular-nums">
									{formatSeconds(growTime(id, game.upgrades))} · {formatNumber(
										harvestValue(id, game)
									)} 💰 · {formatNumber(cropRate(id, game))}/s per plot
								</span>
							</span>
							{#if selected}
								<span class="text-gold-600 font-bold" aria-hidden="true">✓</span>
							{/if}
						</button>
					{:else}
						<BuyButton
							icon={crop.icon}
							name={crop.name}
							badge="🔒"
							effect="{formatSeconds(growTime(id, game.upgrades))} · {formatNumber(
								harvestValue(id, game)
							)} 💰 per harvest"
							cost={crop.unlockCost}
							money={game.money}
							on:click={() => gameStore.unlockCrop(id)}
						/>
					{/if}
				{/each}
				<p class="text-wood-600 text-xs">
					Slower crops earn more per plot and far more per harvest, so they need fewer clicks and
					workers.
				</p>
			</Panel>

			<div class="{panelVisibility('upgrades', activeTab)} space-y-3">
				{#each SECTIONS as section (section.category)}
					<Panel title={section.title} icon={section.icon}>
						{#each UPGRADE_ORDER.filter((id) => UPGRADES[id].category === section.category && isVisible(id)) as id (id)}
							{@const def = UPGRADES[id]}
							{@const level = game.upgrades[id]}
							<BuyButton
								icon={def.icon}
								name={def.name}
								badge={def.maxLevel ? `Lv ${level}` : `×${level}`}
								effect={describeEffect(id, game)}
								description={def.description}
								cost={upgradeCost(id, level)}
								money={game.money}
								maxed={isMaxed(id, level)}
								on:click={() => gameStore.buyUpgrade(id)}
							/>
						{/each}
					</Panel>
				{/each}
			</div>

			{#if showPrestige}
				<Panel title="Legacy" icon="🌟" accent="gold" class={panelVisibility('legacy', activeTab)}>
					<p class="text-sm">
						<b class="font-display text-base">{game.legacySeeds} 🌟</b> legacy seeds give
						<b>+{Math.round(game.legacySeeds * BALANCE.legacySeedBonus * 100)}%</b> income.
					</p>
					<div>
						<div class="text-wood-600 flex justify-between text-xs tabular-nums">
							<span>Next seed</span>
							<span
								>{formatNumber(game.runEarned)} / {formatNumber(prestigeThreshold(gain + 1))}</span
							>
						</div>
						<div class="bg-soil-200 mt-0.5 h-2 overflow-hidden rounded-full">
							<div
								class="bg-gold-400 h-full rounded-full transition-[width] duration-300"
								style="width: {nextSeedProgress * 100}%"
							></div>
						</div>
					</div>
					<button
						class="font-display border-gold-600 bg-gold-400 text-wood-900 hover:bg-gold-300 disabled:border-soil-200 disabled:bg-parchment-50 disabled:text-wood-600 w-full rounded-lg border-2 px-3 py-2 text-lg font-semibold shadow-[0_3px_0_var(--color-gold-600)] transition active:translate-y-0.5 active:shadow-none disabled:cursor-not-allowed disabled:shadow-none"
						disabled={gain < 1}
						on:click={sellFarm}
					>
						Sell farm for +{gain} 🌟
					</button>
				</Panel>
			{/if}

			<Panel title="Stats" icon="📊" class="{panelVisibility('stats', activeTab)} text-sm">
				<dl class="grid grid-cols-[1fr_auto] gap-x-3 gap-y-1 tabular-nums">
					<dt>Farmers</dt>
					<dd class="font-semibold">
						{game.upgrades.farmer} · {formatSeconds(farmerInterval(game.upgrades))} each
					</dd>
					<dt>Seed planters</dt>
					<dd class="font-semibold">
						{game.upgrades.seedPlanter} · {formatSeconds(planterInterval(game.upgrades))} each
					</dd>
					<dt>Field</dt>
					<dd class="font-semibold">{cols} × {game.field.length}</dd>
					<dt>This run</dt>
					<dd class="font-semibold">{formatDuration(now - game.runStartedAt)}</dd>
					<dt>Earned this run</dt>
					<dd class="font-semibold">{formatNumber(game.runEarned)}</dd>
					<dt>Lifetime earned</dt>
					<dd class="font-semibold">{formatNumber(game.lifetimeEarned)}</dd>
					<dt>Crops harvested</dt>
					<dd class="font-semibold">{formatNumber(game.totalHarvested)}</dd>
					{#if game.prestigeCount > 0}
						<dt>Farms sold</dt>
						<dd class="font-semibold">{game.prestigeCount}</dd>
					{/if}
				</dl>

				<div class="border-soil-200 mt-1 border-t-2 border-dashed pt-2">
					<h3 class="font-display mb-1.5 font-semibold">⚙️ Save</h3>
					<div class="flex gap-2 text-xs">
						<button
							class="border-wood-500 text-wood-700 hover:bg-parchment-200 rounded-md border-2 px-2 py-1 font-semibold"
							aria-expanded={showTransfer}
							on:click={() => {
								showTransfer = !showTransfer;
								transferStatus = null;
							}}
						>
							{showTransfer ? 'Hide export / import' : 'Export / import'}
						</button>
						<button
							class="border-berry-500 text-berry-600 hover:bg-berry-100 rounded-md border-2 px-2 py-1 font-semibold"
							on:click={hardReset}>Reset save</button
						>
					</div>
					{#if showTransfer}
						<div class="mt-2 space-y-2">
							<textarea
								bind:value={transferText}
								rows="3"
								class="border-soil-200 bg-parchment-50 w-full rounded-md border-2 p-1 font-mono text-xs break-all"
								placeholder="Paste an exported save here"
								aria-label="Save text"
							></textarea>
							<div class="flex gap-2">
								<button
									class="bg-leaf-600 hover:bg-leaf-700 flex-1 rounded-md px-2 py-1 text-xs font-semibold text-white"
									on:click={exportSave}>Export</button
								>
								<button
									class="bg-wood-500 hover:bg-wood-600 flex-1 rounded-md px-2 py-1 text-xs font-semibold text-white"
									on:click={importSave}>Import</button
								>
							</div>
							{#if transferStatus}
								<p
									class="text-xs"
									class:text-leaf-700={transferStatus.ok}
									class:text-berry-600={!transferStatus.ok}
								>
									{transferStatus.message}
								</p>
							{/if}
						</div>
					{/if}
				</div>
			</Panel>
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
