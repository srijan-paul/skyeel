import Span from "../../src/model/span";
import Doc from "../../src/model/document";
import { BoldMark } from "../../src/model/mark";

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
		const emptySpan = new Span(doc, "");

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
});
