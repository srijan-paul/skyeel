// Replace all elements of `xs` in the range [from, to) with `ys`.
// and return the resulting array.
export function replaceArrayRange<T>(xs: T[], from: number, to: number, ys: T[]): T[] {
	const before = xs.slice(0, from);
	const after = xs.slice(to, xs.length);
	return before.concat(ys, after);
}
