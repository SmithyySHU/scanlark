export type RichEmailCopyResult =
  | {
      ok: true;
      mode: "html_and_plain_text";
      message: string;
      mimeTypes: string[];
    }
  | {
      ok: false;
      mode: "rich_unavailable";
      message: string;
      reason:
        | "insecure_context"
        | "unsupported"
        | "stale_preview"
        | "empty_html"
        | "missing_layout"
        | "missing_expected_text"
        | "missing_logo"
        | "permission_denied";
      mimeTypes: string[];
    };

type ClipboardLike = {
  write?: (items: ClipboardItem[]) => Promise<void>;
};

type ClipboardItemConstructor = new (
  items: Record<string, Blob>,
) => ClipboardItem;

export function verifyRichEmailHtmlForClipboard(
  html: string,
  options: {
    isStale?: boolean;
    expectedText?: string;
    requireLayout?: boolean;
    requireLogoUrl?: boolean;
  } = {},
): RichEmailCopyResult | null {
  const trimmedHtml = html.trim();
  if (options.isStale) {
    return {
      ok: false,
      mode: "rich_unavailable",
      reason: "stale_preview",
      message: "Preview is stale. Render your latest changes before copying.",
      mimeTypes: [],
    };
  }
  if (!trimmedHtml) {
    return {
      ok: false,
      mode: "rich_unavailable",
      reason: "empty_html",
      message: "Rendered HTML is empty.",
      mimeTypes: [],
    };
  }
  if (options.requireLayout && !/<table[\s>]/i.test(trimmedHtml)) {
    return {
      ok: false,
      mode: "rich_unavailable",
      reason: "missing_layout",
      message: "Rendered HTML does not contain the email layout.",
      mimeTypes: [],
    };
  }
  if (options.expectedText) {
    const renderedText = trimmedHtml
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    const expectedText = options.expectedText.replace(/\s+/g, " ").trim();
    if (
      !renderedText.includes(expectedText) &&
      !trimmedHtml.includes(expectedText)
    ) {
      return {
        ok: false,
        mode: "rich_unavailable",
        reason: "missing_expected_text",
        message: "Rendered HTML does not contain the latest edited wording.",
        mimeTypes: [],
      };
    }
  }
  if (
    options.requireLogoUrl &&
    !/https:\/\/scanlark\.com\/assets\/email\/[^"'\s>]+\.png/i.test(trimmedHtml)
  ) {
    return {
      ok: false,
      mode: "rich_unavailable",
      reason: "missing_logo",
      message: "Rendered HTML does not contain a public Scanlark PNG logo URL.",
      mimeTypes: [],
    };
  }
  return null;
}

export async function copyRichEmailToClipboard(
  input: {
    html: string;
    plainText: string;
    isStale?: boolean;
    expectedText?: string;
    requireLayout?: boolean;
    requireLogoUrl?: boolean;
  },
  clipboard: ClipboardLike | undefined = navigator.clipboard,
  ClipboardItemCtor:
    | ClipboardItemConstructor
    | undefined = typeof ClipboardItem === "undefined"
    ? undefined
    : ClipboardItem,
): Promise<RichEmailCopyResult> {
  const mimeTypes = ["text/html", "text/plain"];
  if (typeof window !== "undefined" && !window.isSecureContext) {
    return {
      ok: false,
      mode: "rich_unavailable",
      reason: "insecure_context",
      message: "Browser is not in a secure context.",
      mimeTypes: [],
    };
  }
  const verificationFailure = verifyRichEmailHtmlForClipboard(input.html, {
    isStale: input.isStale,
    expectedText: input.expectedText,
    requireLayout: input.requireLayout,
    requireLogoUrl: input.requireLogoUrl,
  });
  if (verificationFailure) return verificationFailure;

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
        mimeTypes,
      };
    } catch {
      return {
        ok: false,
        mode: "rich_unavailable",
        reason: "permission_denied",
        message: "Clipboard permission was denied.",
        mimeTypes,
      };
    }
  }

  return {
    ok: false,
    mode: "rich_unavailable",
    reason: "unsupported",
    message: "Rich clipboard is unsupported.",
    mimeTypes: [],
  };
}
