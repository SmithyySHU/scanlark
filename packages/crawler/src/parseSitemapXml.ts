import * as cheerio from "cheerio";

export type ParsedSitemap =
  | {
      ok: true;
      kind: "urlset" | "sitemapindex";
      locUrls: string[];
      parsedUrlCount: number;
    }
  | {
      ok: false;
      error: "invalid_xml";
      kind: "unknown";
      locUrls: [];
      parsedUrlCount: 0;
    };

export default function parseSitemapXml(
  content: string,
  maxUrls: number,
): ParsedSitemap {
  try {
    const $ = cheerio.load(content, { xmlMode: true });
    const hasUrlset = $("urlset").length > 0;
    const hasSitemapIndex = $("sitemapindex").length > 0;
    if (!hasUrlset && !hasSitemapIndex) {
      return {
        ok: false,
        error: "invalid_xml",
        kind: "unknown",
        locUrls: [],
        parsedUrlCount: 0,
      };
    }

    const locUrls: string[] = [];
    const selector = hasUrlset ? "url > loc" : "sitemap > loc";
    $(selector).each((_, element) => {
      if (locUrls.length >= maxUrls) return false;
      const value = $(element).text().trim();
      if (value) locUrls.push(value);
      return undefined;
    });

    return {
      ok: true,
      kind: hasUrlset ? "urlset" : "sitemapindex",
      locUrls,
      parsedUrlCount: locUrls.length,
    };
  } catch {
    return {
      ok: false,
      error: "invalid_xml",
      kind: "unknown",
      locUrls: [],
      parsedUrlCount: 0,
    };
  }
}
