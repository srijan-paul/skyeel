import Mark from "./mark";
import Selection, { Coord } from "./selection";
import Span, { SpanList } from "./span";

/**
 * Represents the state of the text as a linear list of spans.
 */
export default class Doc {
  /**
   * The a document is represented as a linear list of spans.
   * So, a text like this: "The **quick** brown *fox*." is represented as:
   * ```
   * [("The ", []), ("quick", [bold]), (" brown ", []), ("fox", [italic])]
   * ```
   */
  public readonly spans = new SpanList();
  /**
   * subscribe to a document event.
   */
  public readonly on = this.spans.on;

  /**
   * Insert `text` in the current selection.
   */
  public insertTextAt(selection: Selection, text: string) {
    const { from, to } = selection;

    if (from.spanIndex !== to.spanIndex) {
      const fromIndex = from.spanIndex;
      const toIndex = to.spanIndex;

      this.spans.removeTextInSpanAt(fromIndex, from.offset);
      this.spans.removeTextInSpanAt(toIndex, 0, to.offset);
      if (toIndex === fromIndex + 1) {
        this.spans.insertAt(toIndex, new Span(this, text));
      }
      // TODO: support insertion when 3+ spans are selected.
      // this.spans.replaceSpansBetween(fromIndex + 1, toIndex, [new Span(this, text)]);
      return;
    }

    this.spans.insertTextInSpanAt(from.spanIndex, text, from.offset, to.offset);
  }

  /**
   * Add `mark` to add spans that have some overlap with the `selection`.
   * @param selection Current selection.
   * @param mark The mark to add
   */
  public addMarkToSelection({ from, to }: Selection, mark: Mark) {
    const beginSpanIdx = from.spanIndex;
    const endSpanIdx = to.spanIndex;
    const fromIndex = from.offset;
    const toIndex = to.offset;

    if (beginSpanIdx === endSpanIdx) {
      this.spans.addMarkInsideSpanAt(beginSpanIdx, mark, fromIndex, toIndex);
      return;
    }

    this.spans.addMarkToSpansBetween(mark, beginSpanIdx + 1, endSpanIdx);

    const newFirstSpans = this.spans.addMarkInsideSpanAt(beginSpanIdx, mark, fromIndex);
    // Once `firstSpan` has been replaced with `newFirstSpans`,
    // the array size will have grown by some number.
    // We need to account for this when replacing the last span,
    // since it has moved past `endSpanIdx` by now.
    const newEndSpanIdx = endSpanIdx + newFirstSpans.length - 1;
    this.spans.addMarkInsideSpanAt(newEndSpanIdx, mark, 0, toIndex);
  }
}
