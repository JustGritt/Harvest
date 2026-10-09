// Particles for player feedback (dirt puffs, plucked crops, coins flying to the money counter).
// Each particle is one <svg><use> sprite animated with the Web Animations API, so the browser
// runs them on the compositor and no per-frame JS is involved. Everything is a no-op under
// prefers-reduced-motion, and live particles are capped.
import type { ArtId } from '$lib/art/ids';

export const MAX_PARTICLES = 80;
/** Slots decorative bursts leave free, so coins (which carry money) still get to fly. */
const COIN_RESERVE = 20;
const SVG_NS = 'http://www.w3.org/2000/svg';

let layer: HTMLElement | null = null;
let live = 0;
const moneyTargets = new Set<HTMLElement>();

export interface Point {
	x: number;
	y: number;
}

/** The fixed overlay particles are drawn in (FxLayer.svelte). */
export function setFxLayer(el: HTMLElement | null) {
	layer = el;
}

/** Svelte action: marks an element coins can fly to. The visible one is used. */
export function moneyTarget(node: HTMLElement) {
	moneyTargets.add(node);
	return {
		destroy() {
			moneyTargets.delete(node);
		}
	};
}

export function reducedMotion(): boolean {
	return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/** Coins per harvest: one per order of magnitude of the value, 1 to 5. */
export function coinCount(value: number): number {
	return Math.max(1, Math.min(5, Math.round(Math.log10(Math.max(1, value)))));
}

/**
 * Offsets for `count` particles fanned over `arc` radians centred on straight up, at
 * 60–100% of `spread` pixels, with a little jitter so bursts don't look stamped.
 */
export function burstVectors(
	count: number,
	spread: number,
	arc = Math.PI * 2,
	rng: () => number = Math.random
): Point[] {
	return Array.from({ length: count }, (_, i) => {
		const t = count === 1 ? 0.5 : i / (count - 1);
		const full = arc >= Math.PI * 2;
		const angle = -Math.PI / 2 + (full ? (i / count) * arc : (t - 0.5) * arc) + (rng() - 0.5) * 0.4;
		const dist = spread * (0.6 + rng() * 0.4);
		return { x: Math.cos(angle) * dist, y: Math.sin(angle) * dist };
	});
}

export function centerOf(rect: DOMRect): Point {
	return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
}

function place<T extends Element & ElementCSSInlineStyle>(el: T, at: Point, size: number): T {
	el.setAttribute('aria-hidden', 'true');
	el.style.cssText = `position:absolute;left:${at.x - size / 2}px;top:${at.y - size / 2}px;width:${size}px;height:${size}px;will-change:transform,opacity`;
	layer?.append(el);
	live++;
	return el;
}

function spawn(art: ArtId, at: Point, size: number, limit = MAX_PARTICLES): SVGSVGElement | null {
	if (!layer || live >= limit) return null;
	const el = document.createElementNS(SVG_NS, 'svg');
	const use = document.createElementNS(SVG_NS, 'use');
	use.setAttribute('href', `#art-${art}`);
	el.append(use);
	return place(el, at, size);
}

function play(el: Element, keyframes: Keyframe[], options: KeyframeAnimationOptions) {
	const animation = el.animate(keyframes, { fill: 'forwards', ...options });
	const done = () => {
		el.remove();
		live--;
	};
	animation.onfinish = done;
	animation.oncancel = done;
	return animation;
}

export interface BurstOptions {
	art: ArtId;
	count: number;
	/** Distance in px particles travel. */
	spread: number;
	size: number;
	/** Fan angle in radians around straight up. Defaults to a full circle. */
	arc?: number;
	duration?: number;
}

/** Particles spraying out from a point, then falling a little and fading. */
export function burst(at: Point, { art, count, spread, size, arc, duration = 600 }: BurstOptions) {
	if (reducedMotion()) return;
	for (const v of burstVectors(count, spread, arc)) {
		const el = spawn(art, at, size, MAX_PARTICLES - COIN_RESERVE);
		if (!el) return;
		const spin = (Math.random() - 0.5) * 120;
		play(
			el,
			[
				{ transform: 'translate(0, 0) scale(0.5) rotate(0deg)', opacity: 1 },
				{
					transform: `translate(${v.x}px, ${v.y}px) scale(1) rotate(${spin / 2}deg)`,
					opacity: 1,
					offset: 0.55
				},
				{
					transform: `translate(${v.x * 1.1}px, ${v.y + spread * 0.35}px) scale(0.8) rotate(${spin}deg)`,
					opacity: 0
				}
			],
			{ duration, easing: 'cubic-bezier(0.2, 0.7, 0.3, 1)' }
		);
	}
}

/** A gold shockwave ring expanding from a point. */
export function ring(at: Point, size: number) {
	if (reducedMotion() || !layer || live >= MAX_PARTICLES - COIN_RESERVE) return;
	const el = place(document.createElement('div'), at, size);
	el.style.borderRadius = '50%';
	el.style.border = `${Math.max(2, size * 0.05)}px solid var(--color-gold-200)`;
	el.style.boxShadow = '0 0 10px var(--color-gold-300), inset 0 0 6px var(--color-gold-300)';
	play(
		el,
		[
			{ transform: 'scale(0.3)', opacity: 1 },
			{ transform: 'scale(1)', opacity: 0 }
		],
		{ duration: 420, easing: 'cubic-bezier(0.1, 0.7, 0.3, 1)' }
	);
}

/**
 * A harvested crop yanked out of its plot: a quick squash, then it stretches up and is tossed
 * to a random side with a spin, shrinking away.
 */
export function pluck(rect: DOMRect, art: ArtId, filter = '') {
	if (reducedMotion()) return;
	const size = rect.width * 0.78;
	const el = spawn(art, centerOf(rect), size);
	if (!el) return;
	el.style.filter = filter;
	el.style.transformOrigin = '50% 85%';
	const side = Math.random() < 0.5 ? -1 : 1;
	play(
		el,
		[
			{ transform: 'translate(0, 0) scale(1, 1) rotate(0deg)', opacity: 1 },
			{ transform: 'translate(0, 4%) scale(1.2, 0.78) rotate(0deg)', opacity: 1, offset: 0.12 },
			{
				transform: `translate(${side * size * 0.12}px, ${-size * 0.7}px) scale(0.88, 1.18) rotate(${side * 12}deg)`,
				opacity: 1,
				offset: 0.42
			},
			{
				transform: `translate(${side * size * 0.35}px, ${-size * 0.55}px) scale(0.35) rotate(${side * 70}deg)`,
				opacity: 0
			}
		],
		{ duration: 560, easing: 'cubic-bezier(0.25, 0.8, 0.4, 1)' }
	);
}

/**
 * The player's "+N" over a reaped plot, with a "×N" chip during a streak. It lives in the FX
 * layer so it can rise past the plot's edge and above the plucked crop. `scale` grows it.
 */
export function floatText(
	at: Point,
	text: string,
	{ scale = 1, combo = 0, label = '', labelColor = '' } = {}
) {
	if (reducedMotion() || !layer) return;
	const el = document.createElement('div');
	el.setAttribute('aria-hidden', 'true');
	el.className =
		'font-display absolute flex flex-col items-center leading-none font-bold whitespace-nowrap tabular-nums';
	el.style.cssText = `left:${at.x}px;top:${at.y}px;font-size:${scale}rem;will-change:transform,opacity`;
	if (label) {
		// A mutation's name above the value, e.g. "Golden!"
		const tag = document.createElement('span');
		tag.className =
			'mb-0.5 text-sm [-webkit-text-stroke:3px_var(--color-wood-900)] [paint-order:stroke_fill] sm:text-base';
		tag.style.color = labelColor;
		tag.textContent = label;
		el.append(tag);
	}
	const value = document.createElement('span');
	value.className =
		'text-gold-100 text-lg [-webkit-text-stroke:4px_var(--color-wood-900)] [paint-order:stroke_fill] sm:text-2xl';
	value.textContent = text;
	el.append(value);
	if (combo) {
		const chip = document.createElement('span');
		chip.className =
			'bg-berry-500 border-berry-700 mt-1 rounded-full border-2 px-2 py-0.5 text-xs text-white sm:text-sm';
		chip.textContent = `×${combo}`;
		el.append(chip);
	}
	layer.append(el);
	live++;
	play(
		el,
		[
			{ transform: 'translate(-50%, 0) scale(0.4)', opacity: 0 },
			{ transform: 'translate(-50%, -110%) scale(1.35)', opacity: 1, offset: 0.18 },
			{ transform: 'translate(-50%, -140%) scale(1)', opacity: 1, offset: 0.32 },
			{ transform: 'translate(-50%, -190%) scale(1)', opacity: 1, offset: 0.75 },
			{ transform: 'translate(-50%, -250%) scale(0.95)', opacity: 0 }
		],
		{ duration: 950, easing: 'ease-out' }
	);
}

function visibleMoneyTarget(): HTMLElement | null {
	for (const el of moneyTargets) if (el.getClientRects().length > 0) return el;
	return null;
}

export interface FlyCoinsOptions {
	size?: number;
	/** Called once per coin as it reaches the counter (right away when it can't fly). */
	onLand?: (index: number) => void;
}

/**
 * Coins that fountain out of a point, hang for a beat, then home in on the visible money
 * counter, accelerating as they go. Resolves once every coin has landed.
 */
export function flyCoins(
	from: Point,
	count: number,
	{ size = 22, onLand }: FlyCoinsOptions = {}
): Promise<void> {
	const landed = new Set<number>();
	const land = (i: number) => {
		if (landed.has(i)) return;
		landed.add(i);
		onLand?.(i);
	};
	const target = visibleMoneyTarget();
	if (reducedMotion() || !layer || !target) {
		for (let i = 0; i < count; i++) land(i);
		return Promise.resolve();
	}
	const to = centerOf(target.getBoundingClientRect());
	const duration = 760;
	const stagger = 60;
	const fan = burstVectors(count, 34 + count * 4, Math.PI * 0.8);
	return new Promise((resolve) => {
		let done = false;
		const finish = () => {
			if (done) return;
			done = true;
			for (let i = 0; i < count; i++) land(i);
			burst(to, { art: 'sparkle', count: 3, spread: 18, size: 12, duration: 400 });
			resolve();
		};
		for (let i = 0; i < count; i++) {
			const el = spawn('coin', from, size);
			if (!el) {
				land(i);
				continue;
			}
			const out = fan[i];
			const dx = to.x - from.x;
			const dy = to.y - from.y;
			const animation = play(
				el,
				[
					{
						transform: 'translate(0, 0) scale(0.4)',
						opacity: 0,
						easing: 'cubic-bezier(0.15, 0.8, 0.3, 1)'
					},
					{
						transform: `translate(${out.x}px, ${out.y}px) scale(1.15)`,
						opacity: 1,
						offset: 0.36,
						easing: 'ease-in-out'
					},
					{
						transform: `translate(${out.x * 1.05}px, ${out.y + 6}px) scale(1.05)`,
						opacity: 1,
						offset: 0.46,
						easing: 'cubic-bezier(0.6, 0, 0.9, 0.4)'
					},
					{ transform: `translate(${dx}px, ${dy}px) scale(0.6)`, opacity: 1 }
				],
				{ duration, delay: i * stagger }
			);
			animation.addEventListener('finish', () => {
				land(i);
				if (landed.size === count) finish();
			});
		}
		if (landed.size === count) return finish();
		// Never leave the counter short if an animation was cancelled
		setTimeout(finish, duration + count * stagger + 200);
	});
}
