import test from "node:test";
import assert from "node:assert/strict";

import { getMarkdownKeyboardEdit } from "./markdown-editor";

test("Tab inserts indent at cursor in plain text", () => {
  const edit = getMarkdownKeyboardEdit({
    value: "hello",
    selectionStart: 5,
    selectionEnd: 5,
    key: "Tab",
  });

  assert.deepEqual(edit, {
    value: "hello  ",
    selectionStart: 7,
    selectionEnd: 7,
  });
});

test("Tab on markdown structural line indents line start", () => {
  const edit = getMarkdownKeyboardEdit({
    value: "- item",
    selectionStart: 6,
    selectionEnd: 6,
    key: "Tab",
  });

  assert.deepEqual(edit, {
    value: "  - item",
    selectionStart: 8,
    selectionEnd: 8,
  });
});

test("Tab with multiline selection indents every selected line", () => {
  const edit = getMarkdownKeyboardEdit({
    value: "a\nb",
    selectionStart: 0,
    selectionEnd: 3,
    key: "Tab",
  });

  assert.deepEqual(edit, {
    value: "  a\n  b",
    selectionStart: 0,
    selectionEnd: 7,
  });
});

test("Shift+Tab removes indentation from selected lines", () => {
  const edit = getMarkdownKeyboardEdit({
    value: "  a\n  b",
    selectionStart: 0,
    selectionEnd: 6,
    key: "Tab",
    shiftKey: true,
  });

  assert.deepEqual(edit, {
    value: "a\nb",
    selectionStart: 0,
    selectionEnd: 2,
  });
});

test("Enter continues list markers", () => {
  const unordered = getMarkdownKeyboardEdit({
    value: "- task",
    selectionStart: 6,
    selectionEnd: 6,
    key: "Enter",
  });
  const ordered = getMarkdownKeyboardEdit({
    value: "1. item",
    selectionStart: 7,
    selectionEnd: 7,
    key: "Enter",
  });
  const task = getMarkdownKeyboardEdit({
    value: "- [x] done",
    selectionStart: 10,
    selectionEnd: 10,
    key: "Enter",
  });

  assert.deepEqual(unordered, {
    value: "- task\n- ",
    selectionStart: 9,
    selectionEnd: 9,
  });
  assert.deepEqual(ordered, {
    value: "1. item\n2. ",
    selectionStart: 11,
    selectionEnd: 11,
  });
  assert.deepEqual(task, {
    value: "- [x] done\n- [ ] ",
    selectionStart: 17,
    selectionEnd: 17,
  });
});

test("Enter on empty markdown marker removes marker", () => {
  const edit = getMarkdownKeyboardEdit({
    value: "- ",
    selectionStart: 2,
    selectionEnd: 2,
    key: "Enter",
  });

  assert.deepEqual(edit, {
    value: "",
    selectionStart: 0,
    selectionEnd: 0,
  });
});

test("Enter inside fenced code keeps only current indent", () => {
  const edit = getMarkdownKeyboardEdit({
    value: "```\n  code",
    selectionStart: 10,
    selectionEnd: 10,
    key: "Enter",
  });

  assert.deepEqual(edit, {
    value: "```\n  code\n  ",
    selectionStart: 13,
    selectionEnd: 13,
  });
});

test("Unsupported key returns null", () => {
  const edit = getMarkdownKeyboardEdit({
    value: "text",
    selectionStart: 0,
    selectionEnd: 0,
    key: "ArrowDown",
  });
  assert.equal(edit, null);
});
