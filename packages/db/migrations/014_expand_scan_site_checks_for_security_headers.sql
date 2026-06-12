-- Keep this migration non-narrowing for production databases that already have
-- later site-check rows. Migration 013 performs the legacy normalization.
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
