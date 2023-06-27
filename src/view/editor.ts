import Doc from "../model/document";
import { BoldMark, ItalicMark, UnderlineMark } from "../model/mark";
import Bridge from "./bridge";

const enum Modifier {
	none = 0b0000,
	cmd = 0b1000,
	shift = 0b0100,
	alt = 0b0010,
}

/**
 * A helper class to add hotkeys with modifier keys.
 */
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

export default class Editor {
	private readonly bridge: Bridge;

	constructor(
		// The HTML div on which to mount the editor.
		readonly div: HTMLDivElement
	) {
		const doc = new Doc(this.div);
		this.bridge = new Bridge(doc, this);

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
		Input.addHotkeyTo(this.div, "u", Modifier.cmd, this.underline.bind(this));
	}

	private bold() {
		this.bridge.addMarkToCurrentSelection(BoldMark);
	}

	private italic() {
		this.bridge.addMarkToCurrentSelection(ItalicMark);
	}

	private underline() {
		this.bridge.addMarkToCurrentSelection(UnderlineMark);
	}

	/**
	 * Handle an input event by updating the Document in memory, then syncing it with the DOM.
	 * @param event A "beforeinput" event.
	 */
	private handleInput(event: Event) {
		if (!(event instanceof InputEvent)) return;
		const { data } = event;
		// TODO: handle each of these cases: https://rawgit.com/w3c/input-events/v1/index.html#interface-InputEvent-Attributes (OOF!)
		if (event.inputType === "insertText" && typeof data === "string") {
			this.insertTextAtSelection(data);
			event.preventDefault();
		} else {
			console.error(event.inputType, "is not supported yet.");
			event.preventDefault();
		}
	}

	private insertTextAtSelection(text: string) {
		this.bridge.insertTextAtCurrentSelection(text);
	}
}
