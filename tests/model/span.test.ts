import Span, { SpanList } from "../../src/model/span";
import Doc from "../../src/model/document";
import { BoldMark, ItalicMark, UnderlineMark } from "../../src/model/mark";
import { Event } from "../../src/model/event-emitter";
import Selection, { Coord } from "../../src/model/selection";

/**
 * convert a list of strings to a list of spans.
 */
function toSpans(strs: string[], doc: Doc): Span[] {
  return strs.map((str) => new Span(doc, str));
}

describe("Span", () => {
  const doc = new Doc();

  describe("Span.addMarkToRange", () => {
    const span = new Span(doc, "hello, world!");
    it("functions correctly when the range is inside the span", () => {
      const children = Span.addMarkToRange(span, 1, 4, BoldMark);
      expect(children.length).toStrictEqual(3);
      expect(children.map((sp) => sp.text)).toStrictEqual(["h", "ell", "o, world!"]);
      expect(children.map((ch) => Array.from(ch.markSet))).toStrictEqual([[], [BoldMark], []]);
    });

    it("functions correctly when the range starts from 0, or end of text", () => {
      const children = Span.addMarkToRange(span, 0, 4, BoldMark);
      expect(children.length).toStrictEqual(2);
      expect(children.map((sp) => sp.text)).toStrictEqual(["hell", "o, world!"]);
      expect(children.map((ch) => Array.from(ch.markSet))).toStrictEqual([[BoldMark], []]);
    });

    it("functions correctly when the range covers the entire span", () => {
      const children = Span.addMarkToRange(span, 0, span.text.length, BoldMark);
      expect(children.length).toStrictEqual(1);
      expect(children.map((sp) => sp.text)).toStrictEqual(["hello, world!"]);
      expect(children.map((ch) => Array.from(ch.markSet))).toStrictEqual([[BoldMark]]);
    });
  });

  describe("Span#insertTextAt", () => {
    it("works correctly", () => {
      const span = new Span(doc, "hello, world!");
      span.insertTextAt("x", 1);
      expect(span.text).toStrictEqual("hxello, world!");
    });

    it("works when position is 0 or end of span", () => {
      const span = new Span(doc, "hello, world!");
      span.insertTextAt("h", 0);
      span.insertTextAt("!", span.text.length);
      expect(span.text).toStrictEqual("hhello, world!!");
    });

    it("works when position is a range", () => {
      const span = new Span(doc, "< hello, world! >");
      span.insertTextAt("bye", 2, 7);
      expect(span.text).toStrictEqual("< bye, world! >");
    });

    it("works when position is the entire span", () => {
      const span = new Span(doc, "hello");
      span.insertTextAt("bye", 0, 5);
      expect(span.text).toStrictEqual("bye");
    });

    it("works when the span is empty", () => {
      const span = new Span(doc, "");
      span.insertTextAt("hello, world!", 0);
      expect(span.text).toStrictEqual("hello, world!");
    });
  });

  describe("Span#removeText", () => {
    it("works as intended", () => {
      const span = new Span(doc, "hello, world!");
      span.removeText(5, 7);
      expect(span.text).toBe("helloworld!");
    });

    it("works for a single character", () => {
      const span = new Span(doc, "hello, world!");
      span.removeText(5, 6);
      expect(span.text).toBe("hello world!");
    });

    it("works for beginning and end", () => {
      const span = new Span(doc, "hello, world!");
      span.removeText(0, 2);
      span.removeText(3, span.text.length);
      expect(span.text).toBe("llo");
    });

    it("works for the entire span", () => {
      const span = new Span(doc, "hello, world!");
      span.removeText(0, span.text.length);
      expect(span.text).toBe("");
    });
  });

  describe("Span#addMark", () => {
    it("works as intended", () => {
      const span = new Span(doc, "hello");
      span.addMark(BoldMark);
      expect(span.markSet.has(BoldMark)).toBe(true);
    });
  });

  describe("Span#addMark", () => {
    it("works as intended", () => {
      const span = new Span(doc, "hello");
      span.addMark(BoldMark);
      expect(span.toArray()).toStrictEqual([span.text, ["bold"]]);
    });
  });
});

describe("SpanList", () => {
  const doc = new Doc();
  const str = "The quick brown fox jumped over the lazy dog";
  const spList = new SpanList();
  str.split(" ").forEach((txt) => spList.insertAtEnd(new Span(doc, txt)));
  it("SpanList#at", () => {
    expect(spList.at(0).text).toBe("The");
    expect(spList.at(spList.length - 1).text).toBe("dog");
  });

  it("SpanList#indexOf", () => {
    expect(spList.indexOf(spList.at(4))).toBe(4);
  });

  it("SpanList#indexOf", () => {
    let text = "";
    spList.forEach((span) => (text += span.text));
    expect(text).toBe("Thequickbrownfoxjumpedoverthelazydog");
  });

  it("SpanList#indexOf", () => {
    const words = spList.map((span) => span.text);
    expect(words).toStrictEqual(str.split(" "));
  });

  const eventCountMap = {
    [Event.markAdded]: 0,
    [Event.spanAdded]: 0,
    [Event.spanRemoved]: 0,
    [Event.spanReplaced]: 0,
    [Event.textChanged]: 0,
  };

  spList.on(Event.markAdded, () => {
    eventCountMap[Event.markAdded] += 1;
  });

  spList.on(Event.spanReplaced, () => {
    eventCountMap[Event.spanReplaced] += 1;
  });

  it("SpanList#addMarkToAllSpansBetween", () => {
    spList.addMarkToSpansBetween(BoldMark, 1, 3);
    spList.forEach((sp, i) => {
      const hasBold = sp.markSet.has(BoldMark);
      if (i >= 1 && i < 3) expect(hasBold).toBeTruthy();
      else expect(hasBold).toBeFalsy();
    });
    expect(eventCountMap[Event.markAdded]).toBe(1);
  });

  it("SpanList#addMarkInsideSpanAt", () => {
    spList.addMarkInsideSpanAt(4, BoldMark, 1, 4);
    const boldIndices = [1, 2, 5];
    spList.forEach((sp, i) => {
      const hasBold = sp.markSet.has(BoldMark);
      if (boldIndices.includes(i)) expect(hasBold).toBeTruthy();
      else expect(hasBold).toBeFalsy();
    });

    expect(spList.map((sp) => sp.text)).toStrictEqual(
      "The quick brown fox j ump ed over the lazy dog".split(" ")
    );

    expect(eventCountMap[Event.spanReplaced]).toBe(1);
  });

  it("SpanList#replaceSpansBetween", () => {
    spList.replaceSpansBetween(1, 4, [new Span(doc, "cat")]);
    expect(spList.map((sp) => sp.text)).toStrictEqual(
      "The cat j ump ed over the lazy dog".split(" ")
    );
  });

  describe("SpanList#addMarkInsideSpanAt", () => {
    it("updates the selection correctly when selection is overlapping with the span being split", () => {
      const spanList = new SpanList();
      toSpans(["The", "quickbrown", "fox"], doc).forEach((sp) => spanList.insertAtEnd(sp));

      spanList.updateSelection({
        from: { spanIndex: 0, offset: 1 },
        to: { spanIndex: 1, offset: 10 },
      });

      expect(spanList.getSelectedText()).toStrictEqual("hequickbrown");

      spanList.addMarkInsideSpanAt(1, BoldMark, 0, 5);
      expect(spanList.selection).toStrictEqual(new Selection(new Coord(0, 1), new Coord(2, 5)));

      expect(spanList.getSelectedText()).toStrictEqual("hequickbrown");
      expect(spanList.map((sp) => sp.text)).toStrictEqual(["The", "quick", "brown", "fox"]);

      spanList.addMarkInsideSpanAt(1, ItalicMark, 0, 3);
      expect(spanList.map((sp) => sp.text)).toStrictEqual(["The", "qui", "ck", "brown", "fox"]);
      expect(spanList.selection).toStrictEqual(new Selection(new Coord(0, 1), new Coord(3, 5)));
      expect(spanList.getSelectedText()).toStrictEqual("hequickbrown");

      spanList.addMarkInsideSpanAt(3, UnderlineMark, 1, 4);
      expect(spanList.map((sp) => sp.text)).toStrictEqual([
        "The",
        "qui",
        "ck",
        "b",
        "row",
        "n",
        "fox",
      ]);
      expect(spanList.getSelectedText()).toStrictEqual("hequickbrown");
    });

    it("works when the selection is *inside* the span being split", () => {
      const spanList = new SpanList();
      toSpans(["The fox jumped"], doc).forEach((sp) => spanList.insertAtEnd(sp));

      spanList.updateSelection({
        from: { spanIndex: 0, offset: 4 },
        to: { spanIndex: 0, offset: 7 },
      });

      expect(spanList.getSelectedText()).toStrictEqual("fox");

      spanList.addMarkInsideSpanAt(0, BoldMark, 5, 9);
      expect(spanList.map((sp) => sp.text)).toStrictEqual(["The f", "ox j", "umped"]);
      expect(spanList.getSelectedText()).toStrictEqual("fox");

      expect(spanList.selection).toStrictEqual(new Selection(new Coord(0, 4), new Coord(1, 2)));
    });

    it("works when the selection is *equal to* one of the child spans", () => {
      const spanList = new SpanList();
      toSpans(["The fox jumped"], doc).forEach((sp) => spanList.insertAtEnd(sp));

      spanList.updateSelection({
        from: { spanIndex: 0, offset: 4 },
        to: { spanIndex: 0, offset: 7 },
      });

      expect(spanList.getSelectedText()).toStrictEqual("fox");

      spanList.addMarkInsideSpanAt(0, BoldMark, 4, 7);
      expect(spanList.map((sp) => sp.text)).toStrictEqual(["The ", "fox", " jumped"]);
      expect(spanList.getSelectedText()).toStrictEqual("fox");
      expect(spanList.selection).toStrictEqual(new Selection(new Coord(1, 0), new Coord(1, 3)));
    });

    it("works when a mark is added to multiple spans.", () => {
      const spanList = new SpanList();

      // The fox jumped -> The fox **jumped**.
      toSpans(["The fox jumped"], doc).forEach((sp) => spanList.insertAtEnd(sp));

      spanList.updateSelection({
        from: { spanIndex: 0, offset: 8 },
        to: { spanIndex: 0, offset: 14 },
      });

      expect(spanList.getSelectedText()).toStrictEqual("jumped");

      spanList.addMarkInsideSpanAt(0, BoldMark, 8, 14);
      expect(spanList.map((sp) => sp.text)).toStrictEqual(["The fox ", "jumped"]);
      expect(spanList.getSelectedText()).toStrictEqual("jumped");
      expect(spanList.selection).toStrictEqual(new Selection(new Coord(1, 0), new Coord(1, 6)));

      // The fox jumped -> The fox **jumped**.
      spanList.updateSelection({
        from: { spanIndex: 0, offset: 4 },
        to: { spanIndex: 1, offset: 4 },
      });

      expect(spanList.getSelectedText()).toStrictEqual("fox jump");
      spanList.addMarkInsideSpanAt(0, ItalicMark, 4, 8);
      expect(spanList.map((sp) => sp.text)).toStrictEqual(["The ", "fox ", "jumped"]);
      expect(spanList.selection.from).toStrictEqual(new Coord(1, 0));
      expect(spanList.selection.to).toStrictEqual(new Coord(2, 4));
      expect(spanList.getSelectedText()).toStrictEqual("fox jump");

      spanList.addMarkInsideSpanAt(2, ItalicMark, 0, 4);
      expect(spanList.map((sp) => sp.text)).toStrictEqual(["The ", "fox ", "jump", "ed"]);
      expect(spanList.selection.from).toStrictEqual(new Coord(1, 0));
      expect(spanList.selection.to).toStrictEqual(new Coord(2, 4));
    });
  });

  describe("SpanList#adjustSelectionForTextInsertion", () => {
    it("works for single character insertions inside a span", () => {
      const spList = new SpanList();
      spList.insertAtEnd(new Span(doc, "The fox jumped"));
      spList.updateSelection({
        from: { spanIndex: 0, offset: 4 },
        to: { spanIndex: 0, offset: 4 },
      });
      spList.insertTextInSpanAt(0, "f", 4);
      expect(spList.getSelectedText()).toStrictEqual("");
      expect(spList.selection).toStrictEqual(Selection.fromCoords([0, 5], [0, 5]));
      expect(spList.length).toStrictEqual(1);
      spList.insertTextInSpanAt(0, "x", 7);
      spList.insertTextInSpanAt(0, "x", 8);
      expect(spList.selection).toStrictEqual(Selection.fromCoords([0, 5], [0, 5]));
      spList.insertTextInSpanAt(0, "x", 4);
      expect(spList.selection).toStrictEqual(Selection.fromCoords([0, 6], [0, 6]));
      spList.insertTextInSpanAt(0, "x", 6);
      expect(spList.selection).toStrictEqual(Selection.fromCoords([0, 7], [0, 7]));
    });

    it("works when both selection and insertion are ranges", () => {
      // selection is *after* insertion range
      const spList = new SpanList();
      spList.insertAtEnd(new Span(doc, "The fox jumped over the lazy dog"));
      spList.updateSelection(Selection.fromCoords([0, 8], [0, 14]));
      expect(spList.getSelectedText()).toStrictEqual("jumped");
      spList.insertTextInSpanAt(0, "wild cat ", 4, 8);
      expect(spList.at(0).text).toStrictEqual("The wild cat jumped over the lazy dog");
      expect(spList.selection).toStrictEqual(Selection.fromCoords([0, 13], [0, 19]));
      expect(spList.getSelectedText()).toStrictEqual("jumped");

      // selection is to the right of insertion range, but has an overlap.
      spList.updateSelection(Selection.fromCoords([0, 9], [0, 19]));
      expect(spList.getSelectedText()).toStrictEqual("cat jumped");
      spList.insertTextInSpanAt(0, "fuzzy fox ", 4, 13);
      expect(spList.at(0).text).toStrictEqual("The fuzzy fox jumped over the lazy dog");
      expect(spList.getSelectedText()).toStrictEqual("jumped");
      expect(spList.selection).toStrictEqual(Selection.fromCoords([0, 14], [0, 20]));

      // insertion is to the right of selection, but has overlap.
      spList.updateSelection(Selection.fromCoords([0, 4], [0, 13]));
      expect(spList.getSelectedText()).toStrictEqual("fuzzy fox");
      spList.insertTextInSpanAt(0, "cat leaped", 10, 20);
      expect(spList.getSelectedText()).toStrictEqual("fuzzy ");
      spList.updateSelection(Selection.fromCoords([0, 4], [0, 10]));

      // insertion is inside selection
      spList.updateSelection(Selection.fromCoords([0, 4], [0, 20]));
      expect(spList.getSelectedText()).toStrictEqual("fuzzy cat leaped");
      spList.insertTextInSpanAt(0, "fox", 10, 13);
      expect(spList.selection).toStrictEqual(Selection.fromCoords([0, 4], [0, 20]));
      expect(spList.getSelectedText()).toStrictEqual("fuzzy fox leaped");

      // insertion surrounds selection
      spList.updateSelection(Selection.fromCoords([0, 10], [0, 13]));
      expect(spList.getSelectedText()).toStrictEqual("fox");
      spList.insertTextInSpanAt(0, "mad dog jumped", 4, 20);
      expect(spList.selection).toStrictEqual(Selection.fromCoords([0, 4], [0, 4]));
      expect(spList.getSelectedText()).toStrictEqual("");

      // insertion and selection ranges are equal
      spList.updateSelection(Selection.fromCoords([0, 8], [0, 11]));
      expect(spList.getSelectedText()).toStrictEqual("dog");
      spList.insertTextInSpanAt(0, "cat", 8, 11);
      expect(spList.selection).toStrictEqual(Selection.fromCoords([0, 8], [0, 8]));
      expect(spList.getSelectedText()).toStrictEqual("");
    });
  });

  describe("SpanList#adjustSelectionForSpanDeletion", () => {
    it("works when a multiple contiguous spans are removed", () => {
      const spList = new SpanList();
      toSpans("The quick brown fox jumped".split(" "), doc).forEach(
        spList.insertAtEnd.bind(spList)
      );

      const reset = () => {
        spList.deleteBetween(0, spList.length);
        toSpans("The quick brown fox jumped".split(" "), doc).forEach(
          spList.insertAtEnd.bind(spList)
        );
      };

      spList.updateSelection(Selection.fromCoords([0, 0], [2, 5]));
      expect(spList.getSelectedText()).toStrictEqual("Thequickbrown");

      // 1. spans are removed to the right.
      spList.deleteBetween(3, 5);
      expect(spList.getSelectedText()).toStrictEqual("Thequickbrown");

      reset();

      // 2. spans are removed to the left
      spList.updateSelection(Selection.fromCoords([3, 0], [4, 7]));
      expect(spList.getSelectedText()).toStrictEqual("foxjumped");
      spList.deleteBetween(0, 3);
      expect(spList.selection).toStrictEqual(Selection.fromCoords([0, 0], [1, 7]));
      expect(spList.getSelectedText()).toStrictEqual("foxjumped");

      reset();

      // 3. spans are removed on the right, but have overlap
      spList.updateSelection(Selection.fromCoords([0, 0], [2, 5]));
      expect(spList.getSelectedText()).toStrictEqual("Thequickbrown");
      spList.deleteBetween(2, 5);
      expect(spList.selection).toStrictEqual(Selection.fromCoords([0, 0], [1, 5]));
      expect(spList.getSelectedText()).toStrictEqual("Thequick");

      reset();

      // 4. spans are removed on the left, but have overlap
      spList.updateSelection(Selection.fromCoords([2, 0], [4, 7]));
      expect(spList.getSelectedText()).toStrictEqual("brownfoxjumped");
      spList.deleteBetween(0, 3);
      expect(spList.selection).toStrictEqual(Selection.fromCoords([0, 0], [1, 7]));
      expect(spList.getSelectedText()).toStrictEqual("foxjumped");

      reset();

      // 5. selection is inside deleted spans
      spList.updateSelection(Selection.fromCoords([2, 0], [2, 5]));
      expect(spList.getSelectedText()).toStrictEqual("brown");
      spList.deleteBetween(1, 4);
      expect(spList.selection).toStrictEqual(Selection.fromCoords([1, 0], [1, 0]));
      expect(spList.getSelectedText()).toStrictEqual("");

      reset();

      // 6. selection surrounds deleted spans.
      spList.updateSelection(Selection.fromCoords([0, 0], [4, 6]));
      expect(spList.getSelectedText()).toStrictEqual("Thequickbrownfoxjumped");
      spList.deleteBetween(1, 4);
      expect(spList.selection).toStrictEqual(Selection.fromCoords([0, 0], [1, 6]));
      expect(spList.getSelectedText()).toStrictEqual("Thejumped");

      reset();

      // 7. all spans are deleted.
      spList.updateSelection(Selection.fromCoords([1, 0], [3, 4]));
      expect(spList.getSelectedText()).toStrictEqual("quickbrownfox");
      spList.deleteBetween(0, 5);
      expect(spList.selection).toStrictEqual(Selection.fromCoords([0, 0], [0, 0]));
      expect(spList.getSelectedText()).toStrictEqual("");
    });
  });
});
