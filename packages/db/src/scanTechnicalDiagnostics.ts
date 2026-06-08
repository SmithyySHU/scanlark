import { ensureConnected } from "./client";

export interface ScanTechnicalDiagnosticsSummary {
  scanRunId: string;
  seoBasic: {
    pageChecksCount: number;
    issueCount: number;
  };
  robots: {
    checksCount: number;
    okChecksCount: number;
    issueCount: number;
    blocksAll: boolean | null;
    sitemapReferencesCount: number | null;
  };
  sitemap: {
    checksCount: number;
    okChecksCount: number;
    issueCount: number;
    parsedUrlCount: number;
    sampledBrokenEntryCount: number;
  };
  sslHttps: {
    checksCount: number;
    okChecksCount: number;
    issueCount: number;
    httpsAvailable: boolean | null;
    httpRedirectsToHttps: boolean | null;
    tlsAuthorized: boolean | null;
    hostnameMatches: boolean | null;
    daysUntilExpiry: number | null;
    expiringSoon: boolean | null;
  };
  securityHeader: {
    checksCount: number;
    okChecksCount: number;
    issueCount: number;
    hasHsts: boolean | null;
    hasCsp: boolean | null;
    hasFrameAncestors: boolean | null;
    hasXFrameOptions: boolean | null;
    hasXContentTypeOptions: boolean | null;
    hasReferrerPolicy: boolean | null;
    hasPermissionsPolicy: boolean | null;
    cookiesSetCount: number | null;
    cookiesMissingSecureCount: number | null;
    cookiesMissingHttpOnlyCount: number | null;
    cookiesMissingSameSiteCount: number | null;
  };
  performanceBasic: {
    checksCount: number;
    okChecksCount: number;
    issueCount: number;
    responseTimeMs: number | null;
    htmlSizeBytes: number | null;
    imageCount: number | null;
    scriptCount: number | null;
    stylesheetCount: number | null;
    assetCount: number | null;
  };
}

type SiteCheckRow = {
  check_type: string;
  ok: boolean;
  facts_json: Record<string, unknown>;
};

function asBoolean(value: unknown): boolean | null {
  return typeof value === "boolean" ? value : null;
}

function asNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

export async function getScanTechnicalDiagnosticsForUser(
  userId: string,
  scanRunId: string,
): Promise<ScanTechnicalDiagnosticsSummary> {
  const client = await ensureConnected();

  const pageChecksRes = await client.query<{ count: string }>(
    `
      SELECT COUNT(*) AS count
      FROM scan_page_checks pc
      JOIN sites s ON s.id = pc.site_id
      WHERE pc.scan_run_id = $1
        AND s.user_id = $2
    `,
    [scanRunId, userId],
  );

  const siteChecksRes = await client.query<SiteCheckRow>(
    `
      SELECT sc.check_type, sc.ok, sc.facts_json
      FROM scan_site_checks sc
      JOIN sites s ON s.id = sc.site_id
      WHERE sc.scan_run_id = $1
        AND s.user_id = $2
    `,
    [scanRunId, userId],
  );

  const issueCountsRes = await client.query<{
    category: string;
    count: string;
  }>(
    `
      SELECT si.category, COUNT(*) AS count
      FROM scan_issues si
      JOIN sites s ON s.id = si.site_id
      WHERE si.scan_run_id = $1
        AND s.user_id = $2
        AND si.category IN ('seo_basic', 'robots', 'sitemap', 'ssl_https', 'security_header', 'performance_basic')
      GROUP BY si.category
    `,
    [scanRunId, userId],
  );

  const issueCountByCategory = new Map<string, number>();
  for (const row of issueCountsRes.rows) {
    issueCountByCategory.set(row.category, Number(row.count));
  }

  const robotsChecks = siteChecksRes.rows.filter(
    (row) => row.check_type === "robots_txt",
  );
  const sitemapChecks = siteChecksRes.rows.filter(
    (row) =>
      row.check_type === "sitemap_xml" ||
      row.check_type === "sitemap_index_xml",
  );
  const sslChecks = siteChecksRes.rows.filter(
    (row) =>
      row.check_type === "https_root" ||
      row.check_type === "http_root" ||
      row.check_type === "tls_certificate",
  );
  const securityHeaderChecks = siteChecksRes.rows.filter(
    (row) => row.check_type === "security_headers_https_root",
  );
  const performanceBasicChecks = siteChecksRes.rows.filter(
    (row) => row.check_type === "performance_basic_https_root",
  );
  const robotsRow = robotsChecks[0] ?? null;
  const httpsRow =
    siteChecksRes.rows.find((row) => row.check_type === "https_root") ?? null;
  const httpRow =
    siteChecksRes.rows.find((row) => row.check_type === "http_root") ?? null;
  const tlsRow =
    siteChecksRes.rows.find((row) => row.check_type === "tls_certificate") ??
    null;

  return {
    scanRunId,
    seoBasic: {
      pageChecksCount: Number(pageChecksRes.rows[0]?.count ?? 0),
      issueCount: issueCountByCategory.get("seo_basic") ?? 0,
    },
    robots: {
      checksCount: robotsChecks.length,
      okChecksCount: robotsChecks.filter((row) => row.ok).length,
      issueCount: issueCountByCategory.get("robots") ?? 0,
      blocksAll: asBoolean(robotsRow?.facts_json?.blocks_all),
      sitemapReferencesCount: robotsRow
        ? asArray(robotsRow.facts_json?.sitemap_references).length
        : null,
    },
    sitemap: {
      checksCount: sitemapChecks.length,
      okChecksCount: sitemapChecks.filter((row) => row.ok).length,
      issueCount: issueCountByCategory.get("sitemap") ?? 0,
      parsedUrlCount: sitemapChecks.reduce(
        (sum, row) => sum + (asNumber(row.facts_json?.parsed_url_count) ?? 0),
        0,
      ),
      sampledBrokenEntryCount: sitemapChecks.reduce(
        (sum, row) => sum + asArray(row.facts_json?.broken_entries).length,
        0,
      ),
    },
    sslHttps: {
      checksCount: sslChecks.length,
      okChecksCount: sslChecks.filter((row) => row.ok).length,
      issueCount: issueCountByCategory.get("ssl_https") ?? 0,
      httpsAvailable: httpsRow
        ? httpsRow.ok &&
          httpsRow.facts_json?.classification === "ok" &&
          httpsRow.facts_json?.final_scheme === "https"
        : null,
      httpRedirectsToHttps: httpRow
        ? asBoolean(httpRow.facts_json?.redirects_to_https)
        : null,
      tlsAuthorized: tlsRow ? asBoolean(tlsRow.facts_json?.authorized) : null,
      hostnameMatches: tlsRow
        ? asBoolean(tlsRow.facts_json?.hostname_matches)
        : null,
      daysUntilExpiry: tlsRow
        ? asNumber(tlsRow.facts_json?.days_until_expiry)
        : null,
      expiringSoon: tlsRow
        ? asBoolean(tlsRow.facts_json?.is_expiring_soon)
        : null,
    },
    securityHeader: {
      checksCount: securityHeaderChecks.length,
      okChecksCount: securityHeaderChecks.filter((row) => row.ok).length,
      issueCount: issueCountByCategory.get("security_header") ?? 0,
      hasHsts: securityHeaderChecks[0]
        ? asBoolean(securityHeaderChecks[0].facts_json?.has_hsts)
        : null,
      hasCsp: securityHeaderChecks[0]
        ? asBoolean(securityHeaderChecks[0].facts_json?.has_csp)
        : null,
      hasFrameAncestors: securityHeaderChecks[0]
        ? asBoolean(securityHeaderChecks[0].facts_json?.has_frame_ancestors)
        : null,
      hasXFrameOptions: securityHeaderChecks[0]
        ? asBoolean(securityHeaderChecks[0].facts_json?.has_x_frame_options)
        : null,
      hasXContentTypeOptions: securityHeaderChecks[0]
        ? asBoolean(
            securityHeaderChecks[0].facts_json?.has_x_content_type_options,
          )
        : null,
      hasReferrerPolicy: securityHeaderChecks[0]
        ? asBoolean(securityHeaderChecks[0].facts_json?.has_referrer_policy)
        : null,
      hasPermissionsPolicy: securityHeaderChecks[0]
        ? asBoolean(securityHeaderChecks[0].facts_json?.has_permissions_policy)
        : null,
      cookiesSetCount: securityHeaderChecks[0]
        ? asNumber(securityHeaderChecks[0].facts_json?.cookies_set_count)
        : null,
      cookiesMissingSecureCount: securityHeaderChecks[0]
        ? asNumber(
            securityHeaderChecks[0].facts_json?.cookies_missing_secure_count,
          )
        : null,
      cookiesMissingHttpOnlyCount: securityHeaderChecks[0]
        ? asNumber(
            securityHeaderChecks[0].facts_json?.cookies_missing_httponly_count,
          )
        : null,
      cookiesMissingSameSiteCount: securityHeaderChecks[0]
        ? asNumber(
            securityHeaderChecks[0].facts_json?.cookies_missing_samesite_count,
          )
        : null,
    },
    performanceBasic: {
      checksCount: performanceBasicChecks.length,
      okChecksCount: performanceBasicChecks.filter((row) => row.ok).length,
      issueCount: issueCountByCategory.get("performance_basic") ?? 0,
      responseTimeMs: performanceBasicChecks[0]
        ? asNumber(performanceBasicChecks[0].facts_json?.response_time_ms)
        : null,
      htmlSizeBytes: performanceBasicChecks[0]
        ? asNumber(performanceBasicChecks[0].facts_json?.html_size_bytes)
        : null,
      imageCount: performanceBasicChecks[0]
        ? asNumber(performanceBasicChecks[0].facts_json?.image_count)
        : null,
      scriptCount: performanceBasicChecks[0]
        ? asNumber(performanceBasicChecks[0].facts_json?.script_count)
        : null,
      stylesheetCount: performanceBasicChecks[0]
        ? asNumber(performanceBasicChecks[0].facts_json?.stylesheet_count)
        : null,
      assetCount: performanceBasicChecks[0]
        ? asNumber(performanceBasicChecks[0].facts_json?.asset_count)
        : null,
    },
  };
}
