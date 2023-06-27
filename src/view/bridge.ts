import BiMap from "../bimap";
import Doc from "../model/document";
import Span from "../model/span";
import Mark from "../model/mark";
import type Editor from "./editor";
import { Pair, impossible } from "../utils";
import DocSelection from "../model/selection";
import { ReplaceSpanPayload } from "../model/event-emitter";
import { Event as DocumentEvent } from "../model/event-emitter";

const enum SelectionDir {
	leftToRight,
	rightToLeft,
}

class SelectionManager {
	constructor(private readonly doc: Doc, private readonly bridge: Bridge) {}

	get selectionInDOM(): Selection | null {
		return window.getSelection();
	}

	get currentRange(): Range | undefined {
		const sel = this.selectionInDOM;
		return sel?.getRangeAt(0);
	}

	private checkSelectionDir(sel: Selection): SelectionDir {
		const anchorNode = sel.anchorNode!;
		const focusNode = sel.focusNode!;

		const { anchorOffset, focusOffset } = sel;
		if (anchorNode === focusNode) {
			return focusOffset > anchorOffset ? SelectionDir.leftToRight : SelectionDir.rightToLeft;
		}

		const relativePos = anchorNode.compareDocumentPosition(focusNode);
		return relativePos === document.DOCUMENT_POSITION_PRECEDING
			? SelectionDir.rightToLeft
			: SelectionDir.leftToRight;
	}

	get selection(): DocSelection | null {
		const sel = this.selectionInDOM;
		const range = sel?.getRangeAt(0);
		if (!(sel && range)) return null;

		const dir = this.checkSelectionDir(sel);

		let startNode: Node, endNode: Node;
		let startOffset: number, endOffset: number;

		if (dir === SelectionDir.leftToRight) {
			startNode = sel.anchorNode!;
			endNode = sel.focusNode!;
			startOffset = sel.anchorOffset!;
			endOffset = sel.focusOffset!;
		} else {
			startNode = sel.focusNode!;
			endNode = sel.anchorNode!;
			startOffset = sel.focusOffset!;
			endOffset = sel.anchorOffset!;
		}

		const [beginSpanIdx, endSpanIdx] = this.bridge.spanRangeBetweenNodes(startNode, endNode);
		const beginSpan = this.doc.spans.at(beginSpanIdx);
		const endSpan = this.doc.spans.at(endSpanIdx);

		return new DocSelection(
			{ span: beginSpan, index: startOffset },
			{ span: endSpan, index: endOffset }
		);
	}
}

/**
 * A bridge connects the editor state to the editor view.
 */
export default class Bridge {
	// A bidirectional mapping between DOM Nodes and spans in the editor.
	private readonly spanOfDOMNode = new BiMap<Node, Span>();
	private readonly selectionManager: SelectionManager;
	private readonly document = new Doc;

	constructor(
		// The editor view.
		private readonly editor: Editor
	) {
		this.selectionManager = new SelectionManager(this.document, this);


		const rootElement = this.editor.div;

		if (rootElement.childNodes.length === 0) {
			const textNode = new Text("");
			rootElement.appendChild(textNode);
		}
		const textNode = rootElement.childNodes[0];
		if (!(textNode instanceof Text && typeof textNode.textContent === "string"))
			throw new Error("Editor must be a div with only text inside it.");
		const firstSpan = new Span(this.document, textNode.textContent);
		this.document.spans.insertAtEnd(firstSpan);
		this.spanOfDOMNode.set(this.editor.div.childNodes[0], this.document.spans.at(0));

		this.document.on(DocumentEvent.spanReplaced, this.syncDomWithReplacedSpans.bind(this));
		this.document.on(DocumentEvent.markAdded, this.syncDomWithUpdatedSpans.bind(this));
	}

	private syncDomWithReplacedSpans({ removed, added }: ReplaceSpanPayload) {
		// TODO: refactor
		if (removed.length === 0) impossible();
		const firstRemovedNode = removed[0];
		const firstDomNodeToRemove = this.spanOfDOMNode.getv(firstRemovedNode);
		if (!firstDomNodeToRemove) impossible();
		this.spanOfDOMNode.delete(firstDomNodeToRemove);
		const parent = firstDomNodeToRemove?.parentNode;
		if (!parent) impossible();
		const fragment = this.renderSpans(added);
		parent.replaceChild(fragment, firstDomNodeToRemove);
		for (let i = 1; i < removed.length; ++i) {
			const domNode = this.spanOfDOMNode.getv(removed[i]);
			if (!domNode) impossible();
			this.spanOfDOMNode.delete(domNode);
			domNode.parentNode?.removeChild(domNode);
		}
	}

	private syncDomWithUpdatedSpans([from, to]: [number, number]) {
		for (let i = from; i < to; ++i) {
			const span = this.document.spans.at(from);
			const oldDomNode = this.spanOfDOMNode.getv(span);
			const newDomNode = span.toDOMNode();
			oldDomNode?.parentNode?.replaceChild(newDomNode, oldDomNode);
			this.spanOfDOMNode.set(newDomNode, span);
		}
	}

	renderSpans(spans: Span[]): DocumentFragment {
		const fragment = document.createDocumentFragment();
		for (const span of spans) {
			const domNode = span.toDOMNode();
			this.spanOfDOMNode.set(domNode, span);
			fragment.appendChild(domNode);
		}
		return fragment;
	}

	render() {
		const domFragment = document.createDocumentFragment();
		this.document.spans.forEach((span) => {
			const domNode = span.toDOMNode();
			domFragment.appendChild(domNode);
			this.spanOfDOMNode.set(domNode, span);
		});
		this.editor.div.replaceChildren(domFragment);
	}

	addMarkToCurrentSelection(mark: Mark) {
		const selection = this.selectionManager.selection;
		if (!selection) impossible();
		this.document.addMarkToRange(selection, mark);
	}

	insertTextAtCurrentSelection(text: string) {
		const docSelection = this.selectionManager.selection;
		if (!docSelection) impossible();
		this.document.insertTextAt(docSelection, text);
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
	spanRangeBetweenNodes(beginNode: Node, endNode: Node): Pair<number> {
		const beginSpan = this.findEnclosingSpan(beginNode);
		const endSpan = this.findEnclosingSpan(endNode);
		const spanRange: Pair<number> = [
			this.document.spans.indexOf(beginSpan),
			this.document.spans.indexOf(endSpan),
		];
		if (spanRange[0] > spanRange[1] || spanRange[0] === -1 || spanRange[1] === -1) {
			impossible();
		}
		return spanRange;
	}
}
