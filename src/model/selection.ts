import { RelativePos, getRelativePosOfRanges } from "../utils";
export { RelativePos } from "../utils";

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

/**
 * Represends a span inside a list of spans, and an offset into the text
 * contained within the span.
 */
export class Coord implements Coord {
  constructor(public spanIndex: number, public offset: number) {}
}

export default interface Selection {
  from: Coord;
  to: Coord;
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
    return getRelativePosOfRanges(
      sel.from.spanIndex,
      sel.to.spanIndex,
      firstSpanIndex,
      lastSpanIndex
    );
  }

  /**
   * @param sel A selection object
   * @returns `true` if the selection is a caret, false if it's a range.
   */
  public static isCaret(sel: Selection) {
    return sel.from.spanIndex === sel.to.spanIndex && sel.from.offset === sel.to.offset;
  }

  /**
   * construct a selection object from ([fromIndex, fromOffset], [toIndex, toOffset]).
   */
  public static fromCoords(
    [idx1, offset1]: [number, number],
    [idx2, offset2]: [number, number]
  ): Selection {
    return new Selection(new Coord(idx1, offset1), new Coord(idx2, offset2));
  }

  constructor(
    // start location
    public from: Coord,
    // end location
    public to: Coord
  ) {}
}
