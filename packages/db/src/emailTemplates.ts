import { ensureConnected } from "./client";

export type EmailTemplateKey =
  | "scan_failed"
  | "high_priority_issues_found"
  | "weekly_summary"
  | "test_email"
  | "uptime_down"
  | "uptime_recovered"
  | "share_report_created";

export type DefaultEmailTemplate = {
  key: EmailTemplateKey;
  name: string;
  description: string;
  subjectTemplate: string;
  htmlTemplate: string;
  textTemplate: string | null;
  variables: string[];
};

const COMMON_VARIABLES = [
  "appName",
  "siteName",
  "siteUrl",
  "reportUrl",
  "scanRunId",
  "dashboardUrl",
  "unsubscribeOrPreferencesUrl",
];

export const DEFAULT_EMAIL_TEMPLATES: DefaultEmailTemplate[] = [
  {
    key: "scan_failed",
    name: "Scan failed",
    description: "Sent when a scheduled scan fails.",
    subjectTemplate: "Scanlark: scheduled scan failed for {{siteName}}",
    htmlTemplate:
      '<p><strong>Scheduled scan failed</strong> for {{siteUrl}}</p><p>Status: failed</p><p>Started: {{startedAt}}</p><p>Finished: {{completedAt}}</p><p>Error: {{errorMessage}}</p><p><a href="{{reportUrl}}">View report</a></p>',
    textTemplate:
      "Scheduled scan failed for {{siteUrl}}\nStatus: failed\nStarted: {{startedAt}}\nFinished: {{completedAt}}\nError: {{errorMessage}}\n\nView report: {{reportUrl}}",
    variables: [
      ...COMMON_VARIABLES,
      "startedAt",
      "completedAt",
      "errorMessage",
    ],
  },
  {
    key: "high_priority_issues_found",
    name: "High priority issues found",
    description:
      "Sent when a scheduled scan finds critical or high severity issues.",
    subjectTemplate: "Scanlark: high-priority issues found on {{siteName}}",
    htmlTemplate:
      '<p><strong>High-priority issues found</strong> for {{siteUrl}}</p><p>This scheduled scan found critical or high severity issues.</p><p>Health score: {{healthScore}}</p><p>Open issues: {{issueCount}} | Critical: {{criticalCount}} | High: {{highCount}}</p><p>Top issues:<br>{{topIssues}}</p><p><a href="{{reportUrl}}">View report</a></p><p>You can change alert settings in Scanlark.</p>',
    textTemplate:
      "High-priority issues found for {{siteUrl}}\nHealth score: {{healthScore}}\nOpen issues: {{issueCount}}\nCritical: {{criticalCount}}\nHigh: {{highCount}}\n\nTop issues:\n{{topIssues}}\n\nView report: {{reportUrl}}\nYou can change alert settings in Scanlark.",
    variables: [
      ...COMMON_VARIABLES,
      "healthScore",
      "issueCount",
      "criticalCount",
      "highCount",
      "completedAt",
      "topIssues",
    ],
  },
  {
    key: "weekly_summary",
    name: "Weekly summary",
    description: "Sent for weekly scheduled scan summaries.",
    subjectTemplate: "Scanlark: weekly scan summary for {{siteName}}",
    htmlTemplate:
      '<p><strong>Weekly scan summary</strong> for {{siteUrl}}</p><p>Health score: {{healthScore}}</p><p>Open issues: {{issueCount}} | Critical: {{criticalCount}} | High: {{highCount}}</p><p>By severity: {{severityCounts}}</p><p>By category: {{categoryCounts}}</p><p>Top issues:<br>{{topIssues}}</p><p><a href="{{reportUrl}}">View report</a></p><p>You can change alert settings in Scanlark.</p>',
    textTemplate:
      "Weekly scan summary for {{siteUrl}}\nHealth score: {{healthScore}}\nOpen issues: {{issueCount}}\nCritical: {{criticalCount}}\nHigh: {{highCount}}\nBy severity: {{severityCounts}}\nBy category: {{categoryCounts}}\n\nTop issues:\n{{topIssues}}\n\nView report: {{reportUrl}}\nYou can change alert settings in Scanlark.",
    variables: [
      ...COMMON_VARIABLES,
      "healthScore",
      "issueCount",
      "criticalCount",
      "highCount",
      "completedAt",
      "severityCounts",
      "categoryCounts",
      "topIssues",
    ],
  },
  {
    key: "test_email",
    name: "Test email",
    description:
      "Sent from site notification settings or admin template testing.",
    subjectTemplate: "Scanlark: test alert for {{siteName}}",
    htmlTemplate:
      '<p>This is a test alert for {{siteUrl}}.</p><p>Health score: {{healthScore}}</p><p>Open issues: {{issueCount}}</p><p><a href="{{dashboardUrl}}">Open dashboard</a></p>',
    textTemplate:
      "This is a test alert for {{siteUrl}}.\nHealth score: {{healthScore}}\nOpen issues: {{issueCount}}\nOpen dashboard: {{dashboardUrl}}",
    variables: [
      ...COMMON_VARIABLES,
      "healthScore",
      "issueCount",
      "criticalCount",
      "highCount",
    ],
  },
  {
    key: "uptime_down",
    name: "Uptime down",
    description: "Reserved for future uptime-down transactional email alerts.",
    subjectTemplate: "Scanlark: availability down for {{siteName}}",
    htmlTemplate:
      '<p><strong>Availability down</strong> for {{siteUrl}}</p><p>{{checkUrl}} failed availability checks.</p><p><a href="{{dashboardUrl}}">Open dashboard</a></p>',
    textTemplate:
      "Availability down for {{siteUrl}}\n{{checkUrl}} failed availability checks.\nOpen dashboard: {{dashboardUrl}}",
    variables: [...COMMON_VARIABLES, "checkUrl", "incidentId", "uptimeStatus"],
  },
  {
    key: "uptime_recovered",
    name: "Uptime recovered",
    description:
      "Reserved for future uptime-recovered transactional email alerts.",
    subjectTemplate: "Scanlark: availability recovered for {{siteName}}",
    htmlTemplate:
      '<p><strong>Availability recovered</strong> for {{siteUrl}}</p><p>{{checkUrl}} is reachable again.</p><p><a href="{{dashboardUrl}}">Open dashboard</a></p>',
    textTemplate:
      "Availability recovered for {{siteUrl}}\n{{checkUrl}} is reachable again.\nOpen dashboard: {{dashboardUrl}}",
    variables: [...COMMON_VARIABLES, "checkUrl", "incidentId", "uptimeStatus"],
  },
  {
    key: "share_report_created",
    name: "Shared report created",
    description: "Reserved for future shared-report transactional emails.",
    subjectTemplate: "Scanlark: report shared for {{siteName}}",
    htmlTemplate:
      '<p>A Scanlark report was shared for {{siteUrl}}.</p><p><a href="{{reportUrl}}">View report</a></p>',
    textTemplate:
      "A Scanlark report was shared for {{siteUrl}}.\nView report: {{reportUrl}}",
    variables: [...COMMON_VARIABLES, "createdAt"],
  },
];

export const DEFAULT_EMAIL_TEMPLATE_BY_KEY = new Map(
  DEFAULT_EMAIL_TEMPLATES.map((template) => [template.key, template]),
);

export type EmailTemplateRow = {
  id: string;
  key: EmailTemplateKey;
  name: string;
  description: string;
  subject_template: string;
  html_template: string;
  text_template: string | null;
  enabled: boolean;
  version: number;
  created_at: Date;
  updated_at: Date;
  updated_by_user_id: string | null;
  updated_by_email: string | null;
  deleted_at: Date | null;
};

export function isEmailTemplateKey(value: string): value is EmailTemplateKey {
  return DEFAULT_EMAIL_TEMPLATE_BY_KEY.has(value as EmailTemplateKey);
}

function withVariables(row: EmailTemplateRow) {
  return {
    ...row,
    variables: DEFAULT_EMAIL_TEMPLATE_BY_KEY.get(row.key)?.variables ?? [],
  };
}

export async function listEmailTemplates(): Promise<
  Array<EmailTemplateRow & { variables: string[] }>
> {
  const client = await ensureConnected();
  const res = await client.query<EmailTemplateRow>(
    `
      SELECT
        t.*,
        u.email AS updated_by_email
      FROM email_templates t
      LEFT JOIN users u ON u.id = t.updated_by_user_id
      WHERE t.deleted_at IS NULL
      ORDER BY t.key ASC
    `,
  );
  return res.rows.map(withVariables);
}

export async function getEmailTemplate(
  key: EmailTemplateKey,
): Promise<(EmailTemplateRow & { variables: string[] }) | null> {
  const client = await ensureConnected();
  const res = await client.query<EmailTemplateRow>(
    `
      SELECT
        t.*,
        u.email AS updated_by_email
      FROM email_templates t
      LEFT JOIN users u ON u.id = t.updated_by_user_id
      WHERE t.key = $1
        AND t.deleted_at IS NULL
      LIMIT 1
    `,
    [key],
  );
  const row = res.rows[0] ?? null;
  return row ? withVariables(row) : null;
}

export async function updateEmailTemplate(
  key: EmailTemplateKey,
  input: {
    subjectTemplate: string;
    htmlTemplate: string;
    textTemplate: string | null;
    enabled: boolean;
    changedByUserId: string;
    changeNote?: string | null;
  },
): Promise<EmailTemplateRow & { variables: string[] }> {
  const client = await ensureConnected();
  await client.query("BEGIN");
  try {
    const existingRes = await client.query<EmailTemplateRow>(
      `
        SELECT *, NULL::text AS updated_by_email
        FROM email_templates
        WHERE key = $1
          AND deleted_at IS NULL
        FOR UPDATE
      `,
      [key],
    );
    const existing = existingRes.rows[0];
    if (!existing) throw new Error("email_template_not_found");

    const updatedRes = await client.query<EmailTemplateRow>(
      `
        UPDATE email_templates
        SET subject_template = $2,
            html_template = $3,
            text_template = $4,
            enabled = $5,
            version = version + 1,
            updated_at = NOW(),
            updated_by_user_id = $6
        WHERE key = $1
          AND deleted_at IS NULL
        RETURNING *, NULL::text AS updated_by_email
      `,
      [
        key,
        input.subjectTemplate,
        input.htmlTemplate,
        input.textTemplate,
        input.enabled,
        input.changedByUserId,
      ],
    );
    const updated = updatedRes.rows[0];
    if (!updated) throw new Error("email_template_update_failed");

    await client.query(
      `
        INSERT INTO email_template_versions (
          template_id,
          previous_subject_template,
          previous_html_template,
          previous_text_template,
          previous_enabled,
          next_subject_template,
          next_html_template,
          next_text_template,
          next_enabled,
          changed_by_user_id,
          change_note
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      `,
      [
        updated.id,
        existing.subject_template,
        existing.html_template,
        existing.text_template,
        existing.enabled,
        updated.subject_template,
        updated.html_template,
        updated.text_template,
        updated.enabled,
        input.changedByUserId,
        input.changeNote ?? null,
      ],
    );

    await client.query("COMMIT");
    return withVariables(updated);
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  }
}

export async function restoreDefaultEmailTemplate(
  key: EmailTemplateKey,
  input: { changedByUserId: string; changeNote?: string | null },
): Promise<EmailTemplateRow & { variables: string[] }> {
  const defaults = DEFAULT_EMAIL_TEMPLATE_BY_KEY.get(key);
  if (!defaults) throw new Error("email_template_default_not_found");
  return updateEmailTemplate(key, {
    subjectTemplate: defaults.subjectTemplate,
    htmlTemplate: defaults.htmlTemplate,
    textTemplate: defaults.textTemplate,
    enabled: true,
    changedByUserId: input.changedByUserId,
    changeNote: input.changeNote ?? "Restored default template",
  });
}
