import * as cheerio from "cheerio";
import type { AnyNode } from "domhandler";

export interface PageSeoFacts {
  title: string | null;
  metaDescription: string | null;
  h1Count: number;
  robotsMeta: string | null;
  robotsNoindex: boolean;
  canonicalCount: number;
  canonicalHref: string | null;
}

export interface ExtractedPageData {
  links: string[];
  seo: PageSeoFacts;
}

function normalizeTagText(
  value: string | undefined | null,
  hasTag: boolean,
): string | null {
  if (!hasTag) return null;
  return (value ?? "").trim();
}

export default function extractPageData(html: string): ExtractedPageData {
  const $ = cheerio.load(html);
  const links: string[] = [];

  $("a").each((_: number, element: AnyNode) => {
    const link = $(element).attr("href");
    if (link) {
      links.push(link);
    }
  });

  const titleTag = $("title").first();
  const title = normalizeTagText(titleTag.text(), titleTag.length > 0);

  const metaDescriptionTag = $('meta[name="description"]').first();
  const metaDescription = normalizeTagText(
    metaDescriptionTag.attr("content"),
    metaDescriptionTag.length > 0,
  );

  const robotsTag = $('meta[name="robots"]').first();
  const robotsMeta = normalizeTagText(
    robotsTag.attr("content"),
    robotsTag.length > 0,
  );
  const robotsNoindex = robotsMeta
    ? robotsMeta
        .toLowerCase()
        .split(",")
        .map((value) => value.trim())
        .includes("noindex")
    : false;

  const canonicalTags = $("link[rel]")
    .filter((_: number, element: AnyNode) => {
      const rel = ($(element).attr("rel") ?? "").toLowerCase();
      return rel.split(/\s+/).includes("canonical");
    })
    .toArray();
  const canonicalCount = canonicalTags.length;
  const canonicalHref =
    canonicalCount > 0
      ? normalizeTagText($(canonicalTags[0]).attr("href"), true)
      : null;

  return {
    links,
    seo: {
      title,
      metaDescription,
      h1Count: $("h1").length,
      robotsMeta,
      robotsNoindex,
      canonicalCount,
      canonicalHref,
    },
  };
}
