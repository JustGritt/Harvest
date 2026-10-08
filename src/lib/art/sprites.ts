// Every SVG in ./svg becomes a <symbol id="art-<file name>"> in one sprite sheet, so a sprite
// is drawn with <use href="#art-…"> and its markup lives in the page once.
const files = import.meta.glob('./svg/**/*.svg', {
	query: '?raw',
	import: 'default',
	eager: true
}) as Record<string, string>;

/** Raw SVG source keyed by sprite name (file name without extension). */
export const ART_SOURCES: Record<string, string> = Object.fromEntries(
	Object.entries(files).map(([path, svg]) => [
		path
			.split('/')
			.pop()!
			.replace(/\.svg$/, ''),
		svg
	])
);

export function toSymbol(name: string, svg: string): string {
	const viewBox = /viewBox="([^"]+)"/.exec(svg)?.[1] ?? '0 0 48 48';
	const inner = svg.replace(/^[\s\S]*?<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '');
	return `<symbol id="art-${name}" viewBox="${viewBox}">${inner}</symbol>`;
}

/** Hidden, zero-size (not display:none, which can break <use> references) sprite sheet. */
export const SPRITE_SHEET = `<svg xmlns="http://www.w3.org/2000/svg" style="position:absolute;width:0;height:0;overflow:hidden">${Object.entries(
	ART_SOURCES
)
	.map(([name, svg]) => toSymbol(name, svg))
	.join('')}</svg>`;
