import BiMap from "../bimap";
import Doc from "../model/document";
import Span from "../model/span";
import Mark from "../model/mark";
import type Editor from "./editor";
import { Pair, impossible } from "../utils";
import DocSelection, { Coord } from "../model/selection";
import { ReplaceSpanPayload, Event as DocumentEvent } from "../model/event-emitter";

const enum SelectionDir {
  leftToRight,
  rightToLeft,
}

class SelectionManager {
  constructor(
    private readonly doc: Doc,
    private readonly bridge: Bridge,
    private readonly rootElement: HTMLDivElement
  ) {}

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

    if (sel.type === "Caret") {
      const anchorNode = sel.anchorNode!;

      let span: Span;
      if (anchorNode === this.rootElement) {
        span = this.doc.spans.at(0);
      } else {
        span = this.bridge.findEnclosingSpan(anchorNode);
      }

      const spanIdx = this.doc.spans.indexOf(span);
      return new DocSelection(
        new Coord(spanIdx, sel.anchorOffset),
        new Coord(spanIdx, sel.anchorOffset)
      );
    }

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

    if (sel.anchorNode === this.rootElement) {
      startNode = this.rootElement.firstChild!;
      endNode = this.rootElement.lastChild!;
      startOffset = 0;
      endOffset = endNode.textContent?.length ?? endOffset;
    }

    const [beginSpanIdx, endSpanIdx] = this.bridge.spanRangeBetweenNodes(startNode, endNode);

    return new DocSelection(
      { spanIndex: beginSpanIdx, offset: startOffset },
      { spanIndex: endSpanIdx, offset: endOffset }
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
  private readonly document = new Doc();
  private readonly rootElement: HTMLDivElement;

  constructor(
    // The editor view.
    private readonly editor: Editor
  ) {
    const rootElement = this.editor.div;
    this.rootElement = rootElement;
    this.selectionManager = new SelectionManager(this.document, this, rootElement);

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
    this.document.on(DocumentEvent.textChanged, this.onSpanUpdate.bind(this));
    this.document.on(DocumentEvent.spanAdded, this.onSpanAdd.bind(this));
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

  private onSpanUpdate(span: Span) {
    const domNode = this.spanOfDOMNode.getv(span);
    if (!domNode) impossible();
    domNode.textContent = span.text;
  }

  private onSpanAdd([span, index]: [Span, number]) {
    console.log(this.document.spans.map((sp) => sp.text));
    const domNode = span.toDOMNode();
    this.spanOfDOMNode.set(domNode, span);
    if (index === 0) {
      const { firstChild } = this.rootElement;
      if (firstChild) {
        this.rootElement.insertBefore(domNode, this.rootElement.firstChild);
      } else {
        this.rootElement.replaceChildren(domNode);
      }
    } else if (index === this.document.spans.length - 1) {
      this.rootElement.appendChild(domNode);
    } else {
      const prevSpan = this.document.spans.at(index + 1);
      const domNodeOfPrev = this.spanOfDOMNode.getv(prevSpan);
      if (!domNodeOfPrev) impossible();

      domNodeOfPrev.parentNode?.insertBefore(domNode, domNodeOfPrev);
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
    this.document.spans.updateSelection(selection);
    this.document.addMarkToSelection(selection, mark);
    this.syncSelection();
  }

  insertTextAtCurrentSelection(text: string) {
    const domSel = this.selectionManager.selectionInDOM;
    const docSelection = this.selectionManager.selection;
    if (!(domSel && docSelection)) impossible();
    this.document.spans.updateSelection(docSelection);
    this.document.insertTextAt(docSelection, text);
    this.syncSelection();
  }

  /**
   * Sync the DOM selection with the current selection in the document.
   */
  private syncSelection() {
    const docSel = this.document.spans.selection;
    const { from, to } = docSel;

    const fromSpan = this.document.spans.at(from.spanIndex);
    const toSpan = this.document.spans.at(to.spanIndex);

    let fromNode = this.spanOfDOMNode.getv(fromSpan);
    let toNode = this.spanOfDOMNode.getv(toSpan);
    if (!(toNode && fromNode)) impossible();

    toNode = Bridge.getInnerMostNode(toNode);
    fromNode = Bridge.getInnerMostNode(fromNode);

    const sel = window.getSelection();
    const range = sel?.getRangeAt(0);
    if (!(sel && range)) return;
    range.setStart(fromNode, from.offset);
    range.setEnd(toNode, to.offset);
    sel.removeAllRanges();
    sel.addRange(range);
  }

  /**
   * returns the innermost child of a DOM node.
   */
  private static getInnerMostNode(node: Node): Node {
    while (node.hasChildNodes()) {
      node = node.firstChild!;
    }
    return node;
  }

  /**
   * @returns The span that is mapped to [node].
   */
  findEnclosingSpan(node: Node): Span {
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
