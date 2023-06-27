import Mark from "./mark";
import { Pair, replaceArrayRange } from "../utils";
import Selection, { Coord } from "./selection";

/**
 * A `Span` represents a contiguous array of text in the document.
 */
export class Span {
	// A set of marks, where each mark specifies what kind of formatting needs
	// to be applied to this span. E.g: [bold, italic]
	readonly markSet = new Set<Mark>();

	/**
	 * Add `mark` to a range of text inside `span`.
	 * Doing so can cause the span to split into multiple spans.
	 * ### Example:
	 * ```js
	 * // add the bold mark to range 4->9 (quick).
	 * addMarkToRange(["The quick brown fox", ()], 4, 9, BoldMark);
	 *
	 * [["The ", ()], ["quick", (BoldMark)], ["brown fox", ()]]
	 * ```
	 * @param span The span to split.
	 * @param from beginning of the range (inclusive).
	 * @param to end of the range (exclusive).
	 * @param mark The mark to add.
	 * @returns An array containing the resulting spans.
	 */
	static addMarkToRange(span: Span, from: number, to: number, mark: Mark) {
		return span.addMarkToSlice(from, to, mark);
	}

	constructor(
		// Pointer to the document that contains this span.
		readonly doc: Doc,
		// Text stored in this span.
		public text: string,

		public marks?: Mark[] | Set<Mark>
	) {
		if (marks) {
			this.markSet = new Set(marks);
		}
	}

	insertTextAt(textToAdd: string, from: number, to = from): string {
		const before = this.text.substring(0, from);
		const after = this.text.slice(to);
		this.text = before + textToAdd + after;
		return this.text;
	}

	removeText(from: number, to: number): string {
		this.text = this.text.substring(0, from) + this.text.substring(to, this.text.length);
		return this.text;
	}

	toDOMNode() {
		let node: Node = new Text(this.text);
		for (const mark of this.markSet) {
			node = mark.render(node);
		}
		return node;
	}

	addMark(mark: Mark) {
		this.markSet.add(mark);
		return this;
	}

	private makeChild(from: number, to: number) {
		return new Span(this.doc, this.text.substring(from, to), this.markSet);
	}

	private addMarkToSlice(from: number, to: number, markToAdd?: Mark): Span[] {
		if (from === 0 && to === this.text.length) {
			if (markToAdd) this.addMark(markToAdd);
			return [this];
		}

		if (from === 0) {
			const children = [this.makeChild(from, to), this.makeChild(to, this.text.length)];
			if (markToAdd) children[0].addMark(markToAdd);
			return children;
		}

		if (to === this.text.length) {
			const children = [this.makeChild(0, from), this.makeChild(from, to)];
			if (markToAdd) children[1].addMark(markToAdd);
			return children;
		}

		const children = [
			this.makeChild(0, from),
			this.makeChild(from, to),
			this.makeChild(to, this.text.length),
		];
		if (markToAdd) children[1].addMark(markToAdd);
		return children;
	}

	toArray(): Pair<string, string[]> {
		const markStrs: string[] = [];
		this.markSet.forEach((mark) => {
			markStrs.push(mark.type);
		});
		return [this.text, markStrs];
	}
}

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
	spans: Span[] = [];

	// TODO: in the future, the Doc should be capable of constructing
	// itself givne an editor.
	constructor(private readonly rootElement: HTMLDivElement) {
		if (rootElement.childNodes.length === 0) {
			const textNode = new Text("");
			this.rootElement.appendChild(textNode);
		}
		const textNode = this.rootElement.childNodes[0];
		if (!(textNode instanceof Text && typeof textNode.textContent === "string"))
			throw new Error("Editor must be a div with only text inside it.");
		const firstSpan = new Span(this, textNode.textContent);
		this.spans.push(firstSpan);
	}

	/**
	 * Insert `text` in the current selection.
	 */
	insertTextAt(selection: Selection, text: string) {
		// TODO: handle right to left selections (?)
		// TODO: handle the case where the selection spans multiple nodes.
		if (selection.from.span !== selection.to.span) {
			throw new Error("Not implemented");
		}

		selection.from.span.insertTextAt(text, selection.from.index, selection.to.index);
	}

	/**
	 * Add `mark` to add spans that have some overlap with the current selection.
	 * @param selection Current selection.
	 * @param range The range of text selected (same as `selection.getRangeAt(0)`).
	 * @param mark The mark to add
	 */
	addMarkToRange({ from, to }: Selection, mark: Mark) {
		// TODO: handle right to left selections.
		let beginSpanIdx = this.spans.indexOf(from.span);
		let endSpanIdx = this.spans.indexOf(to.span);
		const fromIndex = from.index;
		const toIndex = to.index;

		if (beginSpanIdx === endSpanIdx) {
			// The entire selection is within a single span.
			const span = this.spans[beginSpanIdx];
			// the old span should be replaced by these new spans
			const newSpans = Span.addMarkToRange(span, fromIndex, toIndex, mark);
			this.replaceSpansWith(beginSpanIdx, beginSpanIdx + 1, newSpans);

			// TODO: The newly added span should stay selected. Currently,
			// we're resetting back to the beginning.
			return;
		}

		const firstSpan = this.spans[beginSpanIdx];
		const newFirstSpans = Span.addMarkToRange(firstSpan, fromIndex, firstSpan.text.length, mark);

		this.addMarkToSpansBetween(beginSpanIdx + 1, endSpanIdx, mark);

		const lastSpan = this.spans[endSpanIdx];
		const newLastSpans = Span.addMarkToRange(lastSpan, 0, toIndex, mark);

		// TODO: assert that the node mapped to `firstSpan` is indeed `selection.anchorNode`.

		this.spans = replaceArrayRange(this.spans, beginSpanIdx, beginSpanIdx + 1, newFirstSpans);
		// Once `firstSpan` has been replaced with `newFirstSpans`,
		// the array size will have grown by some number.
		// We need to account for this when replacing the last span,
		// since it has moved past `endSpanIdx` by now.
		const arrayLenDiff = newFirstSpans.length - 1;
		const newEndIdx = (endSpanIdx += arrayLenDiff);
		this.spans = replaceArrayRange(this.spans, newEndIdx, newEndIdx + 1, newLastSpans);
	}

	/**
	 * Add `mark` to all spans in `[from, to)`.
	 */
	private addMarkToSpansBetween(from: number, to: number, mark: Mark) {
		for (let i = from; i < to; ++i) {
			const span = this.spans[i];
			span.addMark(mark);
		}
	}

	/**
	 * Replace the spans in range [from, to), with `spans`.
	 */
	private replaceSpansWith(from: number, to: number, spans: Span[]) {
		this.spans = replaceArrayRange(this.spans, from, to, spans);
	}
}
