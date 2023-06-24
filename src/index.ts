const enum Modifier {
	none = 0b0000,
	cmd = 0b1000,
	shift = 0b0100,
	alt = 0b0010,
}

function isAlphaNumeric(char: string) {
	if (char.length > 2) return false;
	const code = char.codePointAt(0);
}

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

	constructor(private readonly editor: Editor) {}

	findEnclosingSpan(node: Node) {
		// TODO
	}
}

// A "Mark" represents some kind of formatting like: bold, italic, underline, etc.
interface Mark {
	// "bold", "italic", "color", "underline", etc.
	type: string;
	// Any attributes like { color: "#ff0000" }.
	// It's `undefined` for simple marks like "bold".
	attrs?: Record<string, any>;
}

/**
 * A `Span` represents a contiguous array of text in the document.
 */
class Span {
	// A set of marks, where each mark specifies what kind of formatting needs
	// to be applied to this span. E.g: [bold, italic]
	readonly markSet: Mark[] = [];

	constructor(
		// Pointer to the document that contains this span.
		readonly doc: Doc,
		// Text stored in this span.
		public text: string
	) {}

	insertTextAt(offset: number, textToAdd: string): string {
		const after = this.text.slice(offset);
		const before = this.text.substring(0, offset);
		this.text = before + textToAdd + after;
		return this.text;
	}

	removeText(from: number, to: number): string {
		this.text = this.text.substring(0, from) + this.text.substring(to, this.text.length);
		return this.text;
	}

	toDOMNode() {
		return new Text(this.text);
	}
}

class Editor {
	private readonly mutationObserver = new MutationObserver(this.onMutate.bind(this));

	// Maps a DOM Node to its corresponding span in the Document state.
	private readonly spanOfDomNode = new Map<Node, Span>();

	// The headless state of this document.
	private readonly document: Doc;

	constructor(
		// The HTML div on which to mount the editor.
		private readonly div: HTMLDivElement
	) {
		this.mutationObserver.observe(this.div, {
			characterData: true,
			subtree: true,
		});

		const text = this.div.childNodes[0];
		this.document = new Doc(this);
		const span = new Span(this.document, text.nodeValue ?? "");
		this.document.spans.push(span);
		this.spanOfDomNode.set(text, span);

		Input.addHotkeyTo(this.div, "b", Modifier.cmd, this.bold.bind(this));

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
	}

	// When new text is inserted into (or removed from) the editor,
	// the state has to be updated so that its in sync with the DOM.
	private handleInput(event: Event) {
		if (!(event instanceof InputEvent && typeof event.data === "string")) return;
		const { data } = event;
		if (event.inputType === "insertText") {
			this.insertTextAtSelection(data);
			event.preventDefault();
		}
	}

	private insertTextAtSelection(text: string) {
		const selection = window.getSelection();
		if (!selection) return;

		// TODO: handle multiple ranges? (firefox allows users to have multiple selections)
		const range = selection.getRangeAt(0);

		if (range.startOffset === range.endOffset) {
			const cursorPos = range.startOffset;
			const target = range.startContainer;
			const span = this.findEnclosingSpan(target);
			span.insertTextAt(cursorPos, text);
			console.log(span.text);
		} else {
			console.log("wtrf");
		}
	}

	/**
	 * @param node A DOM Node inside the editor.
	 * @returns The nearest enclosing `Span` surrounding that DOM node.
	 */
	private findEnclosingSpan(node: Node) {
		let currentNode: Node | null = node;
		while (currentNode instanceof Node) {
			const span = this.spanOfDomNode.get(node);
			if (span) return span;
			currentNode = currentNode.parentNode;
		}
		throw new Error("Could not find an enclosing span for node: " + node);
	}

	private onMutate(mutations: MutationRecord[]) {
		for (const mutation of mutations) {
			// do I really need a mutation observer now?
		}
	}

	private bold() {
		const range = window.getSelection()?.getRangeAt(0);
		console.log(range);
		// nothing was selected. Nothing to bold.
		if (!range) return;
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
