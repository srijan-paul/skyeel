import BiMap from "../bimap";
import Doc, { Span } from "../model/document";
import Mark from "../model/mark";
import type Editor from "./editor";
import { Pair, impossible } from "../utils";
import DocSelection from "../model/selection";

/**
 * A bridge connects the editor state to the editor view.
 */
export default class Bridge {
	// A bidirectional mapping between DOM Nodes and spans in the editor.
	private readonly spanOfDOMNode = new BiMap<Node, Span>();

	constructor(
		// The headless state of the document.
		private readonly document: Doc,
		// The editor view.
		private readonly editor: Editor
	) {
		this.spanOfDOMNode.set(this.editor.div.childNodes[0], document.spans[0]);
		console.log(this.spanOfDOMNode);
	}

	render() {
		const domFragment = document.createDocumentFragment();
		for (const span of this.document.spans) {
			const domNode = span.toDOMNode();
			domFragment.appendChild(domNode);
			this.spanOfDOMNode.set(domNode, span);
		}
		this.editor.div.replaceChildren(domFragment);
	}

	/**
	 * Convert a A DOM selection object to the corresponding selection in the document.
	 */
	docSelection(sel: Selection): DocSelection {
		const anchorNode = sel.anchorNode!;
		const focusNode = sel.focusNode!;
		const { anchorOffset, focusOffset } = sel;

		const [beginSpanIdx, endSpanIdx] = this.spanRangeBetweenNodes(anchorNode, focusNode);
		const beginSpan = this.document.spans[beginSpanIdx];
		const endSpan = this.document.spans[endSpanIdx];
		return new DocSelection(
			{ span: beginSpan, index: anchorOffset },
			{ span: endSpan, index: focusOffset }
		);
	}

	addMarkToCurrentSelection(mark: Mark) {
		const domSel = window.getSelection();
		if (!domSel) impossible();
		const docSelection = this.docSelection(domSel);

		this.document.addMarkToRange(docSelection, mark);
		console.log(this.document.spans.map(sp => sp.toArray()));
		this.render();
	}

	// After a DOM node's `textContent` property is updated, the caret
	// will jump back to the beginning of the surrounding `contenteditable` div.
	// We need to bring it back to the position where the edit happened.
	private restoreCaret(node: Node, originalRange: Range, offset: number) {
		originalRange.setStart(node, offset);
		originalRange.setEnd(node, offset);
		const selection = window.getSelection();
		if (!selection) return;
		selection.removeAllRanges();
		selection.addRange(originalRange);
	}

	/**
	 * @returns The span that is mapped to [node].
	 */
	private findEnclosingSpan(node: Node): Span {
		let currentNode: Node | null = node;
		while (currentNode) {
			const span = this.spanOfDOMNode.get(currentNode);
			if (span) return span;
			currentNode = currentNode.parentNode;
		}
		throw new Error("Could not find enclosing span for DOM node");
	}

	/**
	 * @returns a list of all spans that lie between `beginNode` and `endNode` (both inclusive).
	 */
	private spanRangeBetweenNodes(beginNode: Node, endNode: Node): Pair<number> {
		const beginSpan = this.findEnclosingSpan(beginNode);
		const endSpan = this.findEnclosingSpan(endNode);
		const spanRange: Pair<number> = [
			this.document.spans.indexOf(beginSpan),
			this.document.spans.indexOf(endSpan),
		];
		if (spanRange[0] > spanRange[1]) {
			throw new Error("Impossible");
		}
		return spanRange;
	}

	/**
	 * Given a list of spans, return a DOM Fragment that contains a list of DOM nodes
	 * where the ith node corresponds to the ith span in `spans`.
	 * @param spans The list of spans to generate DOM nodes from
	 * @returns A `DocumentFragment` object containing `N` nodes, where `N == spans.length`
	 */
	private getDOMFragmentFromSpans(spans: Span[]): DocumentFragment {
		const fragment = document.createDocumentFragment();
		for (const span of spans) {
			const newDomNode = span.toDOMNode();
			fragment.append(newDomNode);
		}
		return fragment;
	}
}
