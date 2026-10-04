// The game reads its save from localStorage on mount; rendering a fresh farm on the
// server first would just flash before the save replaces it.
export const ssr = false;
