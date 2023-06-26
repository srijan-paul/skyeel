import { identity } from "lodash";
import BiMap from "./bimap";

const enum Modifier {
	none = 0b0000,
	cmd = 0b1000,
	shift = 0b0100,
	alt = 0b0010,
}

type Pair<T1, T2 = T1> = [T1, T2];

class Input {
	static getModifierMaskFromEvent(event: KeyboardEvent): Modifier {
		let mod = Modifier.none;
		if (event.altKey) mod |= Modifier.alt;
		if (event.metaKey) mod |= Modifier.cmd;
		if (event.shiftKey) mod |= Modifier.shift;
		return mod;
	}

	static addHotkeyTo(
		node: Node,
		key: string,
		modifiers: Modifier,
		callback: (event: KeyboardEvent) => void
	) {
		node.addEventListener("keydown", (event) => {
			if (!(event instanceof KeyboardEvent && event.key === key)) return;
			const mods = Input.getModifierMaskFromEvent(event);
			if (mods & modifiers) {
				event.stopPropagation();
				event.preventDefault();
				callback(event);
			}
		});
	}
}

// A `document` represents the state of the editor
// in memory. It is a linear list of spans.
class Doc {
	spans: Span[] = [];

	private readonly spanOfDOMNode = new BiMap<Node, Span>();

	// TODO: in the future, the Doc should be capable of constructing
	// itself givne an editor.
	constructor(private readonly editor: Editor, private readonly rootElement: HTMLDivElement) {
		if (rootElement.childNodes.length === 0) {
			const textNode = new Text("");
			this.rootElement.appendChild(textNode);
		}
		const textNode = this.rootElement.childNodes[0];
		if (!(textNode instanceof Text && typeof textNode.textContent === "string"))
			throw new Error("Editor must be a div with only text inside it.");
		const firstSpan = new Span(this, textNode.textContent);
		this.spans.push(firstSpan);
		this.spanOfDOMNode.set(textNode, firstSpan);
	}

	// find the nearest span that contains [node]
	// inside itself.
	private findEnclosingSpan(node: Node): Span {
		let currentNode: Node | null = node;
		while (currentNode) {
			const span = this.spanOfDOMNode.get(currentNode);
			if (span) return span;
			currentNode = currentNode.parentNode;
		}
		throw new Error("Could not find enclosing span for DOM node");
	}

	// Insert `text` in `node` at the current caret/selection position.
	insertTextInNode(selection: Selection, text: string) {
		// TODO: handle right to left selections (?)
		const anchorNode = selection.anchorNode!;
		const { anchorOffset, focusOffset } = selection;

		const range = selection.getRangeAt(0);
		// TODO: handle the case where the selection spans multiple nodes.
		const span = this.findEnclosingSpan(anchorNode);
		span.insertTextAt(text, anchorOffset, focusOffset);
		anchorNode.textContent = span.text;
		this.restoreCaret(anchorNode, range, anchorOffset + 1);
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

	private spanRangeBetweenNodes(beginNode: Node, endNode: Node): Pair<number> {
		const beginSpan = this.findEnclosingSpan(beginNode);
		const endSpan = this.findEnclosingSpan(endNode);
		const spanRange: Pair<number> = [this.spans.indexOf(beginSpan), this.spans.indexOf(endSpan)];
		if (spanRange[0] > spanRange[1]) {
			throw new Error("Impossible");
		}
		return spanRange;
	}

	// Add [Mark] to all spans in [range].
	addMarkToRange(selection: Selection, range: Range, mark: Mark) {
		// TODO: handle right to left selections.
		const startNode = selection.anchorNode!;
		const endNode = selection.focusNode!;
		const from = selection.anchorOffset;
		const to = selection.focusOffset;

		// find the spans that overlap with the DOM nodes selected by the user.
		const [beginSpanIdx, endSpanIdx] = this.spanRangeBetweenNodes(startNode, endNode);

		if (beginSpanIdx === endSpanIdx) {
			// The entire selection is within a single span.
			const span = this.spans[beginSpanIdx];
			// the old spans should be replaced by these new spans
			const newSpans = Span.addMarkToRange(span, from, to, mark);
			const newDomFragment = this.replaceSpansWith(beginSpanIdx, endSpanIdx, newSpans);
			const firstChild = newDomFragment.children[0];
			startNode.parentNode?.replaceChild(newDomFragment, startNode);

			// TODO: select the whole new set of spans (correctly), instead of resetting back
			// to the beginning.
			this.restoreCaret(firstChild, range, 0);
		}

		for (let i = beginSpanIdx; i <= endSpanIdx; ++i) {
			const span = this.spans[i];
			if (i === beginSpanIdx) {
				// todo
			} else if (i === endSpanIdx) {
				// todo
			} else {
				span.addMark(mark);
				const newDomNode = span.toDOMNode();
				this.spanOfDOMNode.set(newDomNode, span);
			}
		}
	}

	// replace the spans in range [from, to], with [spans].
	replaceSpansWith(from: number, to: number, spans: Span[]): DocumentFragment {
		const before = this.spans.slice(0, from);
		const after = this.spans.slice(to);

		// TODO: free the old spans from the Map,
		// currently they're not being garbage collected even though they're not needed.
		this.spans = before.concat(spans, after);

		// sync the dom Nodes as well.
		const fragment = document.createDocumentFragment();
		for (const span of spans) {
			const newDomNode = span.toDOMNode();
			fragment.append(newDomNode);
			this.spanOfDOMNode.set(newDomNode, span);
		}
		return fragment;
	}
}

// A "Mark" represents some kind of formatting like: bold, italic, underline, etc.
class Mark {
	constructor(
		// "bold", "italic", "color", "underline", etc.
		readonly type: string,
		// "Render" the mark by mutating a DOM Node to appear different.
		readonly render: (node: Node) => Node = identity,
		// Any attributes like { color: "#ff0000" }.
		// It's `undefined` for simple marks like "bold".
		readonly attrs?: Record<string, any>
	) {}
}

const BoldMark = new Mark("bold", (node) => {
	const newNode = document.createElement("strong");
	newNode.appendChild(node);
	return newNode;
});

const ItalicMark = new Mark("italic", (node) => {
	const newNode = document.createElement("em");
	newNode.appendChild(node);
	return newNode;
});

/**
 * A `Span` represents a contiguous array of text in the document.
 */
class Span {
	// A set of marks, where each mark specifies what kind of formatting needs
	// to be applied to this span. E.g: [bold, italic]
	readonly markSet = new Set<Mark>();

	static addMarkToRange(span: Span, from: number, to: number, mark: Mark) {
		return span.addMarkToSlice(from, to, mark);
	}

	constructor(
		// Pointer to the document that contains this span.
		readonly doc: Doc,
		// Text stored in this span.
		public text: string
	) {}

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

	makeChild(from: number, to: number) {
		return new Span(this.doc, this.text.substring(from, to));
	}

	addMarkToSlice(from: number, to: number, markToAdd?: Mark): Span[] {
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
}

class Editor {
	// The headless state of this document.
	private readonly document: Doc;

	constructor(
		// The HTML div on which to mount the editor.
		private readonly div: HTMLDivElement
	) {
		const text = this.div.childNodes[0];
		this.document = new Doc(this, this.div);
		const span = new Span(this.document, text.nodeValue ?? "");
		this.document.spans.push(span);

		// After about ~2-3 days of struggling to find the right way to handle input while
		// keeping the View and State in sync, I've finally found the perfect event to listen to,
		// courtesy of this page: https://w3c.github.io/input-events/#event-type-beforeinput
		// When choosing which event to listen to, we have three choices:
		// 1. "keydown": This appears to be a decent choice at first, but we've to understand that key != character.
		//   It's up to the OS to determine which sequence of keys is mapped to what character in the user's keyboard
		//	 layout. Recreating that logic in the browser is super difficult. So while the user may press the physical key "A", the layout
		//   may cause the OS to interpret that as some non-english character.
		// 2. "input": Input events are fired when a `contenteditable` div receives input from the user. This is almost always preceded by a "keydown" event,
		//   since "input" is only fired once a "keydown" has executed its default action (which is to generate input).
		//   However, the "input" event is generated AFTER the DOM has been changed. Moreover, it is non-cancellable.
		//   So if the user selects a range of text, and then replaces that with the character "x" by pressing X on the keyboard,
		//   the input event will be fired *after* the selection has collapsed to a single character, and the original text is gone.
		//   This makes it much harder to figure out exactly which divs were affected by the input event (a selection can span multiple divs).
		// 3. "beforeinput": A "beforeinput" event is fired right after "keydown" (or "keypress"*), and right before "input".
		//   The default behavior of "beforeinput" is to 1) mutate the DOM, and 2) generate an "input" event.
		//   To our boon, this event is cancellable, so calling `event.preventDefault` will allow us to stop the DOM from mutating,
		//   update our state, and then artificially mutate the DOM again using our updated state. This way, the model and the view
		//   will be consistent.
		this.div.addEventListener("beforeinput", this.handleInput.bind(this));

		Input.addHotkeyTo(this.div, "b", Modifier.cmd, this.bold.bind(this));
		Input.addHotkeyTo(this.div, "i", Modifier.cmd, this.italic.bind(this));
	}

	private getSelectionAndRange(): [Selection, Range] {
		const selection = window.getSelection();
		if (!selection) throw new Error("Impossible");
		const range = selection.getRangeAt(0);
		return [selection, range];
	}

	private bold() {
		const [selection, range] = this.getSelectionAndRange();
		if (!(selection && range)) return;
		this.document.addMarkToRange(selection, range, BoldMark);
	}

	private italic() {
		const [selection, range] = this.getSelectionAndRange();
		if (!(selection && range)) return;
		this.document.addMarkToRange(selection, range, ItalicMark);
	}

	// When new text is inserted into (or removed from) the editor,
	// the state has to be updated so that its in sync with the DOM.
	private handleInput(event: Event) {
		if (!(event instanceof InputEvent)) return;
		const { data } = event;
		// TODO: handle each of these cases: https://rawgit.com/w3c/input-events/v1/index.html#interface-InputEvent-Attributes (OOF!)
		if (event.inputType === "insertText" && typeof data === "string") {
			this.insertTextAtSelection(data);
			event.preventDefault();
		} else {
			console.log(event.inputType, "is not supported yet.");
			event.preventDefault();
		}
	}

	private insertTextAtSelection(text: string) {
		const selection = window.getSelection();
		if (!selection) throw new Error("Impossible");
		this.document.insertTextInNode(selection, text);
	}
}

const alice = document.getElementById("alice");
if (alice instanceof HTMLDivElement) {
	new Editor(alice);
}

const bob = document.getElementById("bob");
if (bob instanceof HTMLDivElement) {
	new Editor(bob);
}
