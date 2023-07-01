import type Mark from "./mark";
import type Doc from "./document";
import { replaceArrayRange, type Pair, getRelativePosOfRanges, RelativePos, notImplemented } from "../utils";
import { Emitter, Event as DocEvent } from "./event-emitter";
import Selection, { Coord } from "./selection";

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

    marks?: Mark[] | Set<Mark>
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
  removeText(from: number, to = this.text.length): string {
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
   * The currently active selection in the document.
   */
  private readonly currentSelection = new Selection(new Coord(0, 0), new Coord(0, 0));

  get selection(): Selection {
    return this.currentSelection;
  }

  public updateSelection(src: Selection) {
    const sel = this.currentSelection;
    sel.from.spanIndex = src.from.spanIndex;
    sel.to.spanIndex = src.to.spanIndex;
    sel.from.offset = src.from.offset;
    sel.to.offset = src.to.offset;
  }

  /**
   * @returns the text at current selection.
   */
  public getSelectedText(): string {
    const { from, to } = this.selection;
    const firstSpan = this.spans[from.spanIndex];
    const lastSpan = this.spans[to.spanIndex];

    if (firstSpan === lastSpan) {
      return firstSpan.text.substring(from.offset, to.offset);
    }

    let text = firstSpan.text.slice(from.offset);
    for (let i = from.spanIndex + 1; i < to.spanIndex; ++i) {
      text += this.spans[i].text;
    }
    text += lastSpan.text.substring(0, to.offset);
    return text;
  }

  /**
   * @returns The span at index `index`.
   */
  public at(index: number): Span {
    return this.spans[index];
  }

  /**
   * @returns the number of spans in this list.
   */
  get length(): number {
    return this.spans.length;
  }

  /**
   * @returns The `index` of `span`.
   */
  public indexOf(span: Span) {
    return this.spans.indexOf(span);
  }

  /**
   * proxy for `Array.prototype.forEach` on the list of spans.
   */
  public forEach(fn: (span: Span, index: number) => void) {
    this.spans.forEach(fn);
  }

  /**
   * proxy for `Array.prototype.map` on the list of spans.
   */
  public map<T>(fn: (span: Span, index: number) => T): T[] {
    return this.spans.map(fn);
  }

  /**
   * Update the current selection when text is inserted into a span.
   */
  private adjustSelectionForTextInsertion(
    spanIndex: number,
    text: string,
    insertFrom: number,
    insertTo: number
  ) {
    const sel = this.currentSelection;
    const delta = text.length - (insertTo - insertFrom);

    const { from, to } = sel;

    if (Selection.isCaret(sel)) {
      if (spanIndex === from.spanIndex && insertFrom <= from.offset) {
        from.offset += delta;
        to.offset += delta;
      }
      return;
    }

    if (spanIndex === from.spanIndex && spanIndex === to.spanIndex) {
      const pos = getRelativePosOfRanges(insertFrom, insertTo, sel.from.offset, sel.to.offset);
      switch (pos) {
        case RelativePos.left: {
          from.offset += delta;
          to.offset += delta;
          return;
        }

        case RelativePos.leftOverlap: {
          sel.from.offset = insertTo + delta;
          sel.to.offset += delta;
          return;
        }

        case RelativePos.rightOverlap: {
          sel.to.offset = insertFrom;
          return;
        }

        case RelativePos.equal:
        case RelativePos.surround: {
          sel.from.offset = insertFrom;
          sel.to.offset = insertFrom;
          return;
        }

        case RelativePos.inside: {
          sel.to.offset += delta;
          return;
        }

        case RelativePos.right: {
          // There is no reason to alter anything when
          // the insertion range is completely to the right.
          return;
        }
      }
    }

    if (spanIndex === from.spanIndex && insertFrom > from.offset && insertFrom < to.offset) {
      sel.to.offset = insertFrom;
    }

    // TODO: fix this
    if (spanIndex === to.spanIndex && insertTo > from.offset && insertTo < to.offset) {
      sel.from.offset = insertTo + delta;
    }
  }

  /**
   * Insert text inside a span at a specific index.
   * @param spanIndex Index of the span to update
   * @param text The text to add.
   * @param from start index of the substring to replace
   * @param to end index of the substring to replace (equal to `from` by default);
   */
  public insertTextInSpanAt(spanIndex: number, text: string, from: number, to = from) {
    const span = this.spans[spanIndex];
    span.insertTextAt(text, from, to);
    this.adjustSelectionForTextInsertion(spanIndex, text, from, to);
    this.emitter.emit(DocEvent.textChanged, span);
  }

  public removeTextInSpanAt(spanIndex: number, from: number, to?: number) {
    const span = this.spans[spanIndex];
    span.removeText(from, to);
    this.emitter.emit(DocEvent.textChanged, span);
  }

  /**
   * Add `mark` to all spans in range `[from, to)`.
   * `to` is `from + 1` by default.
   */
  public addMarkToSpansBetween(mark: Mark, from: number, to: number = from + 1) {
    for (let i = from; i < to; ++i) {
      this.spans[i].addMark(mark);
    }
    this.emitter.emit(DocEvent.markAdded, [from, to]);
  }

  /**
   * Update the selection when a span is split it into multiple other spans.
   * This is most likely the result of a mark being added to some part of the span.
   * @param index position of the span that was split.
   * @param children A list of child spans that were spawned as a result of the split.
   */
  private updateSelectionForSpanSplit(index: number, children: Span[]) {
    if (children.length === 1 && children[0].text.length === this.spans[index].text.length) return;

    // TODO: this function works very well (according to my test suite), but is very messy.
    // This needs to be refactored.

    const sel = this.currentSelection;
    const delta = children.length - 1;
    if (sel.from.spanIndex > index) {
      // Selection begins after the span that was just split.
      sel.from.spanIndex += delta;
      sel.to.spanIndex += delta;
      return;
    }

    if (sel.from.spanIndex < index) {
      if (sel.to.spanIndex < index) {
        return;
      }

      if (sel.to.spanIndex > index) {
        // The span that was split is inside the selected span range.
        // The end span index merely needs to shift to the right.
        sel.to.spanIndex += delta;
        return;
      }

      // The end of the selection has some overlap with the span that was split.
      //   Old selection (Span 0, char 1 -> Span 1, char 7)
      //   ┌──────────┐
      //   │          │
      // ┌─▼─┬────────▼─┬───┐
      // │The│quickbrown│fox│
      // └───┴──────────┴───┘
      //   New selection (Span 0, char 1 -> Span 2, char 3)
      //   ┌───────────┐
      //   │           │
      // ┌─▼─┬─────┬───▼──┬───┐
      // │The│quick│brown │fox│
      // └───┴─────┴──────┴───┘
      // Selection begins before the span that was just split, and ends
      // somwhere inside it.
      // The begin pointer does not need to change,
      // but the end pointer needs to be adjusted.

      let cumTextLength = 0;
      for (let i = 0; i < children.length; ++i) {
        const textlen = children[i].text.length;
        if (cumTextLength + textlen >= sel.to.offset) {
          sel.to.offset -= cumTextLength;
          sel.to.spanIndex += i;
          break;
        }
        cumTextLength += textlen;
      }

      return;
    }

    // from.spanIndex == spanIndex.

    let fromAdjusted = false,
      toAdjusted = false;

    if (sel.to.spanIndex > index) {
      sel.to.spanIndex += delta;
      toAdjusted = true;
    }

    // selection is entirely within the span that is being split.
    // => sel.from.spanIndex == sel.to.spanIndex == index

    let cumTextLen = 0;
    for (let i = 0; i < children.length; ++i) {
      const textlen = children[i].text.length;
      if (!fromAdjusted && cumTextLen + textlen > sel.from.offset) {
        sel.from.offset -= cumTextLen;
        sel.from.spanIndex += i;
        fromAdjusted = true;
      }

      if (!toAdjusted && cumTextLen + textlen >= sel.to.offset) {
        sel.to.offset -= cumTextLen;
        sel.to.spanIndex += i;
        toAdjusted = true;
        break;
      }

      cumTextLen += textlen;
    }
  }

  /**
   * Take the span at `index`, and add `mark` to a sub-string of this mark between `[from, to)`.
   * Doing so might cause the span to be split into multiple spans.
   */
  public addMarkInsideSpanAt(
    index: number,
    mark: Mark,
    from: number,
    to: number = this.spans[index].text.length
  ): Span[] {
    const span = this.spans[index];
    if (from === 0 && to === span.text.length) {
      // range covers the entire contents of the span
      span.addMark(mark);
      this.emitter.emit(DocEvent.markAdded, [index, index + 1]);
      return [span];
    }

    // split the span into child nodes.
    const newChildren = Span.addMarkToRange(span, from, to, mark);
    this.updateSelectionForSpanSplit(index, newChildren);
    this.replaceSpansBetween(index, index + 1, newChildren);
    return newChildren;
  }

  /**
   * Replaces the spans in range `[from, to)` with `spans`.
   */
  public replaceSpansBetween(from: number, to: number, spans: Span[]) {
    if (from > to) return;
    const removed = this.spans.slice(from, to);
    this.spans = replaceArrayRange(this.spans, from, to, spans);
    this.emitter.emit(DocEvent.spanReplaced, { removed, added: spans });
  }

  public insertAt(index: number, span: Span) {
    const before = this.spans.slice(0, index);
    before.push(span);
    const after = this.spans.slice(index);
    this.spans = before.concat(after);
    this.emitter.emit(DocEvent.spanAdded, [span, index]);
  }

  /**
   * Insert a new span at the end.
   */
  public insertAtEnd(span: Span): number {
    const index = this.spans.push(span);
    this.emitter.emit(DocEvent.spanAdded, [span, index]);
    return index;
  }

  /**
   * Register a listener for a specific event type.
   * The listener will be called every time the event is fired.
   */
  readonly on = this.emitter.on.bind(this.emitter);
}
