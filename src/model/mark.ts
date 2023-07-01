import _ from "lodash";

/**
 * A mark represents some kind of formatting.
 * Like bold, italic, underline, etc.
 */
export default class Mark {
  constructor(
    // "bold", "italic", "color", "undeline", etc.
    readonly type: string,
    // "Render" the mark by mutating a DOM Node to appear different.
    readonly render: (node: Node) => Node = _.identity.bind(_),
    // Any attributes like { color: "#ff0000" }.
    // It's `undefined` for simple marks like "bold".
    readonly attrs?: Record<string, any>
  ) {}
}

export const BoldMark = new Mark("bold", (node) => {
  const newNode = document.createElement("strong");
  newNode.appendChild(node);
  return newNode;
});

export const ItalicMark = new Mark("italic", (node) => {
  const newNode = document.createElement("em");
  newNode.appendChild(node);
  return newNode;
});

export const UnderlineMark = new Mark("underline", (node) => {
  const newNode = document.createElement("u");
  newNode.appendChild(node);
  return newNode;
});
