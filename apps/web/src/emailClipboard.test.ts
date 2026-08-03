import assert from "node:assert/strict";
import test from "node:test";
import { copyRichEmailToClipboard } from "./emailClipboard";

class TestClipboardItem {
  readonly items: Record<string, Blob>;

  constructor(items: Record<string, Blob>) {
    this.items = items;
  }
}

test("rich email clipboard writes html and plain text", async () => {
  const writes: ClipboardItem[][] = [];
  const result = await copyRichEmailToClipboard(
    { html: "<p>Hello</p>", plainText: "Hello" },
    {
      write: async (items) => {
        writes.push(items);
      },
    },
    TestClipboardItem as unknown as typeof ClipboardItem,
  );

  assert.equal(result.ok, true);
  assert.equal(result.mode, "html_and_plain_text");
  assert.equal(writes.length, 1);
  assert.deepEqual(
    Object.keys((writes[0][0] as unknown as TestClipboardItem).items),
    ["text/html", "text/plain"],
  );
});

test("rich email clipboard falls back to plain text", async () => {
  let copied = "";
  const result = await copyRichEmailToClipboard(
    { html: "<p>Hello</p>", plainText: "Hello" },
    {
      write: async () => {
        throw new Error("permission denied");
      },
      writeText: async (text) => {
        copied = text;
      },
    },
    TestClipboardItem as unknown as typeof ClipboardItem,
  );

  assert.equal(result.ok, false);
  assert.equal(result.mode, "plain_text_fallback");
  assert.equal(copied, "Hello");
});
