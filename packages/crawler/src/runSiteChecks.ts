import type { ScanSiteCheckType } from "@scanlark/db";
import { upsertScanSiteCheck } from "@scanlark/db";
import {
  MAX_SITEMAP_FILE_BYTES,
  MAX_SITEMAP_REFERENCES_PER_SCAN,
  MAX_SITEMAP_URLS_CHECKED,
  MAX_SITEMAP_URLS_PARSED,
  SITEMAP_REQUEST_TIMEOUT_MS,
} from "./limits";
import fetchSiteResource from "./fetchSiteResource";
import parseRobotsTxt from "./parseRobotsTxt";
import parseSitemapXml from "./parseSitemapXml";
import validateLink from "./validateLink";

type RunSiteChecksArgs = {
  scanRunId: string;
  siteId: string;
  startUrl: string;
  signal?: AbortSignal;
};

function normalizePublicUrl(value: string): string | null {
  try {
    const url = new URL(value);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    url.hash = "";
    return url.toString();
  } catch {
    return null;
  }
}

export default async function runSiteChecks({
  scanRunId,
  siteId,
  startUrl,
  signal,
}: RunSiteChecksArgs): Promise<void> {
  const origin = new URL(startUrl).origin;
  const defaultRobotsUrl = `${origin}/robots.txt`;
  const defaultSitemapUrl = `${origin}/sitemap.xml`;
  const defaultSitemapIndexUrl = `${origin}/sitemap_index.xml`;

  const recordCheck = async (
    checkType: ScanSiteCheckType,
    targetUrl: string,
    result: {
      statusCode: number | null;
      ok: boolean;
      errorMessage: string | null;
      contentType: string | null;
      contentSizeBytes: number | null;
      factsJson?: Record<string, unknown>;
    },
  ) => {
    await upsertScanSiteCheck({
      scanRunId,
      siteId,
      checkType,
      targetUrl,
      statusCode: result.statusCode,
      ok: result.ok,
      errorMessage: result.errorMessage,
      contentType: result.contentType,
      contentSizeBytes: result.contentSizeBytes,
      factsJson: result.factsJson,
    });
  };

  const robotsResult = await fetchSiteResource(defaultRobotsUrl, {
    timeoutMs: SITEMAP_REQUEST_TIMEOUT_MS,
    signal,
    accept: "text/plain,*/*;q=0.8",
    maxBytes: MAX_SITEMAP_FILE_BYTES,
  });

  let referencedSitemaps: string[] = [];
  if (robotsResult.ok) {
    const parsed = parseRobotsTxt(robotsResult.body);
    referencedSitemaps = parsed.sitemapUrls
      .map((url) => normalizePublicUrl(url))
      .filter((value): value is string => Boolean(value))
      .slice(0, MAX_SITEMAP_REFERENCES_PER_SCAN);

    await recordCheck("robots_txt", defaultRobotsUrl, {
      statusCode: robotsResult.status,
      ok: true,
      errorMessage: null,
      contentType: robotsResult.contentType,
      contentSizeBytes: robotsResult.contentSizeBytes,
      factsJson: {
        sitemap_references: referencedSitemaps,
        blocks_all: parsed.blocksAll,
      },
    });
  } else {
    await recordCheck("robots_txt", defaultRobotsUrl, {
      statusCode: robotsResult.status,
      ok: false,
      errorMessage: robotsResult.error,
      contentType: robotsResult.contentType ?? null,
      contentSizeBytes: robotsResult.contentSizeBytes ?? null,
    });
  }

  const sitemapTargets: Array<{ type: ScanSiteCheckType; url: string }> = [
    { type: "sitemap_xml", url: defaultSitemapUrl },
    { type: "sitemap_index_xml", url: defaultSitemapIndexUrl },
  ];

  for (const referencedUrl of referencedSitemaps) {
    const inferredType: ScanSiteCheckType = referencedUrl
      .toLowerCase()
      .includes("index")
      ? "sitemap_index_xml"
      : "sitemap_xml";
    if (!sitemapTargets.some((entry) => entry.url === referencedUrl)) {
      sitemapTargets.push({ type: inferredType, url: referencedUrl });
    }
  }

  const sampledEntryUrls = new Set<string>();

  for (const target of sitemapTargets.slice(
    0,
    2 + MAX_SITEMAP_REFERENCES_PER_SCAN,
  )) {
    const fetchResult = await fetchSiteResource(target.url, {
      timeoutMs: SITEMAP_REQUEST_TIMEOUT_MS,
      signal,
      accept: "application/xml,text/xml,text/plain,*/*;q=0.8",
      maxBytes: MAX_SITEMAP_FILE_BYTES,
    });

    if (!fetchResult.ok) {
      await recordCheck(target.type, target.url, {
        statusCode: fetchResult.status,
        ok: false,
        errorMessage: fetchResult.error,
        contentType: fetchResult.contentType ?? null,
        contentSizeBytes: fetchResult.contentSizeBytes ?? null,
      });
      continue;
    }

    const parsed = parseSitemapXml(fetchResult.body, MAX_SITEMAP_URLS_PARSED);
    if (!parsed.ok) {
      await recordCheck(target.type, target.url, {
        statusCode: fetchResult.status,
        ok: false,
        errorMessage: parsed.error,
        contentType: fetchResult.contentType,
        contentSizeBytes: fetchResult.contentSizeBytes,
        factsJson: {
          parsed_url_count: 0,
          checked_url_count: 0,
        },
      });
      continue;
    }

    const locUrls = parsed.locUrls
      .map((url) => normalizePublicUrl(url))
      .filter((value): value is string => Boolean(value));

    const remainingSampleBudget =
      MAX_SITEMAP_URLS_CHECKED - sampledEntryUrls.size;
    const urlsToCheck = remainingSampleBudget > 0 ? locUrls.slice(0, remainingSampleBudget) : [];
    const brokenEntries: Array<Record<string, unknown>> = [];

    for (const entryUrl of urlsToCheck) {
      if (sampledEntryUrls.has(entryUrl)) continue;
      sampledEntryUrls.add(entryUrl);
      const result = await validateLink(entryUrl, {
        timeoutMs: SITEMAP_REQUEST_TIMEOUT_MS,
        signal,
      });
      if (!result.ok) {
        brokenEntries.push({
          url: entryUrl,
          status_code: result.status,
          error_message: result.error,
          final_url: result.finalUrl,
          redirect_count: result.redirectCount,
        });
      }
    }

    await recordCheck(target.type, target.url, {
      statusCode: fetchResult.status,
      ok: true,
      errorMessage: null,
      contentType: fetchResult.contentType,
      contentSizeBytes: fetchResult.contentSizeBytes,
      factsJson: {
        sitemap_kind: parsed.kind,
        parsed_url_count: locUrls.length,
        checked_url_count: urlsToCheck.length,
        broken_entries: brokenEntries,
      },
    });
  }
}
