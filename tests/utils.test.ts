import { replaceArrayRange } from "../src/utils";

describe("replaceArrayRange", () => {
	it("works as expected", () => {
		expect(replaceArrayRange([1, 2, 3, 4, 5, 6], 1, 4, [1, 2])).toStrictEqual([1, 1, 2, 5, 6]);
	});

	it("works with consecutive indices", () => {
		expect(replaceArrayRange([1, 2, 3, 4, 5], 0, 1, [2, 3, 4, 5])).toStrictEqual([
			2, 3, 4, 5, 2, 3, 4, 5,
		]);
	});
});
