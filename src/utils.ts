// Replace all elements of `xs` in the range [from, to) with `ys`.
// and return the resulting array.
export function replaceArrayRange<T>(xs: T[], from: number, to: number, ys: T[]): T[] {
	const before = xs.slice(0, from);
	const after = xs.slice(to, xs.length);
	return before.concat(ys, after);
}

// TODO
export function impossible(): never {
	throw new Error("Impossible");
}

// TODO
export function notImplemented(): never {
	throw new Error("Not implemented");
}

export type Pair<T1, T2 = T1> = [T1, T2];
