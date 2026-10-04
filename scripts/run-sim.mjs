// Bundles scripts/balance-sim.ts (resolving $lib) and runs it with Node.
import { build } from 'esbuild';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

const outfile = resolve('.svelte-kit/balance-sim.mjs');

await build({
	entryPoints: ['scripts/balance-sim.ts'],
	bundle: true,
	format: 'esm',
	platform: 'node',
	alias: { $lib: resolve('src/lib') },
	outfile,
	logLevel: 'warning'
});

const { status } = spawnSync(process.execPath, [outfile, ...process.argv.slice(2)], {
	stdio: 'inherit'
});
process.exit(status ?? 1);
