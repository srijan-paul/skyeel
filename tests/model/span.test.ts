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
  });
});
