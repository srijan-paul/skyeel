import Doc from "../../src/model/document";
import { BoldMark, ItalicMark, UnderlineMark } from "../../src/model/mark";
import Selection from "../../src/model/selection";
import Span from "../../src/model/span";

describe("Doc", () => {
	const doc = new Doc();

	describe("Doc#insertTextAt", () => {
		it("works as expected", () => {
			// "" -> "The quick brown fox"
			const span = new Span(doc, "");
			doc.spans.insertAtEnd(span);
			doc.insertTextAt(
				{
					from: { span: doc.spans.at(0), index: 0 },
					to: { span: doc.spans.at(0), index: 0 },
				},
				"The quick brown fox"
			);
			expect(doc.spans.length).toStrictEqual(1);
			expect(doc.spans.at(0).text).toStrictEqual("The quick brown fox");
		});
	});

	describe("Doc#addMarkToSelection", () => {
		// The quick brown fox -> The **quick** brown fox
		it("works as expected inside a single span", () => {
			doc.addMarkToSelection(
				{
					from: { span: doc.spans.at(0), index: 4 },
					to: { span: doc.spans.at(0), index: 9 },
				},
				BoldMark
			);

			expect(doc.spans.length).toStrictEqual(3);

			doc.spans.forEach((sp, i) => {
				if (i === 1) {
					expect(sp.text).toStrictEqual("quick");
					expect(sp.markSet.has(BoldMark)).toBeTruthy();
				} else {
					expect(sp.markSet.size).toStrictEqual(0);
				}
			});
		});

		// The [b]quick[/b] brown fox
		// T[i]he [/i][bi]qui[/bi][b]ck[/b] brown fox
		it("works when the selection has 2 spans", () => {
			const selection: Selection = {
				from: { span: doc.spans.at(0), index: 1 },
				to: { span: doc.spans.at(1), index: 3 },
			};

			doc.addMarkToSelection(selection, ItalicMark);
			expect(doc.spans.length).toBe(5);
			expect(doc.spans.map((sp) => sp.text)).toStrictEqual(["T", "he ", "qui", "ck", " brown fox"]);
		});

		it("works when the selection has 3 spans", () => {
			const selection: Selection = {
				from: { span: doc.spans.at(1), index: 1 },
				to: { span: doc.spans.at(4), index: 10 },
			};

			doc.addMarkToSelection(selection, UnderlineMark);
			expect(doc.spans.length).toBe(6);
			expect(doc.spans.map((sp) => sp.text)).toStrictEqual([
				"T",
				"h",
				"e ",
				"qui",
				"ck",
				" brown fox",
			]);

			const actualMarks = doc.spans.map((sp) =>
				Array.from(sp.markSet)
					.map((mark) => mark.type)
					.sort()
			);

			const expectedMarks: string[][] = [
				[],
				["italic"],
				["italic", "underline"],
				["bold", "italic", "underline"],
				["bold", "underline"],
				["underline"],
			];

			expect(actualMarks).toStrictEqual(expectedMarks);
		});
	});
});
