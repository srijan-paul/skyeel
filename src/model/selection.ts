/**
 * A definite location inside the document.
 * It comprises of a span and a zero-indexed offset inside the span.
 */
export interface Coord {
  // Index of the span inside the document's span list.
  spanIndex: number;
  // An index into the span's text (zero-indexed).
  offset: number;
}

export class Coord implements Coord {
  constructor(public spanIndex: number, public offset: number) {}
}

export default interface Selection {
  from: Coord;
  to: Coord;
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
 * Represents a range of selected text in the Document.
 */
export default class Selection implements Selection {
  /**
   * @returns `true` if `sel` overlaps with any spans between `fromSpan` and `toSpan`.
   */
  static hasOverlapWithSpanRange(sel: Selection, fromSpan: number, toSpan: number): boolean {
    return sel.from.spanIndex < toSpan && fromSpan < sel.to.spanIndex;
  }

  /**
   * @param sel The selection to check
   * @param firstSpanIndex Index of the first span in the range.
   * @param lastSpanIndex Index of the last span in the range.
   * @returns Position of `sel`, relative to a contiguous range of spans in a SpanList.
   */
  static getRelativePos(
    sel: Selection,
    firstSpanIndex: number,
    lastSpanIndex: number
  ): RelativePos {
    const fromIndex = sel.from.spanIndex;
    const toIndex = sel.to.spanIndex;

    if (fromIndex === firstSpanIndex && toIndex === lastSpanIndex) {
      return RelativePos.equal;
    }

    if (fromIndex < firstSpanIndex) {
      if (toIndex < lastSpanIndex) {
        return firstSpanIndex <= toIndex ? RelativePos.leftOverlap : RelativePos.left;
      }
      // the selection surrounds the span range.
      return RelativePos.surround;
    }

    // fromIndex > beginSpanIndex

    if (toIndex <= lastSpanIndex) return RelativePos.inside;

    // fromIndex > beginSpanIndex && toIndex > lastSpanIndex.
    if (fromIndex <= lastSpanIndex) {
      return RelativePos.rightOverlap;
    }

    return RelativePos.right;
  }

  constructor(
    // start location
    public from: Coord,
    // end location
    public to: Coord
  ) {}
}
