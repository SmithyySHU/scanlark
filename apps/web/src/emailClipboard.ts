export type RichEmailCopyResult =
  | { ok: true; mode: "html_and_plain_text"; message: string }
  | { ok: false; mode: "rich_unavailable"; message: string };

type ClipboardLike = {
  write?: (items: ClipboardItem[]) => Promise<void>;
};

type ClipboardItemConstructor = new (
  items: Record<string, Blob>,
) => ClipboardItem;

export async function copyRichEmailToClipboard(
  input: { html: string; plainText: string },
  clipboard: ClipboardLike | undefined = navigator.clipboard,
  ClipboardItemCtor:
    | ClipboardItemConstructor
    | undefined = typeof ClipboardItem === "undefined"
    ? undefined
    : ClipboardItem,
): Promise<RichEmailCopyResult> {
  if (clipboard?.write && ClipboardItemCtor) {
    try {
      const item = new ClipboardItemCtor({
        "text/html": new Blob([input.html], { type: "text/html" }),
        "text/plain": new Blob([input.plainText], { type: "text/plain" }),
      });
      await clipboard.write([item]);
      return {
        ok: true,
        mode: "html_and_plain_text",
        message: "Formatted email copied.",
      };
    } catch {
      return {
        ok: false,
        mode: "rich_unavailable",
        message:
          "Rich formatting could not be copied. Use Copy plain text, or try a supported browser.",
      };
    }
  }

  return {
    ok: false,
    mode: "rich_unavailable",
    message:
      "Rich formatting could not be copied. Use Copy plain text, or try a supported browser.",
  };
}
