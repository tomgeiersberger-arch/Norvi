import assert from "node:assert/strict";
import {
  formatTextAttachments,
  isSupportedTextAttachment,
} from "../packages/web/src/web/lib/text-attachments";

assert.equal(isSupportedTextAttachment("hello.ts", ""), true);
assert.equal(isSupportedTextAttachment("notes.txt", "text/plain"), true);
assert.equal(isSupportedTextAttachment("photo.jpg", "image/jpeg"), false);

const formatted = formatTextAttachments([
  { name: "hello.ts", text: "const value = 42;" },
  { name: "notes.md", text: "# NORVI" },
]);
assert.equal(formatted.count, 2);
assert.match(formatted.text, /\[Datei: hello\.ts\]/);
assert.match(formatted.text, /const value = 42/);

const clipped = formatTextAttachments([{ name: "big.log", text: "x".repeat(100) }], 20, 20);
assert.equal(clipped.truncated, true);
assert.match(clipped.text, /gekürzt/);

console.log("text attachments: OK");
