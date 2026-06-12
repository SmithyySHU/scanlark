CREATE TABLE IF NOT EXISTS email_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  name text NOT NULL,
  description text NOT NULL,
  subject_template text NOT NULL,
  html_template text NOT NULL,
  text_template text,
  enabled boolean NOT NULL DEFAULT true,
  version integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  deleted_at timestamptz
);

CREATE INDEX IF NOT EXISTS email_templates_deleted_key_idx
  ON email_templates(key)
  WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS email_template_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid NOT NULL REFERENCES email_templates(id) ON DELETE CASCADE,
  previous_subject_template text,
  previous_html_template text,
  previous_text_template text,
  previous_enabled boolean,
  next_subject_template text NOT NULL,
  next_html_template text NOT NULL,
  next_text_template text,
  next_enabled boolean NOT NULL,
  changed_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  changed_at timestamptz NOT NULL DEFAULT now(),
  change_note text
);

CREATE INDEX IF NOT EXISTS email_template_versions_template_changed_idx
  ON email_template_versions(template_id, changed_at DESC);

INSERT INTO email_templates (
  key,
  name,
  description,
  subject_template,
  html_template,
  text_template
)
VALUES
  (
    'scan_failed',
    'Scan failed',
    'Sent when a scheduled scan fails.',
    'Scanlark: scheduled scan failed for {{siteName}}',
    '<p><strong>Scheduled scan failed</strong> for {{siteUrl}}</p><p>Status: failed</p><p>Started: {{startedAt}}</p><p>Finished: {{completedAt}}</p><p>Error: {{errorMessage}}</p><p><a href="{{reportUrl}}">View report</a></p>',
    'Scheduled scan failed for {{siteUrl}}\nStatus: failed\nStarted: {{startedAt}}\nFinished: {{completedAt}}\nError: {{errorMessage}}\n\nView report: {{reportUrl}}'
  ),
  (
    'high_priority_issues_found',
    'High priority issues found',
    'Sent when a scheduled scan finds critical or high severity issues.',
    'Scanlark: high-priority issues found on {{siteName}}',
    '<p><strong>High-priority issues found</strong> for {{siteUrl}}</p><p>This scheduled scan found critical or high severity issues.</p><p>Health score: {{healthScore}}</p><p>Open issues: {{issueCount}} | Critical: {{criticalCount}} | High: {{highCount}}</p><p>Top issues:<br>{{topIssues}}</p><p><a href="{{reportUrl}}">View report</a></p><p>You can change alert settings in Scanlark.</p>',
    'High-priority issues found for {{siteUrl}}\nHealth score: {{healthScore}}\nOpen issues: {{issueCount}}\nCritical: {{criticalCount}}\nHigh: {{highCount}}\n\nTop issues:\n{{topIssues}}\n\nView report: {{reportUrl}}\nYou can change alert settings in Scanlark.'
  ),
  (
    'weekly_summary',
    'Weekly summary',
    'Sent for weekly scheduled scan summaries.',
    'Scanlark: weekly scan summary for {{siteName}}',
    '<p><strong>Weekly scan summary</strong> for {{siteUrl}}</p><p>Health score: {{healthScore}}</p><p>Open issues: {{issueCount}} | Critical: {{criticalCount}} | High: {{highCount}}</p><p>By severity: {{severityCounts}}</p><p>By category: {{categoryCounts}}</p><p>Top issues:<br>{{topIssues}}</p><p><a href="{{reportUrl}}">View report</a></p><p>You can change alert settings in Scanlark.</p>',
    'Weekly scan summary for {{siteUrl}}\nHealth score: {{healthScore}}\nOpen issues: {{issueCount}}\nCritical: {{criticalCount}}\nHigh: {{highCount}}\nBy severity: {{severityCounts}}\nBy category: {{categoryCounts}}\n\nTop issues:\n{{topIssues}}\n\nView report: {{reportUrl}}\nYou can change alert settings in Scanlark.'
  ),
  (
    'test_email',
    'Test email',
    'Sent from site notification settings or admin template testing.',
    'Scanlark: test alert for {{siteName}}',
    '<p>This is a test alert for {{siteUrl}}.</p><p>Health score: {{healthScore}}</p><p>Open issues: {{issueCount}}</p><p><a href="{{dashboardUrl}}">Open dashboard</a></p>',
    'This is a test alert for {{siteUrl}}.\nHealth score: {{healthScore}}\nOpen issues: {{issueCount}}\nOpen dashboard: {{dashboardUrl}}'
  ),
  (
    'uptime_down',
    'Uptime down',
    'Reserved for future uptime-down transactional email alerts.',
    'Scanlark: availability down for {{siteName}}',
    '<p><strong>Availability down</strong> for {{siteUrl}}</p><p>{{checkUrl}} failed availability checks.</p><p><a href="{{dashboardUrl}}">Open dashboard</a></p>',
    'Availability down for {{siteUrl}}\n{{checkUrl}} failed availability checks.\nOpen dashboard: {{dashboardUrl}}'
  ),
  (
    'uptime_recovered',
    'Uptime recovered',
    'Reserved for future uptime-recovered transactional email alerts.',
    'Scanlark: availability recovered for {{siteName}}',
    '<p><strong>Availability recovered</strong> for {{siteUrl}}</p><p>{{checkUrl}} is reachable again.</p><p><a href="{{dashboardUrl}}">Open dashboard</a></p>',
    'Availability recovered for {{siteUrl}}\n{{checkUrl}} is reachable again.\nOpen dashboard: {{dashboardUrl}}'
  ),
  (
    'share_report_created',
    'Shared report created',
    'Reserved for future shared-report transactional emails.',
    'Scanlark: report shared for {{siteName}}',
    '<p>A Scanlark report was shared for {{siteUrl}}.</p><p><a href="{{reportUrl}}">View report</a></p>',
    'A Scanlark report was shared for {{siteUrl}}.\nView report: {{reportUrl}}'
  )
ON CONFLICT (key) DO NOTHING;
