/**
 * Replace all elements of `xs`  in range `[from, to)` with `ys`.
 */
export function replaceArrayRange<T>(xs: T[], from: number, to: number, ys: T[]): T[] {
  const before = xs.slice(0, from);
  const after = xs.slice(to, xs.length);
  return before.concat(ys, after);
}

/**
 * Position of two numeric ranges relative to each other.
 */
export const enum RelativePos {
  left, // one range is to the other's left  [----] (----)
  leftOverlap, // one range is to the other's left, but has an overlap on the right end [----(--]---)
  right, // one range is to the other's right (----) [----]
  rightOverlap, // one range is to the other's right, but has overlap on the left end. (---[-)--]
  inside, // one range is inside the other (---[----]---)
  surround, // one range surrounds the other [---(---)---]
  equal, // both ranges are equal [(---)]
}

/**
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

/**
 * Dummy function for control flow situations that should never be reachable.
 */
export function impossible(): never {
  throw new Error("Impossible");
}

/**
 * Dummy function to demarcate unimplemented features
 */
export function notImplemented(): never {
  throw new Error("Not implemented");
}

export type Pair<T1, T2 = T1> = [T1, T2];
