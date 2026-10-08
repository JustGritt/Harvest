// Svelte action: replays a one-shot CSS animation class whenever `key` changes, e.g.
// use:replay={{ key: level, cls: 'motion-safe:animate-pop' }}. It never plays on mount.
// `when` limits it to some changes (a glint only when something becomes affordable).
export interface ReplayParams {
	key: unknown;
	cls: string;
	when?: boolean;
}

export function replay(node: HTMLElement, params: ReplayParams) {
	let key = params.key;
	let cls = params.cls;

	const onEnd = (event: AnimationEvent) => {
		if (event.target === node) node.classList.remove(cls);
	};
	node.addEventListener('animationend', onEnd);

	return {
		update(next: ReplayParams) {
			const changed = next.key !== key;
			key = next.key;
			if (!changed || next.when === false) return;
			node.classList.remove(cls);
			cls = next.cls;
			void node.offsetWidth; // restart the animation even if the class was still on
			node.classList.add(cls);
		},
		destroy() {
			node.removeEventListener('animationend', onEnd);
		}
	};
}
