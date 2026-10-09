<script lang="ts">
	import { onMount } from 'svelte';
	import { get } from 'svelte/store';
	import { tweened } from 'svelte/motion';
	import { backOut, cubicOut } from 'svelte/easing';
	import { fade } from 'svelte/transition';
	import { gameStore } from '$lib/store';
	import { BALANCE } from '$lib/data/balance';
	import { CROPS, CROP_ORDER } from '$lib/data/crops';
	import { UPGRADES, UPGRADE_ORDER, type UpgradeCategory } from '$lib/data/upgrades';
	import Art from '$lib/art/Art.svelte';
	import { cropArt, UPGRADE_ART, type ArtId } from '$lib/art/ids';
	import BuyButton from '$lib/components/BuyButton.svelte';
	import Dialog from '$lib/components/Dialog.svelte';
	import Panel from '$lib/components/Panel.svelte';
	import MoneyDisplay from '$lib/components/MoneyDisplay.svelte';
	import Plot from '$lib/components/Plot.svelte';
	import {
		burst,
		centerOf,
		coinCount,
		floatText,
		flyCoins,
		pluck,
		reducedMotion,
		ring
	} from '$lib/fx/fx';
	import { COMBO_LABEL_FROM, NO_STREAK, nextStreak, streakHype, type Streak } from '$lib/fx/streak';
	import { replay } from '$lib/fx/replay';
	import fenceFrame from '$lib/art/svg/field/fence-frame.svg?url';
	import type { Cell, CropId, HarvestEvent, OfflineReport, UpgradeId } from '$lib/types';
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

	const SECTIONS: { category: UpgradeCategory; title: string; icon: ArtId }[] = [
		{ category: 'workers', title: 'Workers', icon: 'farmer' },
		{ category: 'growth', title: 'Growth & Value', icon: 'leaf' },
		{ category: 'field', title: 'Field', icon: 'expand-field' }
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
		icon: ArtId;
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
			icon: 'pouch',
			alert: CROP_ORDER.some(
				(id) => !game.unlockedCrops.includes(id) && game.money >= CROPS[id].unlockCost
			)
		},
		{
			id: 'upgrades',
			label: 'Upgrades',
			icon: 'stall',
			alert: UPGRADE_ORDER.some(
				(id) =>
					isVisible(id) &&
					!isMaxed(id, game.upgrades[id]) &&
					game.money >= upgradeCost(id, game.upgrades[id])
			)
		},
		...(showPrestige
			? [{ id: 'legacy' as const, label: 'Legacy', icon: 'legacy-seed' as const, alert: gain > 0 }]
			: []),
		{ id: 'stats', label: 'Stats', icon: 'ledger', alert: false }
	];

	// The last opened tab stays rendered while the sheet slides closed
	let sheetTab: Tab | null = null;
	$: if (activeTab) sheetTab = activeTab;

	/** Hidden on mobile unless its tab is in the sheet; always shown on desktop. */
	function panelVisibility(tab: Tab, shown: Tab | null) {
		return `${shown === tab ? '' : 'hidden'} lg:block`;
	}

	function onKeydown(event: KeyboardEvent) {
		if (event.key === 'Escape') activeTab = null;
	}

	let offline: OfflineReport | null = null;
	const welcomeEarned = tweened(0, { easing: cubicOut });

	function collect(event: MouseEvent) {
		const from = centerOf((event.currentTarget as HTMLElement).getBoundingClientRect());
		offline = null;
		flyCoins(from, 5).then(() => moneyBump++);
	}

	// Plots added by Expand Field grow in, staggered
	let fieldReady = false;
	function growIn(_node: Element, { delay }: { delay: number }) {
		if (!fieldReady || reducedMotion()) return { duration: 0 };
		return {
			delay,
			duration: 350,
			css: (t: number) => `transform: scale(${backOut(t)}); opacity: ${Math.min(1, t * 2)}`
		};
	}

	// Unlocking a crop: sparkle burst, and the new seed card pops in
	let justUnlocked: CropId | null = null;
	function unlock(id: CropId, event: MouseEvent) {
		const at = centerOf((event.currentTarget as HTMLElement).getBoundingClientRect());
		gameStore.unlockCrop(id);
		if (!get(gameStore).unlockedCrops.includes(id)) return;
		justUnlocked = id;
		burst(at, { art: 'sparkle', count: 10, spread: 70, size: 22 });
		burst(at, { art: 'petal', count: 6, spread: 50, size: 16 });
	}

	// Dialog buttons
	const BTN = 'rounded-lg border-2 px-3 py-1.5 font-semibold transition';
	const BTN_PLAIN = 'border-soil-200 bg-parchment-50 text-wood-700 hover:bg-parchment-200';
	const BTN_LEAF = 'border-leaf-700 bg-leaf-500 text-white hover:bg-leaf-600';
	const BTN_GOLD = 'border-gold-600 bg-gold-400 text-wood-900 hover:bg-gold-300';
	const BTN_WOOD = 'border-wood-700 bg-wood-500 text-white hover:bg-wood-600';
	const BTN_DANGER = 'border-berry-700 bg-berry-500 text-white hover:bg-berry-600';

	// Floating "+N" pops shown over harvested plots
	const POP_MS = 900;
	const MAX_POPS = 30;
	let pops: (HarvestEvent & { key: number; streak?: number })[] = [];
	let nextPopKey = 0;
	/** Bumped as each harvest coin reaches the counter, to replay the money animation. */
	let moneyBump = 0;
	/** Money from player harvests whose coins are still flying; the counter adds it as they land. */
	let pendingMoney = 0;
	let lastMoney = 0;
	// Spending (or prestige) while coins fly: just show the real amount
	$: {
		if (game.money < lastMoney) pendingMoney = 0;
		lastMoney = game.money;
	}
	/** Player reaps in quick succession (cosmetic combo). */
	let streak: Streak = NO_STREAK;

	function addPop(event: HarvestEvent) {
		// Under heavy automation, drop farmer pops rather than flood the DOM
		if (event.auto && pops.length >= MAX_POPS) return;
		if (!event.auto) streak = nextStreak(streak, Date.now());
		const key = nextPopKey++;
		const pop = { ...event, key, streak: event.auto ? undefined : streak.count };
		pops = [...pops.slice(-(MAX_POPS - 1)), pop];
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
		if (report && report.earned > 0 && report.elapsed >= 60_000) {
			offline = report;
			welcomeEarned.set(report.earned, { duration: reducedMotion() ? 0 : 1200 });
		}
		// New plots grow in from now on, not on first load
		requestAnimationFrame(() => (fieldReady = true));
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

	// Player actions get particles; workers don't, so an automated field stays calm
	function clickCell(r: number, c: number, cell: Cell, plot: HTMLElement) {
		const rect = plot.getBoundingClientRect();
		if (cell.status === 'empty') {
			gameStore.plantCrop(r, c);
			if (get(gameStore).field[r][c].status !== 'empty') {
				const { x, y } = centerOf(rect);
				burst(
					{ x, y: y + rect.height * 0.2 },
					{
						art: 'dirt',
						count: 6,
						spread: rect.width * 0.5,
						size: rect.width * 0.18,
						arc: Math.PI
					}
				);
			}
			return;
		}
		const crop = cell.crop;
		const before = get(gameStore).runEarned;
		gameStore.harvestCrop(r, c);
		const earned = get(gameStore).runEarned - before;
		if (earned <= 0 || !crop) return;
		reapFx(rect, crop, earned);
	}

	// Coins go first: decorative bursts leave them room under the particle cap
	function reapFx(rect: DOMRect, crop: CropId, earned: number) {
		const at = centerOf(rect);
		const w = rect.width;
		const hype = streakHype(streak.count);
		const coins = coinCount(earned);
		let left = earned;
		pendingMoney += earned;
		flyCoins(at, coins, {
			onLand: (i) => {
				const chunk = i === coins - 1 ? left : earned / coins;
				left -= chunk;
				pendingMoney = Math.max(0, pendingMoney - chunk);
				moneyBump++;
			}
		});
		pluck(rect, cropArt(crop, 'mature'));
		ring(at, w * (1.1 + hype * 0.6));
		burst(at, {
			art: 'leaf',
			count: 3 + Math.round(hype * 3),
			spread: w * 0.6,
			size: w * 0.2
		});
		burst(at, {
			art: 'sparkle',
			count: 3 + Math.round(hype * 5),
			spread: w * (0.5 + hype * 0.4),
			size: w * 0.22
		});
		burst(
			{ x: at.x, y: at.y + rect.height * 0.25 },
			{ art: 'dirt', count: 3, spread: w * 0.35, size: w * 0.15, arc: Math.PI * 0.8 }
		);
		floatText({ x: at.x, y: rect.top + rect.height * 0.2 }, `+${formatNumber(earned)}`, {
			scale: 1 + hype * 0.5,
			combo: streak.count >= COMBO_LABEL_FROM ? streak.count : 0
		});
	}

	// Pressing a plot acts right away; dragging on from it reaps every ripe plot passed over
	// (or plants every empty one, if the drag started on an empty plot). Keyboard uses click.
	let sweep: 'plant' | 'harvest' | null = null;
	let lastSwept: string | null = null;

	function pressCell(r: number, c: number, cell: Cell, event: PointerEvent) {
		if (event.button !== 0) return;
		sweep = cell.status === 'empty' ? 'plant' : 'harvest';
		lastSwept = cell.id;
		clickCell(r, c, cell, event.currentTarget as HTMLElement);
	}

	function sweepMove(event: PointerEvent) {
		if (!sweep) return;
		// Coalesced points catch plots a fast drag skips between events (empty for synthetic ones)
		const points = event.getCoalescedEvents?.() ?? [];
		for (const point of points.length ? points : [event]) {
			const plot = document
				.elementFromPoint(point.clientX, point.clientY)
				?.closest<HTMLElement>('[data-cell]');
			const id = plot?.dataset.cell;
			if (!plot || !id || id === lastSwept) continue;
			lastSwept = id;
			get(gameStore).field.forEach((row, r) =>
				row.forEach((cell, c) => {
					if (cell.id !== id) return;
					if (sweep === 'plant' ? cell.status === 'empty' : cell.status === 'ready') {
						clickCell(r, c, cell, plot);
					}
				})
			);
		}
	}

	function endSweep() {
		sweep = null;
		lastSwept = null;
	}

	function isVisible(id: UpgradeId) {
		const requires = UPGRADES[id].requires;
		return !requires || game.upgrades[requires] > 0;
	}

	// Which confirmation dialog is open
	let confirming: 'sell' | 'reset' | 'import' | null = null;

	// Selling the farm: a golden sunrise covers the field while the run resets underneath
	let sunrise = false;
	function sellFarm() {
		confirming = null;
		if (reducedMotion()) {
			gameStore.prestige();
			return;
		}
		sunrise = true;
		burst(
			{ x: innerWidth / 2, y: innerHeight / 2 },
			{ art: 'legacy-seed', count: 12, spread: 170, size: 36, duration: 900 }
		);
		setTimeout(() => gameStore.prestige(), 450);
		setTimeout(() => (sunrise = false), 1300);
	}

	function hardReset() {
		confirming = null;
		gameStore.hardReset();
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

	function askImport() {
		if (!transferText.trim()) {
			transferStatus = { ok: false, message: 'Paste an exported save first.' };
			return;
		}
		confirming = 'import';
	}

	function importSave() {
		confirming = null;
		if (gameStore.importSave(transferText)) {
			gameStore.save();
			transferText = '';
			transferStatus = { ok: true, message: 'Save imported.' };
		} else {
			transferStatus = { ok: false, message: "That doesn't look like a valid Harvest save." };
		}
	}
</script>

<Dialog
	open={offline !== null}
	title="Welcome back!"
	icon="sunrise"
	on:close={() => (offline = null)}
>
	{#if offline}
		<p>While you were away for <b>{formatDuration(offline.elapsed)}</b>, your farm earned</p>
		<p class="font-display text-gold-700 text-center text-3xl font-semibold tabular-nums">
			+{formatNumber($welcomeEarned)}
			<Art id="coin" label="money" />
		</p>
		{#if offline.elapsed > BALANCE.maxOfflineMs}
			<p class="text-wood-600 text-xs">
				Offline progress is capped at {formatDuration(BALANCE.maxOfflineMs)}.
			</p>
		{/if}
	{/if}
	<button slot="actions" class="{BTN} {BTN_LEAF}" on:click={collect}>Collect</button>
</Dialog>

<Dialog
	open={confirming === 'sell'}
	title="Sell the farm?"
	icon="legacy-seed"
	on:close={() => (confirming = null)}
>
	<p>
		You get <b>+{gain} <Art id="legacy-seed" /> legacy seed{gain === 1 ? '' : 's'}</b>, for
		<b>+{Math.round((game.legacySeeds + gain) * BALANCE.legacySeedBonus * 100)}%</b> income in every
		future run.
	</p>
	<ul class="list-inside list-disc space-y-0.5">
		<li><b>Resets:</b> money, upgrades, unlocked crops and the field.</li>
		<li><b>Keeps:</b> legacy seeds and lifetime stats.</li>
	</ul>
	<svelte:fragment slot="actions">
		<button class="{BTN} {BTN_PLAIN}" on:click={() => (confirming = null)}>Cancel</button>
		<button class="{BTN} {BTN_GOLD}" on:click={sellFarm}
			>Sell for +{gain} <Art id="legacy-seed" label="legacy seeds" /></button
		>
	</svelte:fragment>
</Dialog>

<Dialog
	open={confirming === 'reset'}
	title="Reset your save?"
	icon="warning"
	on:close={() => (confirming = null)}
>
	<p>
		This deletes everything, legacy seeds included, and starts over from scratch. It can't be
		undone.
	</p>
	<svelte:fragment slot="actions">
		<button class="{BTN} {BTN_PLAIN}" on:click={() => (confirming = null)}>Cancel</button>
		<button class="{BTN} {BTN_DANGER}" on:click={hardReset}>Delete save</button>
	</svelte:fragment>
</Dialog>

<Dialog
	open={confirming === 'import'}
	title="Import this save?"
	icon="crate"
	on:close={() => (confirming = null)}
>
	<p>It replaces your current game. Your current progress will be lost.</p>
	<svelte:fragment slot="actions">
		<button class="{BTN} {BTN_PLAIN}" on:click={() => (confirming = null)}>Cancel</button>
		<button class="{BTN} {BTN_WOOD}" on:click={importSave}>Import</button>
	</svelte:fragment>
</Dialog>

<!-- Top bar: title everywhere, plus money on mobile (desktop shows it in the sidebar) -->
<header
	class="border-wood-700 bg-wood-500 text-parchment-100 sticky top-0 z-10 flex items-center justify-between gap-3 border-b-4 px-3 py-1.5 shadow-md lg:static lg:px-4 lg:py-2"
>
	<h1
		class="font-display flex items-center gap-1.5 text-xl font-semibold tracking-wide lg:text-2xl"
	>
		<Art id="wheat-mature" size="1.3em" /> Harvest
	</h1>
	<div class="bg-parchment-100 rounded-lg px-2.5 py-0.5 lg:hidden">
		<MoneyDisplay
			money={game.money}
			{incomePerSec}
			bump={moneyBump}
			pending={pendingMoney}
			compact
		/>
	</div>
</header>

<svelte:window
	on:keydown={onKeydown}
	on:pointermove={sweepMove}
	on:pointerup={endSweep}
	on:pointercancel={endSweep}
/>

{#if sunrise}
	<div
		class="from-gold-100 to-gold-300 fixed inset-0 z-[35] grid place-items-center bg-linear-to-b"
		in:fade={{ duration: 400 }}
		out:fade={{ duration: 700 }}
		role="status"
	>
		<div class="flex flex-col items-center gap-2">
			<span class="motion-safe:animate-pop"><Art id="sunrise" size="8rem" /></span>
			<p class="font-display text-wood-800 text-2xl font-semibold">A new season begins</p>
		</div>
	</div>
{/if}

<section
	class="relative flex flex-col pb-[calc(4rem+env(safe-area-inset-bottom))] lg:flex-row lg:pb-0"
>
	<div class="flex-1 p-2 sm:p-4 lg:pr-0">
		{#if game.totalHarvested === 0 && game.prestigeCount === 0}
			<p
				class="border-wood-600 bg-parchment-100 mx-auto mb-2 max-w-3xl rounded-lg border-2 px-3 py-1.5 text-center text-sm shadow-sm"
			>
				<span class="motion-safe:animate-bob inline-block"><Art id="pointer" size="1.4em" /></span>
				Tap an empty plot to plant {CROPS[game.selectedCrop].name.toLowerCase()}, then tap it again
				when it glows to harvest. Drag across plots to do several at once.
			</p>
		{/if}
		<!-- Fence around the field (9-slice border image) -->
		<div
			class="bg-soil-800 mx-auto grid max-w-3xl gap-1 border-[14px] bg-clip-padding p-1 sm:gap-2 sm:border-[22px] sm:p-1.5"
			style="grid-template-columns: repeat({cols}, minmax(0, 1fr)); border-image: url(&quot;{fenceFrame}&quot;) 12 round;"
		>
			{#each game.field as row, r (r)}
				{#each row as cell, c (cell.id)}
					<div in:growIn={{ delay: (r + c) * 40 }}>
						<Plot
							{cell}
							{now}
							selectedCrop={game.selectedCrop}
							value={cell.crop ? harvestValue(cell.crop, game, cell.mutation) : 0}
							pops={pops.filter((p) => p.cellId === cell.id)}
							on:pointerdown={(e) => pressCell(r, c, cell, e)}
							on:click={(e) =>
								e.detail === 0 && clickCell(r, c, cell, e.currentTarget as HTMLElement)}
						/>
					</div>
				{/each}
			{/each}
		</div>
	</div>

	<!-- Desktop: sticky sidebar. Mobile: bottom sheet above the tab bar, open only when a tab is. -->
	<section
		class="{activeTab
			? 'translate-y-0'
			: 'invisible translate-y-full'} border-wood-600 bg-parchment-200 fixed inset-x-0 bottom-[calc(3.5rem+env(safe-area-inset-bottom))] z-20 flex max-h-[50vh] flex-col rounded-t-2xl border-t-4 shadow-[0_-4px_12px_rgba(0,0,0,0.15)] transition-[translate,visibility] duration-300 ease-out motion-reduce:transition-none lg:visible lg:static lg:block lg:max-h-none lg:translate-y-0 lg:rounded-none lg:border-0 lg:bg-transparent lg:p-4 lg:shadow-none"
	>
		<!-- Mobile sheet header: grab handle and close button -->
		<div class="relative flex h-8 shrink-0 items-center justify-end px-2 lg:hidden">
			<span
				class="bg-wood-400 absolute top-2 left-1/2 h-1.5 w-12 -translate-x-1/2 rounded-full"
				aria-hidden="true"
			></span>
			<button
				class="text-wood-700 hover:bg-parchment-300 grid size-8 place-items-center rounded-full"
				aria-label="Close"
				on:click={() => (activeTab = null)}><Art id="close" size="1.1rem" /></button
			>
		</div>
		<div
			class="min-h-0 w-full space-y-3 overflow-y-auto px-3 pb-3 lg:sticky lg:top-4 lg:max-h-[calc(100vh-2rem)] lg:w-80 lg:px-0 lg:pb-1"
		>
			<div
				class="border-wood-600 bg-parchment-100 hidden rounded-xl border-2 px-3 py-2 shadow-md lg:block"
			>
				<MoneyDisplay money={game.money} {incomePerSec} bump={moneyBump} pending={pendingMoney} />
			</div>

			<Panel title="Seeds" icon="pouch" class={panelVisibility('seeds', sheetTab)}>
				{#each CROP_ORDER as id (id)}
					{@const crop = CROPS[id]}
					{@const selected = game.selectedCrop === id}
					{#if game.unlockedCrops.includes(id)}
						<button
							class="flex w-full items-center gap-2.5 rounded-lg border-2 px-2 py-1.5 text-left transition {selected
								? 'border-gold-500 bg-gold-100 shadow-[0_0_0_2px_var(--color-gold-200)]'
								: 'border-soil-200 bg-parchment-50 hover:border-wood-400'}"
							class:motion-safe:animate-pop={justUnlocked === id}
							aria-pressed={selected}
							on:click={() => gameStore.selectCrop(id)}
						>
							<span
								class="bg-parchment-100 grid size-9 shrink-0 place-items-center rounded-md shadow-inner"
							>
								<Art id={cropArt(id, 'mature')} size="1.75rem" />
							</span>
							<span class="min-w-0 flex-1 leading-tight">
								<span class="block font-semibold">{crop.name}</span>
								<span class="text-wood-600 block text-xs tabular-nums">
									{formatSeconds(growTime(id, game.upgrades))} · {formatNumber(
										harvestValue(id, game)
									)}
									<Art id="coin" /> · {formatNumber(cropRate(id, game))}/s per plot
								</span>
							</span>
							{#if selected}
								<span class="motion-safe:animate-pop"><Art id="check" size="1.25rem" /></span>
							{/if}
						</button>
					{:else}
						<BuyButton
							art={cropArt(id, 'mature')}
							name={crop.name}
							locked
							effect="{formatSeconds(growTime(id, game.upgrades))} · {formatNumber(
								harvestValue(id, game)
							)} per harvest"
							cost={crop.unlockCost}
							money={game.money}
							on:click={(e) => unlock(id, e)}
						/>
					{/if}
				{/each}
				<p class="text-wood-600 text-xs">
					Slower crops earn more per plot and far more per harvest, so they need fewer clicks and
					workers.
				</p>
			</Panel>

			<div class="{panelVisibility('upgrades', sheetTab)} space-y-3">
				{#each SECTIONS as section (section.category)}
					<Panel title={section.title} icon={section.icon}>
						{#each UPGRADE_ORDER.filter((id) => UPGRADES[id].category === section.category && isVisible(id)) as id (id)}
							{@const def = UPGRADES[id]}
							{@const level = game.upgrades[id]}
							<BuyButton
								art={UPGRADE_ART[id]}
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
				<Panel
					title="Legacy"
					icon="legacy-seed"
					accent="gold"
					class={panelVisibility('legacy', sheetTab)}
				>
					<p class="text-sm">
						<b class="font-display text-base">{game.legacySeeds} <Art id="legacy-seed" /></b> legacy
						seeds give
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
						on:click={() => (confirming = 'sell')}
					>
						Sell farm for +{gain}
						<Art id="legacy-seed" label="legacy seeds" />
					</button>
				</Panel>
			{/if}

			<Panel title="Stats" icon="ledger" class="{panelVisibility('stats', sheetTab)} text-sm">
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
					<h3 class="font-display mb-1.5 flex items-center gap-1.5 font-semibold">
						<Art id="crate" size="1.2em" /> Save
					</h3>
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
							on:click={() => (confirming = 'reset')}>Reset save</button
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
									on:click={askImport}>Import</button
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
	class="border-wood-700 bg-wood-500 fixed inset-x-0 bottom-0 z-30 flex gap-1 border-t-4 px-1 pb-[env(safe-area-inset-bottom)] shadow-[0_-2px_8px_rgba(0,0,0,0.2)] lg:hidden"
	aria-label="Shop"
>
	{#each tabs as tab (tab.id)}
		{@const active = activeTab === tab.id}
		<button
			class="relative my-1 flex h-12 flex-1 flex-col items-center justify-center rounded-xl text-xs font-semibold transition-colors {active
				? 'bg-parchment-100 text-wood-900 shadow-inner'
				: 'text-parchment-100 hover:bg-wood-600'}"
			aria-pressed={active}
			on:click={() => (activeTab = active ? null : tab.id)}
		>
			<span use:replay={{ key: active, cls: 'motion-safe:animate-pop', when: active }}>
				<Art id={tab.icon} size="1.6rem" />
			</span>
			{tab.label}
			{#if tab.alert}
				<span
					class="bg-gold-300 ring-wood-500 absolute top-1 right-1/4 size-2.5 rounded-full ring-2 motion-safe:animate-pulse"
					aria-hidden="true"
				></span>
			{/if}
		</button>
	{/each}
</nav>
