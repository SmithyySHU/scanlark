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
      'tls_certificate'
    )
  );
