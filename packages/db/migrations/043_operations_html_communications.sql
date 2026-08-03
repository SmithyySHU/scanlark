ALTER TABLE operations_client_communication_templates
  ADD COLUMN IF NOT EXISTS preheader_template text,
  ADD COLUMN IF NOT EXISTS html_body_template text,
  ADD COLUMN IF NOT EXISTS plain_text_template text,
  ADD COLUMN IF NOT EXISTS layout_key text NOT NULL DEFAULT 'personal_letter',
  ADD COLUMN IF NOT EXISTS content_variants_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS subject_suggestions_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS attachment_policy text NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS signature_mode text NOT NULL DEFAULT 'include_scanlark_signature';

ALTER TABLE operations_communications
  ADD COLUMN IF NOT EXISTS preheader text,
  ADD COLUMN IF NOT EXISTS html_fragment text,
  ADD COLUMN IF NOT EXISTS html_document text,
  ADD COLUMN IF NOT EXISTS plain_text_body text,
  ADD COLUMN IF NOT EXISTS layout_key text,
  ADD COLUMN IF NOT EXISTS wording_variant_key text,
  ADD COLUMN IF NOT EXISTS signature_mode text,
  ADD COLUMN IF NOT EXISTS sender_identity_key text,
  ADD COLUMN IF NOT EXISTS sender_name text,
  ADD COLUMN IF NOT EXISTS sender_email text,
  ADD COLUMN IF NOT EXISTS recipient_name text,
  ADD COLUMN IF NOT EXISTS recipient_email text,
  ADD COLUMN IF NOT EXISTS template_snapshot_json jsonb,
  ADD COLUMN IF NOT EXISTS public_asset_urls_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS attachment_requirements_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS attachment_confirmed_at timestamptz,
  ADD COLUMN IF NOT EXISTS attachment_confirmation_note text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'operations_client_communication_templates_layout_key_check'
  ) THEN
    ALTER TABLE operations_client_communication_templates
      ADD CONSTRAINT operations_client_communication_templates_layout_key_check
      CHECK (layout_key IN ('personal_letter', 'report_delivery', 'commercial_document', 'status_alert'));
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'operations_client_communication_templates_attachment_policy_check'
  ) THEN
    ALTER TABLE operations_client_communication_templates
      ADD CONSTRAINT operations_client_communication_templates_attachment_policy_check
      CHECK (attachment_policy IN ('none', 'client_report_pdf', 'quote_pdf', 'updated_report_pdf'));
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'operations_client_communication_templates_signature_mode_check'
  ) THEN
    ALTER TABLE operations_client_communication_templates
      ADD CONSTRAINT operations_client_communication_templates_signature_mode_check
      CHECK (signature_mode IN ('include_scanlark_signature', 'use_mailbox_signature'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS operations_client_communication_templates_layout_idx
  ON operations_client_communication_templates(layout_key, category, is_active);

INSERT INTO operations_client_communication_templates (
  system_key,
  name,
  category,
  subject_template,
  preheader_template,
  body_template,
  html_body_template,
  plain_text_template,
  layout_key,
  content_variants_json,
  subject_suggestions_json,
  attachment_policy,
  signature_mode,
  default_follow_up_business_days,
  is_system_default
)
VALUES
  (
    'html_personalised_website_observation',
    'Personalised website observation',
    'cold_outreach',
    'A quick website observation for {{businessName}}',
    'A brief note from Connor at Scanlark about {{websiteDomain}}.',
    'Hi {{firstName}},

I am Connor, the person behind Scanlark. I was reviewing {{websiteDomain}} and noticed this worth checking:

{{topFinding}}

I can send a concise website health report for {{businessName}} if useful. There is no obligation, and the report is a practical review rather than a promise about rankings, sales or compliance.

If you would prefer not to hear from me again, just reply and let me know.',
    '<p>Hi {{firstName}},</p><p>I am Connor, the person behind Scanlark. I was reviewing {{websiteDomain}} and noticed this worth checking:</p><p><strong>{{topFinding}}</strong></p><p>I can send a concise website health report for {{businessName}} if useful. There is no obligation, and the report is a practical review rather than a promise about rankings, sales or compliance.</p><p>If you would prefer not to hear from me again, just reply and let me know.</p>',
    'Hi {{firstName}},

I am Connor, the person behind Scanlark. I was reviewing {{websiteDomain}} and noticed this worth checking:

{{topFinding}}

I can send a concise website health report for {{businessName}} if useful. There is no obligation, and the report is a practical review rather than a promise about rankings, sales or compliance.

If you would prefer not to hear from me again, just reply and let me know.',
    'personal_letter',
    '[{"key":"brief","label":"Brief and direct","body":"Hi {{firstName}},\n\nI am Connor from Scanlark. I was reviewing {{websiteDomain}} and noticed this worth checking:\n\n{{topFinding}}\n\nIf useful, I can send a concise website health report for {{businessName}}. No obligation, and no inflated claims.\n\nIf you would prefer not to hear from me again, just reply and let me know."},{"key":"warm","label":"Warm and conversational","body":"Hi {{firstName}},\n\nI am Connor, the person behind Scanlark. I was reviewing {{websiteDomain}} and noticed this worth checking:\n\n{{topFinding}}\n\nI can send a concise website health report for {{businessName}} if useful. There is no obligation, and the report is a practical review rather than a promise about rankings, sales or compliance.\n\nIf you would prefer not to hear from me again, just reply and let me know."}]'::jsonb,
    '["A quick website observation for {{businessName}}","I noticed something on {{websiteDomain}}","A short website health check for {{businessName}}"]'::jsonb,
    'none',
    'include_scanlark_signature',
    4,
    true
  ),
  (
    'html_report_delivery',
    'Report delivery',
    'report_delivery',
    'Your website health report - {{businessName}}',
    'The Scanlark report for {{businessName}} is ready to review.',
    'Hi {{firstName}},

I have attached the website health report for {{businessName}}.

The report groups findings so the main items are easier to review. The current summary includes {{criticalIssueCount}} critical and {{importantIssueCount}} important item(s), where applicable.

A useful place to start is:

{{topFinding}}

If you would like, reply here and I can explain the findings and the practical next steps.',
    '<p>Hi {{firstName}},</p><p>I have attached the website health report for {{businessName}}.</p><p>The report groups findings so the main items are easier to review. The current summary includes <strong>{{criticalIssueCount}}</strong> critical and <strong>{{importantIssueCount}}</strong> important item(s), where applicable.</p><p>A useful place to start is:</p><p><strong>{{topFinding}}</strong></p><p>If you would like, reply here and I can explain the findings and the practical next steps.</p>',
    'Hi {{firstName}},

I have attached the website health report for {{businessName}}.

The report groups findings so the main items are easier to review. The current summary includes {{criticalIssueCount}} critical and {{importantIssueCount}} important item(s), where applicable.

A useful place to start is:

{{topFinding}}

If you would like, reply here and I can explain the findings and the practical next steps.',
    'report_delivery',
    '[{"key":"brief","label":"Brief and direct"},{"key":"consultative","label":"Detailed and consultative"}]'::jsonb,
    '["Your website health report - {{businessName}}","Website health report for {{businessName}}","{{businessName}} report attached"]'::jsonb,
    'client_report_pdf',
    'include_scanlark_signature',
    3,
    true
  ),
  (
    'html_quote_delivery',
    'Quote delivery',
    'quote_delivery',
    'Quote {{quoteNumber}} for {{businessName}}',
    'Quote {{quoteNumber}} is attached for review.',
    'Hi {{firstName}},

I have attached quote {{quoteNumber}} for {{businessName}}.

Scope summary:
{{quoteScope}}

Total: {{quoteTotal}}
Valid until: {{quoteValidUntil}}

If you are happy with the scope, reply to confirm or send over any questions. Work will not begin until the scope is agreed.',
    '<p>Hi {{firstName}},</p><p>I have attached quote <strong>{{quoteNumber}}</strong> for {{businessName}}.</p><p><strong>Scope summary</strong><br>{{quoteScope}}</p><p><strong>Total:</strong> {{quoteTotal}}<br><strong>Valid until:</strong> {{quoteValidUntil}}</p><p>If you are happy with the scope, reply to confirm or send over any questions. Work will not begin until the scope is agreed.</p>',
    'Hi {{firstName}},

I have attached quote {{quoteNumber}} for {{businessName}}.

Scope summary:
{{quoteScope}}

Total: {{quoteTotal}}
Valid until: {{quoteValidUntil}}

If you are happy with the scope, reply to confirm or send over any questions. Work will not begin until the scope is agreed.',
    'commercial_document',
    '[{"key":"brief","label":"Brief and direct"},{"key":"consultative","label":"Detailed and consultative"}]'::jsonb,
    '["Quote {{quoteNumber}} for {{businessName}}","{{businessName}} quote attached","Scope and quote for {{businessName}}"]'::jsonb,
    'quote_pdf',
    'include_scanlark_signature',
    5,
    true
  ),
  (
    'html_important_website_issue',
    'Important website issue',
    'website_issue_notification',
    'Important website issue on {{websiteDomain}}',
    'A calm summary of an important issue found on {{websiteDomain}}.',
    'Hi {{firstName}},

I noticed an important issue affecting {{websiteDomain}}:

{{topFindingTitle}}

Known current impact:
{{topFinding}}

Observation time: {{observationTime}}

Recommended next action:
Review the affected page or system area and confirm whether you would like Scanlark to investigate further.',
    '<p>Hi {{firstName}},</p><p>I noticed an important issue affecting {{websiteDomain}}:</p><p><strong>{{topFindingTitle}}</strong></p><p><strong>Known current impact</strong><br>{{topFinding}}</p><p><strong>Observation time</strong><br>{{observationTime}}</p><p><strong>Recommended next action</strong><br>Review the affected page or system area and confirm whether you would like Scanlark to investigate further.</p>',
    'Hi {{firstName}},

I noticed an important issue affecting {{websiteDomain}}:

{{topFindingTitle}}

Known current impact:
{{topFinding}}

Observation time: {{observationTime}}

Recommended next action:
Review the affected page or system area and confirm whether you would like Scanlark to investigate further.',
    'status_alert',
    '[{"key":"brief","label":"Brief and direct"},{"key":"warm","label":"Warm and conversational"}]'::jsonb,
    '["Important website issue on {{websiteDomain}}","Issue found on {{websiteDomain}}","{{businessName}} website issue to review"]'::jsonb,
    'none',
    'include_scanlark_signature',
    2,
    true
  )
ON CONFLICT (system_key) DO UPDATE SET
  name = EXCLUDED.name,
  category = EXCLUDED.category,
  subject_template = EXCLUDED.subject_template,
  preheader_template = EXCLUDED.preheader_template,
  body_template = EXCLUDED.body_template,
  html_body_template = EXCLUDED.html_body_template,
  plain_text_template = EXCLUDED.plain_text_template,
  layout_key = EXCLUDED.layout_key,
  content_variants_json = EXCLUDED.content_variants_json,
  subject_suggestions_json = EXCLUDED.subject_suggestions_json,
  attachment_policy = EXCLUDED.attachment_policy,
  signature_mode = EXCLUDED.signature_mode,
  default_follow_up_business_days = EXCLUDED.default_follow_up_business_days,
  is_system_default = EXCLUDED.is_system_default,
  updated_at = now();
