import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { ART_IDS } from './ids';
import { EXTRA_ART_COLORS } from './palette';
import { ART_SOURCES, toSymbol } from './sprites';

const css = readFileSync('src/app.css', 'utf8');
const tokenColors = [...css.matchAll(/--color-[\w-]+:\s*(#[0-9a-f]{6})/gi)].map((m) => m[1]);
const palette = new Set([...tokenColors, ...EXTRA_ART_COLORS].map((c) => c.toLowerCase()));

describe('art manifest', () => {
	it('has a file for every id and an id for every file', () => {
		expect(Object.keys(ART_SOURCES).sort()).toEqual([...ART_IDS].sort());
	});
});

describe.each(Object.entries(ART_SOURCES))('%s.svg', (name, svg) => {
	it('uses the standard canvas', () => {
		const tile = name.startsWith('soil-');
		expect(svg).toContain(tile ? 'viewBox="0 0 32 32"' : 'viewBox="0 0 48 48"');
	});

	it('has no text, gradients or scripts', () => {
		expect(svg).not.toMatch(/<(text|linearGradient|radialGradient|script|image)\b/);
	});

	it('only uses palette colours', () => {
		const colors = [...svg.matchAll(/#[0-9a-f]{6}\b/gi)].map((m) => m[0].toLowerCase());
		expect(colors.filter((c) => !palette.has(c))).toEqual([]);
	});
});

describe('toSymbol', () => {
	it('turns an svg file into a symbol with the same viewBox and contents', () => {
		const svg = '<svg xmlns="x" viewBox="0 0 48 48" fill="none">\n<circle r="1"/>\n</svg>\n';
		expect(toSymbol('dot', svg)).toBe(
			'<symbol id="art-dot" viewBox="0 0 48 48">\n<circle r="1"/>\n</symbol>'
		);
	});
});
