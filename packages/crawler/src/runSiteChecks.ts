import type { ScanSiteCheckType } from "@scanlark/db";
import { upsertScanSiteCheck } from "@scanlark/db";
import * as cheerio from "cheerio";
import {
  MAX_PERFORMANCE_ROOT_HTML_BYTES,
  MAX_SITEMAP_FILE_BYTES,
  MAX_SITEMAP_REFERENCES_PER_SCAN,
  MAX_SITEMAP_URLS_CHECKED,
  MAX_SITEMAP_URLS_PARSED,
  SITEMAP_REQUEST_TIMEOUT_MS,
} from "./limits";
import { classifyStatus } from "./classifyStatus";
import fetchSiteResource from "./fetchSiteResource";
import inspectTlsCertificate from "./inspectTlsCertificate";
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

function parseFrameAncestors(csp: string | null): boolean {
  if (!csp) return false;
  return csp
    .split(";")
    .map((directive) => directive.trim().toLowerCase())
    .some((directive) => directive.startsWith("frame-ancestors"));
}

function countCookieFlagMisses(setCookieHeaders: string[]) {
  let missingSecure = 0;
  let missingHttpOnly = 0;
  let missingSameSite = 0;

  for (const header of setCookieHeaders) {
    const lower = header.toLowerCase();
    if (!lower.includes("; secure")) missingSecure++;
    if (!lower.includes("; httponly")) missingHttpOnly++;
    if (!lower.includes("; samesite=")) missingSameSite++;
  }

  return {
    cookiesSetCount: setCookieHeaders.length,
    cookiesMissingSecureCount: missingSecure,
    cookiesMissingHttpOnlyCount: missingHttpOnly,
    cookiesMissingSameSiteCount: missingSameSite,
  };
}

function countRootHtmlAssets(html: string) {
  const $ = cheerio.load(html);
  const imageCount = $("img[src]").filter((_, element) =>
    Boolean($(element).attr("src")?.trim()),
  ).length;
  const scriptCount = $("script[src]").filter((_, element) =>
    Boolean($(element).attr("src")?.trim()),
  ).length;
  const stylesheetCount = $("link[rel][href]").filter((_, element) => {
    const rel = ($(element).attr("rel") ?? "").toLowerCase();
    return (
      rel.split(/\s+/).includes("stylesheet") &&
      Boolean($(element).attr("href")?.trim())
    );
  }).length;

  return {
    imageCount,
    scriptCount,
    stylesheetCount,
    assetCount: imageCount + scriptCount + stylesheetCount,
  };
}

export default async function runSiteChecks({
  scanRunId,
  siteId,
  startUrl,
  signal,
}: RunSiteChecksArgs): Promise<void> {
  const baseUrl = new URL(startUrl);
  const origin = baseUrl.origin;
  const hostname = baseUrl.hostname;
  const defaultRobotsUrl = `${origin}/robots.txt`;
  const defaultSitemapUrl = `${origin}/sitemap.xml`;
  const defaultSitemapIndexUrl = `${origin}/sitemap_index.xml`;
  const httpsRootUrl = `https://${hostname}/`;
  const httpRootUrl = `http://${hostname}/`;

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

  let httpsRootFinalHostname: string | null = null;
  const httpsRootValidation = await validateLink(httpsRootUrl, {
    timeoutMs: SITEMAP_REQUEST_TIMEOUT_MS,
    signal,
  });
  const httpsRootClassification = classifyStatus(
    httpsRootUrl,
    httpsRootValidation.status ?? undefined,
    httpsRootValidation.headers,
  );
  const httpsRootFinalUrl = httpsRootValidation.finalUrl ?? httpsRootUrl;
  try {
    httpsRootFinalHostname = new URL(httpsRootFinalUrl).hostname.toLowerCase();
  } catch {
    httpsRootFinalHostname = null;
  }
  const httpsRootFinalScheme = (() => {
    try {
      return new URL(httpsRootFinalUrl).protocol.replace(":", "");
    } catch {
      return null;
    }
  })();
  await recordCheck("https_root", httpsRootUrl, {
    statusCode: httpsRootValidation.status ?? null,
    ok: httpsRootValidation.ok,
    errorMessage: httpsRootValidation.ok ? null : httpsRootValidation.error,
    contentType: httpsRootValidation.headers?.["content-type"] ?? null,
    contentSizeBytes: null,
    factsJson: {
      final_url: httpsRootFinalUrl,
      redirect_count: httpsRootValidation.redirectCount ?? 0,
      classification: httpsRootClassification,
      final_scheme: httpsRootFinalScheme,
      final_hostname: httpsRootFinalHostname,
    },
  });

  const httpRootValidation = await validateLink(httpRootUrl, {
    timeoutMs: SITEMAP_REQUEST_TIMEOUT_MS,
    signal,
  });
  const httpRootClassification = classifyStatus(
    httpRootUrl,
    httpRootValidation.status ?? undefined,
    httpRootValidation.headers,
  );
  const httpRootFinalUrl = httpRootValidation.finalUrl ?? httpRootUrl;
  const redirectsToHttps = (() => {
    try {
      const finalUrl = new URL(httpRootFinalUrl);
      const finalHostname = finalUrl.hostname.toLowerCase();
      return (
        finalUrl.protocol === "https:" &&
        (finalHostname === hostname.toLowerCase() ||
          (httpsRootFinalHostname !== null &&
            finalHostname === httpsRootFinalHostname))
      );
    } catch {
      return false;
    }
  })();
  await recordCheck("http_root", httpRootUrl, {
    statusCode: httpRootValidation.status ?? null,
    ok: httpRootValidation.ok,
    errorMessage: httpRootValidation.ok ? null : httpRootValidation.error,
    contentType: httpRootValidation.headers?.["content-type"] ?? null,
    contentSizeBytes: null,
    factsJson: {
      final_url: httpRootFinalUrl,
      redirect_count: httpRootValidation.redirectCount ?? 0,
      classification: httpRootClassification,
      redirects_to_https: redirectsToHttps,
    },
  });

  try {
    const tlsCertificate = await inspectTlsCertificate(httpsRootUrl, {
      timeoutMs: SITEMAP_REQUEST_TIMEOUT_MS,
      signal,
    });
    if (tlsCertificate.ok) {
      await recordCheck("tls_certificate", httpsRootUrl, {
        statusCode: 200,
        ok: true,
        errorMessage: null,
        contentType: null,
        contentSizeBytes: null,
        factsJson: {
          hostname: tlsCertificate.hostname,
          port: tlsCertificate.port,
          authorized: tlsCertificate.authorized,
          authorization_error: tlsCertificate.authorizationError,
          subject: tlsCertificate.subject,
          issuer: tlsCertificate.issuer,
          valid_from: tlsCertificate.validFrom,
          valid_to: tlsCertificate.validTo,
          days_until_expiry: tlsCertificate.daysUntilExpiry,
          san_dns_names: tlsCertificate.sanDnsNames,
          hostname_matches: tlsCertificate.hostnameMatches,
          is_expired: tlsCertificate.isExpired,
          is_expiring_soon: tlsCertificate.isExpiringSoon,
          is_hostname_mismatch: tlsCertificate.isHostnameMismatch,
          is_invalid: tlsCertificate.isInvalid,
        },
      });
    } else {
      await recordCheck("tls_certificate", httpsRootUrl, {
        statusCode: null,
        ok: false,
        errorMessage: tlsCertificate.error,
        contentType: null,
        contentSizeBytes: null,
        factsJson: {
          hostname: tlsCertificate.hostname,
          port: tlsCertificate.port,
        },
      });
    }
  } catch (error) {
    await recordCheck("tls_certificate", httpsRootUrl, {
      statusCode: null,
      ok: false,
      errorMessage: error instanceof Error ? error.message : "request_failed",
      contentType: null,
      contentSizeBytes: null,
      factsJson: {
        hostname,
        port: 443,
      },
    });
  }

  const canCheckFinalHttpsRoot =
    httpsRootValidation.ok &&
    httpsRootClassification === "ok" &&
    httpsRootFinalScheme === "https" &&
    httpsRootFinalHostname !== null;

  if (canCheckFinalHttpsRoot) {
    const securityHeadersResult = await fetchSiteResource(httpsRootFinalUrl, {
      timeoutMs: SITEMAP_REQUEST_TIMEOUT_MS,
      signal,
      accept: "text/html,application/xhtml+xml,*/*;q=0.8",
      maxBytes: 0,
      readBody: false,
    });

    const headers = securityHeadersResult.headers ?? {};
    const csp = headers["content-security-policy"] ?? null;
    const hsts = headers["strict-transport-security"] ?? null;
    const xFrameOptions = headers["x-frame-options"] ?? null;
    const xContentTypeOptions = headers["x-content-type-options"] ?? null;
    const referrerPolicy = headers["referrer-policy"] ?? null;
    const permissionsPolicy = headers["permissions-policy"] ?? null;
    const hasFrameAncestors = parseFrameAncestors(csp);
    const cookieSummary = countCookieFlagMisses(
      securityHeadersResult.setCookieHeaders ?? [],
    );

    await recordCheck("security_headers_https_root", httpsRootFinalUrl, {
      statusCode: securityHeadersResult.status ?? null,
      ok: securityHeadersResult.ok,
      errorMessage: securityHeadersResult.ok
        ? null
        : securityHeadersResult.error,
      contentType: securityHeadersResult.contentType ?? null,
      contentSizeBytes: securityHeadersResult.contentSizeBytes ?? null,
      factsJson: {
        final_url: securityHeadersResult.url,
        status_code: securityHeadersResult.status ?? null,
        redirect_count: securityHeadersResult.redirectCount ?? 0,
        has_hsts: Boolean(hsts),
        has_csp: Boolean(csp),
        has_x_frame_options: Boolean(xFrameOptions),
        has_frame_ancestors: hasFrameAncestors,
        has_x_content_type_options: Boolean(xContentTypeOptions),
        has_referrer_policy: Boolean(referrerPolicy),
        has_permissions_policy: Boolean(permissionsPolicy),
        hsts,
        csp,
        x_frame_options: xFrameOptions,
        referrer_policy: referrerPolicy,
        permissions_policy: permissionsPolicy,
        cookies_set_count: cookieSummary.cookiesSetCount,
        cookies_missing_secure_count: cookieSummary.cookiesMissingSecureCount,
        cookies_missing_httponly_count:
          cookieSummary.cookiesMissingHttpOnlyCount,
        cookies_missing_samesite_count:
          cookieSummary.cookiesMissingSameSiteCount,
      },
    });

    const performanceStartedAt = Date.now();
    const performanceResult = await fetchSiteResource(httpsRootFinalUrl, {
      timeoutMs: SITEMAP_REQUEST_TIMEOUT_MS,
      signal,
      accept: "text/html,application/xhtml+xml,*/*;q=0.8",
      maxBytes: MAX_PERFORMANCE_ROOT_HTML_BYTES,
    });
    const responseTimeMs = Date.now() - performanceStartedAt;
    const assetCounts = performanceResult.ok
      ? countRootHtmlAssets(performanceResult.body)
      : {
          imageCount: 0,
          scriptCount: 0,
          stylesheetCount: 0,
          assetCount: 0,
        };

    await recordCheck("performance_basic_https_root", httpsRootFinalUrl, {
      statusCode: performanceResult.status ?? null,
      ok: performanceResult.ok,
      errorMessage: performanceResult.ok ? null : performanceResult.error,
      contentType: performanceResult.contentType ?? null,
      contentSizeBytes: performanceResult.contentSizeBytes ?? null,
      factsJson: {
        final_url: performanceResult.url,
        status_code: performanceResult.status ?? null,
        response_time_ms: responseTimeMs,
        html_size_bytes: performanceResult.contentSizeBytes ?? null,
        image_count: assetCounts.imageCount,
        script_count: assetCounts.scriptCount,
        stylesheet_count: assetCounts.stylesheetCount,
        asset_count: assetCounts.assetCount,
      },
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
    const urlsToCheck =
      remainingSampleBudget > 0 ? locUrls.slice(0, remainingSampleBudget) : [];
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
