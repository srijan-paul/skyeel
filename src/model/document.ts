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
	spans = new SpanList();

	/**
	 * subscribe to a document event.
	 */
	on = this.spans.on;

	/**
	 * Insert `text` in the current selection.
	 */
	insertTextAt(selection: Selection, text: string) {
		// TODO: handle the case where the selection spans multiple nodes.
		if (selection.from.span !== selection.to.span) {
			throw new Error("Not implemented");
		}

		selection.from.span.insertTextAt(text, selection.from.index, selection.to.index);
	}

	/**
	 * Add `mark` to add spans that have some overlap with the `selection`.
	 * @param selection Current selection.
	 * @param mark The mark to add
	 */
	addMarkToRange({ from, to }: Selection, mark: Mark) {
		// TODO: handle right to left selections.
		const beginSpanIdx = this.spans.indexOf(from.span);
		const endSpanIdx = this.spans.indexOf(to.span);
		const fromIndex = from.index;
		const toIndex = to.index;

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
