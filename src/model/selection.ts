import type Span from "./span";

/**
 * A definite location inside the document.
 * It comprises of a span and a zero-indexed offset inside the span.
 */
export interface Coord {
	span: Span;
    // An index into the span's text (0-indexec).
	index: number;
}

export class Coord implements Coord {
	constructor(public span: Span, public index: number) {}
}

export default interface Selection {
	readonly from: Coord;
	readonly to: Coord;
}

/**
 * Represents a range of selected text in the Document.
 */
export default class Selection implements Selection {
	constructor(
		// start location
		public readonly from: Coord,
        // end location
		public readonly to: Coord
	) {}
}
