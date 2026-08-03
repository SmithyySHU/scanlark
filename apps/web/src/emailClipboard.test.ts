import assert from "node:assert/strict";
import test from "node:test";
import {
  copyRichEmailToClipboard,
  verifyRichEmailHtmlForClipboard,
} from "./emailClipboard";

class TestClipboardItem {
  readonly items: Record<string, Blob>;

  constructor(items: Record<string, Blob>) {
    this.items = items;
  }
}

function failureReason(
  result: ReturnType<typeof verifyRichEmailHtmlForClipboard>,
) {
  assert(result);
  assert.equal(result.ok, false);
  return result.reason;
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
  assert.deepEqual(result.mimeTypes, ["text/html", "text/plain"]);
  assert.equal(writes.length, 1);
  assert.deepEqual(
    Object.keys((writes[0][0] as unknown as TestClipboardItem).items),
    ["text/html", "text/plain"],
  );
});

test("rich email clipboard failure is reported honestly without plain text fallback", async () => {
  let copied = "";
  const clipboard = {
    write: async () => {
      throw new Error("permission denied");
    },
    writeText: async (text: string) => {
      copied = text;
    },
  };
  const result = await copyRichEmailToClipboard(
    { html: "<p>Hello</p>", plainText: "Hello" },
    clipboard,
    TestClipboardItem as unknown as typeof ClipboardItem,
  );

  assert.equal(result.ok, false);
  assert.equal(result.mode, "rich_unavailable");
  assert.equal(result.reason, "permission_denied");
  assert.equal(copied, "");
});

test("rich email clipboard diagnostics block stale or incomplete rendered html", () => {
  assert.equal(
    failureReason(
      verifyRichEmailHtmlForClipboard(
        "<table><tr><td>Hello</td></tr></table>",
        {
          isStale: true,
        },
      ),
    ),
    "stale_preview",
  );
  assert.equal(
    failureReason(verifyRichEmailHtmlForClipboard("", { requireLayout: true })),
    "empty_html",
  );
  assert.equal(
    failureReason(
      verifyRichEmailHtmlForClipboard("<p>Hello</p>", {
        requireLayout: true,
      }),
    ),
    "missing_layout",
  );
  assert.equal(
    failureReason(
      verifyRichEmailHtmlForClipboard(
        "<table><tr><td>Hello</td></tr></table>",
        {
          expectedText: "COMMUNICATIONS PREVIEW TEST 4837",
        },
      ),
    ),
    "missing_expected_text",
  );
  assert.equal(
    failureReason(
      verifyRichEmailHtmlForClipboard(
        "<table><tr><td>Hello</td></tr></table>",
        {
          requireLogoUrl: true,
        },
      ),
    ),
    "missing_logo",
  );
});

test("rich email clipboard diagnostics accept layout logo and edited wording", () => {
  const html =
    '<table><tr><td><img alt="Scanlark" src="https://scanlark.com/assets/email/scanlark-email-logo-navy.png" width="180" height="47">COMMUNICATIONS PREVIEW TEST 4837</td></tr></table>';
  assert.equal(
    verifyRichEmailHtmlForClipboard(html, {
      requireLayout: true,
      requireLogoUrl: true,
      expectedText: "COMMUNICATIONS PREVIEW TEST 4837",
    }),
    null,
  );
});
