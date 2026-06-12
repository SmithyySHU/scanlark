-- Production safety note:
-- Older alpha databases may already contain scan_site_checks rows written by
-- newer workers, or legacy check_type labels from pre-constraint builds. Normalize
-- known legacy labels before adding the CHECK constraint so the migration can be
-- rerun safely without deleting scan history.
UPDATE scan_site_checks
SET check_type = lower(trim(check_type))
WHERE check_type <> lower(trim(check_type));

UPDATE scan_site_checks
SET check_type = 'robots_txt'
WHERE check_type IN ('robots', 'robots.txt', 'robotstxt');

UPDATE scan_site_checks
SET check_type = 'sitemap_xml'
WHERE check_type IN ('sitemap', 'sitemap.xml', 'xml_sitemap');

UPDATE scan_site_checks
SET check_type = 'sitemap_index_xml'
WHERE check_type IN (
  'sitemap_index',
  'sitemap_index.xml',
  'sitemap-index',
  'sitemap-index.xml',
  'sitemapindex',
  'sitemapindex_xml'
);

UPDATE scan_site_checks
SET check_type = 'https_root'
WHERE check_type IN ('https', 'https_root_url', 'ssl', 'ssl_https');

UPDATE scan_site_checks
SET check_type = 'http_root'
WHERE check_type IN ('http', 'http_root_url');

UPDATE scan_site_checks
SET check_type = 'tls_certificate'
WHERE check_type IN (
  'tls',
  'tls_cert',
  'tls_certificate_check',
  'ssl_certificate',
  'certificate'
);

UPDATE scan_site_checks
SET check_type = 'security_headers_https_root'
WHERE check_type IN (
  'security_header',
  'security_headers',
  'security_headers_https',
  'security_headers_root'
);

UPDATE scan_site_checks
SET check_type = 'performance_basic_https_root'
WHERE check_type IN (
  'performance',
  'performance_basic',
  'performance_basic_https',
  'performance_basic_root'
);

ALTER TABLE scan_site_checks
  DROP CONSTRAINT IF EXISTS scan_site_checks_checl_type_check;

ALTER TABLE scan_site_checks
  DROP CONSTRAINT IF EXISTS scan_site_checks_check_type_check;

ALTER TABLE scan_site_checks
  ADD CONSTRAINT scan_site_checks_check_type_check
  CHECK (
    check_type IN (
      'robots_txt',
      'sitemap_xml',
      'sitemap_index_xml',
      'https_root',
      'http_root',
      'tls_certificate',
      'security_headers_https_root',
      'performance_basic_https_root'
    )
  );
