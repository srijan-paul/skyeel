import { cloneDeep } from "lodash";
import Mark from "./mark";
import Selection from "./selection";
import { SpanList } from "./span";

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
   * update the document's selection.
   */
  public setSelection(sel: Selection) {
    this.spans.updateSelection(sel);
  }

  /**
   * Insert `text` in the current selection.
   */
  public insertTextAt(selection: Selection, text: string) {
    const { from, to } = selection;

    if (from.spanIndex !== to.spanIndex) {
      const fromIndex = from.spanIndex;
      const toIndex = to.spanIndex;

      this.spans.insertTextInSpanAt(
        fromIndex,
        text,
        from.offset,
        this.spans.at(fromIndex).text.length
      );

      this.spans.removeTextInSpanAt(toIndex, 0, to.offset);
      this.spans.deleteBetween(fromIndex + 1, toIndex);
      return;
    }

    this.spans.insertTextInSpanAt(from.spanIndex, text, from.offset, to.offset);
  }

  /**
   * Delete content to the caret's left.
   * If the selection is a range instead, then perform a simple delete.
   */
  public deleteContentBackwards() {
    const sel = this.spans.selection;

    if (Selection.isCaret(sel)) {
      // when deleting backwards in a caret, the character under the caret is removed.
      let { spanIndex, offset } = sel.from;

      if (offset === 0) {
        if (spanIndex === 0) {
          // Caret is at the beginning of the document, nothing to delete.
          return;
        }

        // Place the caret at the ending of the previous span.
        spanIndex--;
        offset = this.spans.at(spanIndex).text.length;
        sel.from.spanIndex = spanIndex;
        sel.from.offset = offset;
        sel.to = cloneDeep(sel.from);
      }

      this.spans.removeTextInSpanAt(spanIndex, offset - 1, offset);
      return;
    }

    this.insertTextAt(sel, "");
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
