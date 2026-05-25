const markdownIndent = "  ";

export type MarkdownKeyboardEdit = {
  value: string;
  selectionStart: number;
  selectionEnd: number;
};

type MarkdownKeyboardEditInput = {
  value: string;
  selectionStart: number;
  selectionEnd: number;
  key: string;
  shiftKey?: boolean;
};

function lineStartAt(value: string, position: number) {
  return value.lastIndexOf("\n", Math.max(0, position - 1)) + 1;
}

function lineEndAt(value: string, position: number) {
  const index = value.indexOf("\n", position);
  return index < 0 ? value.length : index;
}

function lineAt(value: string, position: number) {
  const start = lineStartAt(value, position);
  return {
    start,
    end: lineEndAt(value, position),
    text: value.slice(start, lineEndAt(value, position)),
  };
}

function selectedLineRange(value: string, selectionStart: number, selectionEnd: number) {
  const adjustedEnd = selectionEnd > selectionStart && value[selectionEnd - 1] === "\n"
    ? selectionEnd - 1
    : selectionEnd;
  return {
    start: lineStartAt(value, selectionStart),
    end: lineEndAt(value, adjustedEnd),
  };
}

function removeLineIndent(line: string) {
  if (line.startsWith("\t")) return { line: line.slice(1), removed: 1 };
  if (line.startsWith(markdownIndent)) return { line: line.slice(markdownIndent.length), removed: markdownIndent.length };
  if (line.startsWith(" ")) return { line: line.slice(1), removed: 1 };
  return { line, removed: 0 };
}

function isMarkdownStructuralLine(value: string, lineStart: number, line: string) {
  if (isInsideFencedCode(value, lineStart)) return false;
  const content = line.trimStart();
  return (
    /^[-*+]\s+\[(?: |x|X)?\]\s*/.test(content) ||
    /^[-*+]\s+\[\]\s*/.test(content) ||
    /^[-*+]\s+/.test(content) ||
    /^\d+[.)]\s+/.test(content) ||
    /^>+\s*/.test(content)
  );
}

function indentSelection(value: string, selectionStart: number, selectionEnd: number): MarkdownKeyboardEdit {
  if (selectionStart === selectionEnd) {
    const currentLine = lineAt(value, selectionStart);
    if (isMarkdownStructuralLine(value, currentLine.start, currentLine.text)) {
      return {
        value: `${value.slice(0, currentLine.start)}${markdownIndent}${value.slice(currentLine.start)}`,
        selectionStart: selectionStart + markdownIndent.length,
        selectionEnd: selectionStart + markdownIndent.length,
      };
    }

    return {
      value: `${value.slice(0, selectionStart)}${markdownIndent}${value.slice(selectionEnd)}`,
      selectionStart: selectionStart + markdownIndent.length,
      selectionEnd: selectionStart + markdownIndent.length,
    };
  }

  const range = selectedLineRange(value, selectionStart, selectionEnd);
  const segment = value.slice(range.start, range.end);
  const lines = segment.split("\n");
  const nextSegment = lines.map((line) => `${markdownIndent}${line}`).join("\n");
  return {
    value: `${value.slice(0, range.start)}${nextSegment}${value.slice(range.end)}`,
    selectionStart: selectionStart === range.start ? selectionStart : selectionStart + markdownIndent.length,
    selectionEnd: selectionEnd + lines.length * markdownIndent.length,
  };
}

function outdentSelection(value: string, selectionStart: number, selectionEnd: number): MarkdownKeyboardEdit {
  const range = selectedLineRange(value, selectionStart, selectionEnd);
  const segment = value.slice(range.start, range.end);
  const lines = segment.split("\n");
  let removedTotal = 0;
  let removedFromFirstLine = 0;
  const nextSegment = lines
    .map((line, index) => {
      const next = removeLineIndent(line);
      removedTotal += next.removed;
      if (index === 0) removedFromFirstLine = next.removed;
      return next.line;
    })
    .join("\n");
  const firstSelectionOffset = selectionStart - range.start;
  const nextSelectionStart = selectionStart - Math.min(removedFromFirstLine, firstSelectionOffset);
  const nextSelectionEnd = Math.max(nextSelectionStart, selectionEnd - removedTotal);

  return {
    value: `${value.slice(0, range.start)}${nextSegment}${value.slice(range.end)}`,
    selectionStart: nextSelectionStart,
    selectionEnd: nextSelectionEnd,
  };
}

function isInsideFencedCode(value: string, position: number) {
  const before = value.slice(0, position).split(/\r?\n/);
  let fenceCount = 0;
  for (const line of before) {
    if (/^\s*```/.test(line)) fenceCount += 1;
  }
  return fenceCount % 2 === 1;
}

function continuationForLine(value: string, position: number) {
  const start = lineStartAt(value, position);
  const line = value.slice(start, lineEndAt(value, position));
  const indent = /^\s*/.exec(line)?.[0] ?? "";
  if (isInsideFencedCode(value, start)) return indent;

  const content = line.slice(indent.length);
  const task = /^([-*+])\s+\[(?: |x|X)?\]\s+/.exec(content) ?? /^([-*+])\s+\[\]\s+/.exec(content);
  if (task) return `${indent}${task[1]} [ ] `;

  const unordered = /^([-*+])\s+/.exec(content);
  if (unordered) return `${indent}${unordered[1]} `;

  const ordered = /^(\d+)([.)])\s+/.exec(content);
  if (ordered) return `${indent}${Number(ordered[1]) + 1}${ordered[2]} `;

  const quote = /^(>+\s*)/.exec(content);
  if (quote) return `${indent}${quote[1]}`;

  return indent;
}

function removeEmptyMarkdownMarker(value: string, position: number): MarkdownKeyboardEdit | null {
  if (isInsideFencedCode(value, position)) return null;

  const start = lineStartAt(value, position);
  const end = lineEndAt(value, position);
  if (value.slice(position, end).trim()) return null;

  const line = value.slice(start, end);
  const emptyMarker = /^(\s*)(?:[-*+]\s+(?:\[(?: |x|X)?\]\s*|\[\]\s*)?|\d+[.)]\s+|>+\s*)$/.exec(line);
  if (!emptyMarker) return null;

  const nextLine = emptyMarker[1];
  const nextPosition = start + nextLine.length;
  return {
    value: `${value.slice(0, start)}${nextLine}${value.slice(end)}`,
    selectionStart: nextPosition,
    selectionEnd: nextPosition,
  };
}

function continueLine(value: string, selectionStart: number, selectionEnd: number): MarkdownKeyboardEdit {
  const emptyMarkerEdit = selectionStart === selectionEnd ? removeEmptyMarkdownMarker(value, selectionStart) : null;
  if (emptyMarkerEdit) return emptyMarkerEdit;

  const continuation = continuationForLine(value, selectionStart);
  const inserted = `\n${continuation}`;
  const nextPosition = selectionStart + inserted.length;
  return {
    value: `${value.slice(0, selectionStart)}${inserted}${value.slice(selectionEnd)}`,
    selectionStart: nextPosition,
    selectionEnd: nextPosition,
  };
}

export function getMarkdownKeyboardEdit(input: MarkdownKeyboardEditInput): MarkdownKeyboardEdit | null {
  if (input.key === "Tab") {
    return input.shiftKey
      ? outdentSelection(input.value, input.selectionStart, input.selectionEnd)
      : indentSelection(input.value, input.selectionStart, input.selectionEnd);
  }

  if (input.key === "Enter") {
    return continueLine(input.value, input.selectionStart, input.selectionEnd);
  }

  return null;
}
