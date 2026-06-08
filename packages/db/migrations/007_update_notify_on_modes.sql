UPDATE sites
SET notify_on = 'issues_exist'
WHERE notify_on = 'issues';

ALTER TABLE sites
  ALTER COLUMN notify_on SET DEFAULT 'new_issues_only';
