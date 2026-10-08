// Particles for player feedback (dirt puffs, plucked crops, coins flying to the money counter).
// Each particle is one <svg><use> sprite animated with the Web Animations API, so the browser
// runs them on the compositor and no per-frame JS is involved. Everything is a no-op under
// prefers-reduced-motion, and live particles are capped.
import type { ArtId } from '$lib/art/ids';

export const MAX_PARTICLES = 80;
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

function spawn(art: ArtId, at: Point, size: number): SVGSVGElement | null {
	if (!layer || live >= MAX_PARTICLES) return null;
	const el = document.createElementNS(SVG_NS, 'svg');
	const use = document.createElementNS(SVG_NS, 'use');
	use.setAttribute('href', `#art-${art}`);
	el.append(use);
	el.setAttribute('aria-hidden', 'true');
	el.style.cssText = `position:absolute;left:${at.x - size / 2}px;top:${at.y - size / 2}px;width:${size}px;height:${size}px;will-change:transform,opacity`;
	layer.append(el);
	live++;
	return el;
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
		const el = spawn(art, at, size);
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

/** A harvested crop hopping out of its plot and fading. */
export function pluck(rect: DOMRect, art: ArtId) {
	if (reducedMotion()) return;
	const size = rect.width * 0.78;
	const el = spawn(art, centerOf(rect), size);
	if (!el) return;
	play(
		el,
		[
			{ transform: 'translateY(0) scale(1)', opacity: 1 },
			{ transform: `translateY(${-size * 0.45}px) scale(1.15)`, opacity: 1, offset: 0.4 },
			{ transform: `translateY(${-size * 0.6}px) scale(0.9)`, opacity: 0 }
		],
		{ duration: 450, easing: 'cubic-bezier(0.2, 0.8, 0.4, 1)' }
	);
}

function visibleMoneyTarget(): HTMLElement | null {
	for (const el of moneyTargets) if (el.getClientRects().length > 0) return el;
	return null;
}

/**
 * Coins arcing from a point to the visible money counter. Resolves when the first coin lands
 * (right away when there's nothing to animate), so callers can bump the counter on arrival.
 */
export function flyCoins(from: Point, count: number, size = 22): Promise<void> {
	const target = visibleMoneyTarget();
	if (reducedMotion() || !layer || !target) return Promise.resolve();
	const to = centerOf(target.getBoundingClientRect());
	const duration = 650;
	return new Promise((resolve) => {
		let landed = false;
		for (let i = 0; i < count; i++) {
			const start = {
				x: from.x + (Math.random() - 0.5) * 16,
				y: from.y + (Math.random() - 0.5) * 10
			};
			const el = spawn('coin', start, size);
			if (!el) break;
			const dx = to.x - start.x;
			const dy = to.y - start.y;
			const lift = -40 - Math.random() * 30;
			const animation = play(
				el,
				[
					{ transform: 'translate(0, 0) scale(0.4)', opacity: 0 },
					{
						transform: `translate(${dx * 0.15}px, ${lift}px) scale(1.1)`,
						opacity: 1,
						offset: 0.3
					},
					{ transform: `translate(${dx}px, ${dy}px) scale(0.6)`, opacity: 0.9 }
				],
				{ duration, delay: i * 70, easing: 'cubic-bezier(0.5, 0, 0.75, 0.4)' }
			);
			animation.addEventListener('finish', () => {
				if (!landed) {
					landed = true;
					resolve();
				}
			});
		}
		// Never leave the caller waiting if every coin was dropped by the cap
		setTimeout(
			() => {
				if (!landed) resolve();
			},
			duration + count * 70
		);
	});
}
