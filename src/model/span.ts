import type Mark from "./mark";
import type Doc from "./document";
import { replaceArrayRange, type Pair } from "../utils";
import { Emitter, Event as DocEvent } from "./event-emitter";

/**
 * A `Span` represents a contiguous array of text in the document.
 */
export default class Span {
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

	/**
	 * replace the substring in range `[from, to)` with `textToAdd`.
	 */
	insertTextAt(textToAdd: string, from: number, to = from): string {
		const before = this.text.substring(0, from);
		const after = this.text.slice(to);
		this.text = before + textToAdd + after;
		return this.text;
	}


	/**
	 * removes the text in range `[from, to)` inside the span.
	 */
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

	/**
	 * Adds `mark` to the markset in this entire span.
	 */
	addMark(mark: Mark) {
		this.markSet.add(mark);
		return this;
	}

	/**
	 * @returns A new span whose text is a subtring of the parent span's text between `[from, to)`.
	 * The child span will contain all the same marks from its parent.
	 */
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
 * A wrapper around an array of spans.
 * This ensures that the right events are emitted after every operation
 * on the array.
 */
export class SpanList {
	private spans: Span[] = [];
	private readonly emitter = new Emitter();

	/**
	 * @returns The span at index `index`.
	 */
	at(index: number): Span {
		return this.spans[index];
	}

	/**
	 * @returns The `index` of `span`.
	 */
	indexOf(span: Span) {
		return this.spans.indexOf(span);
	}

	/**
	 * proxy for `Array.prototype.forEach` on the list of spans.
	 */
	forEach(fn: (span: Span, index: number) => void) {
		this.spans.forEach(fn);
	}

	/**
	 * proxy for `Array.prototype.map` on the list of spans.
	 */
	map<T>(fn: (span: Span, index: number) => T): T[] {
		return this.spans.map(fn);
	}

	/**
	 * Add `mark` to all spans in range `[from, to)`.
	 * `to` is `from + 1` by default.
	 */
	addMarkToAllSpansBetween(mark: Mark, from: number, to: number = from + 1) {
		for (let i = from; i < to; ++i) {
			this.spans[i].addMark(mark);
		}
		this.emitter.emit(DocEvent.markAdded, [from, to]);
	}

	/**
	 * Take the span at `index`, and add `mark` to a sub-string of this mark between `[from, to)`.
	 * Doing so might cause the span to be split into multiple spans.
	 */
	addMarkInsideSpanAt(
		index: number,
		mark: Mark,
		from: number,
		to: number = this.spans[index].text.length
	): Span[] {
		const span = this.spans[index];
		// split the span into child nodes.
		const newChildren = Span.addMarkToRange(span, from, to, mark);
		this.replaceSpansBetween(index, index + 1, newChildren);
		return newChildren;
	}

	/**
	 * Replaces the spans in range `[from, to)` with `spans`.
	 */
	replaceSpansBetween(from: number, to: number, spans: Span[]) {
		const removed = this.spans.slice(from, to);
		this.spans = replaceArrayRange(this.spans, from, to, spans);
		this.emitter.emit(DocEvent.spanReplaced, { removed, added: spans });
	}

	/**
	 * Insert a new span at the end.
	 */
	insertAtEnd(span: Span): number {
		const index = this.spans.push(span);
		this.emitter.emit(DocEvent.spanAdded, span);
		return index;
	}

	/**
	 * Register a listener for a specific event type.
	 * The listener will be called every time the event is fired.
	 */
	on = this.emitter.on.bind(this.emitter);
}
