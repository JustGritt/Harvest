import { dev } from '$app/environment';
import { error } from '@sveltejs/kit';

// Contact sheet for reviewing sprites. Development only.
export const ssr = false;

export function load() {
	if (!dev) error(404, 'Not found');
}
