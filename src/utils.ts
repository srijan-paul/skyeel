// Replace all elements of `xs` in the range [from, to) with `ys`.
// and return the resulting array.
export function replaceArrayRange<T>(xs: T[], from: number, to: number, ys: T[]): T[] {
  const before = xs.slice(0, from);
  const after = xs.slice(to, xs.length);
  return before.concat(ys, after);
}

export const enum RelativePos {
  left, // selection is to the left of a given span-range, no overlap.
  leftOverlap, // selection is to the left, and has some overlap on the right side.
  right, // selection is to the right of a given span-range.
  rightOverlap, // selection is to the right, and has some overlap on the left side.
  inside, // selection is inside a given span-range
  surround, // the selection surrounds the span-range,
  equal,
}

/**
 *
 * @param rangeAStart Beginning of the first range
 * @param rangeAEnd End of the first range (inclusive)
 * @param rangeBStart Beginning of the second range.
 * @param rangeBEnd End of the second range (inclusive)
 * @returns An enum representing how the the first range is positioned w.r.t the second.
 */
export function getRelativePosOfRanges(
  rangeAStart: number,
  rangeAEnd: number,
  rangeBStart: number,
  rangeBEnd: number
) {
  if (rangeAStart === rangeBStart && rangeAEnd === rangeBEnd) {
    return RelativePos.equal;
  }

  if (rangeAStart < rangeBStart) {
    if (rangeAEnd < rangeBEnd) {
      return rangeBStart <= rangeAEnd ? RelativePos.leftOverlap : RelativePos.left;
    }
    // first range surrounds the second
    return RelativePos.surround;
  }

  // rangeAStart > rangeBStart

  if (rangeAEnd <= rangeBEnd) return RelativePos.inside;

  // rangeAStart > rangeBStart && rangeAEnd > rangeBEnd.
  if (rangeAStart <= rangeBEnd) {
    return RelativePos.rightOverlap;
  }

  return RelativePos.right;
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
