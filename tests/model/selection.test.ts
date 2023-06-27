import Selection, { RelativePos } from "../../src/model/selection";

/**
 * @param fromSpanIndex first span index of the selection.
 * @param toSpanIndex last span index of the selection.
 */
function makeSelection(fromSpanIndex: number, toSpanIndex: number): Selection {
  return {
    from: {
      spanIndex: fromSpanIndex,
      offset: 1,
    },

    to: {
      spanIndex: toSpanIndex,
      offset: 1,
    },
  };
}

describe("Selection", () => {
  describe("Selection.getRelativePos", () => {
    /**
     * @param sel from/to bounds of the selection (only the span indices)
     * @param spanRange  from/to bounds of the span range
     * @param expected exepect result for an overlap check
     */
    function runTestCase(
      sel: [number, number],
      spanRange: [number, number],
      expected: RelativePos
    ) {
      const selection = makeSelection(sel[0], sel[1]);
      expect(Selection.getRelativePos(selection, spanRange[0], spanRange[1])).toStrictEqual(
        expected
      );
    }

    const spanRange: [number, number] = [4, 7];
    it("works when selection is to the left", () => {
      runTestCase([0, 3], spanRange, RelativePos.left);
    });

    it("works selection is to the left, and has overlap", () => {
      runTestCase([2, 5], spanRange, RelativePos.leftOverlap);
      runTestCase([2, 4], spanRange, RelativePos.leftOverlap);
    });

    it("works when selection is inside the span range", () => {
      runTestCase([5, 6], spanRange, RelativePos.inside);
      runTestCase([5, 7], spanRange, RelativePos.inside);
      runTestCase([4, 6], spanRange, RelativePos.inside);
    });

    it("works when selection is to the right of the span range", () => {
      runTestCase([8, 10], spanRange, RelativePos.right);
    });

    it("works when selection is to the right of the span range, and has overlap", () => {
      runTestCase([7, 10], spanRange, RelativePos.rightOverlap);
      runTestCase([6, 10], spanRange, RelativePos.rightOverlap);
    });

    it("works when selection surrounds the span range", () => {
      runTestCase([2, 10], spanRange, RelativePos.surround);
    });
  });
});
