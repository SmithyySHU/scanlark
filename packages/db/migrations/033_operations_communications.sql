CREATE TABLE IF NOT EXISTS operations_client_communication_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  system_key text UNIQUE,
  name text NOT NULL,
  category text NOT NULL,
  subject_template text NOT NULL,
  body_template text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  is_system_default boolean NOT NULL DEFAULT false,
  created_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT operations_client_communication_templates_name_present_check
    CHECK (length(trim(name)) > 0),
  CONSTRAINT operations_client_communication_templates_subject_present_check
    CHECK (length(trim(subject_template)) > 0),
  CONSTRAINT operations_client_communication_templates_body_present_check
    CHECK (length(trim(body_template)) > 0),
  CONSTRAINT operations_client_communication_templates_category_check
    CHECK (category IN (
      'warm_introduction',
      'cold_outreach',
      'report_offer',
      'report_delivery',
      'no_reply_follow_up',
      'interested_reply',
      'pre_quote_questions',
      'quote_delivery',
      'access_request',
      'work_started',
      'work_completed',
      'monitoring_offer',
      'monthly_update',
      'testimonial_request',
      'referral_request',
      'custom'
    ))
);

CREATE INDEX IF NOT EXISTS operations_client_communication_templates_active_idx
  ON operations_client_communication_templates(is_active, category, updated_at DESC);

CREATE INDEX IF NOT EXISTS operations_client_communication_templates_category_idx
  ON operations_client_communication_templates(category, name);

CREATE TABLE IF NOT EXISTS operations_communications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES operations_businesses(id) ON DELETE CASCADE,
  contact_id uuid REFERENCES operations_contacts(id) ON DELETE SET NULL,
  template_id uuid REFERENCES operations_client_communication_templates(id) ON DELETE SET NULL,
  direction text NOT NULL DEFAULT 'outbound',
  channel text NOT NULL DEFAULT 'email',
  status text NOT NULL DEFAULT 'draft',
  subject text,
  body text NOT NULL,
  sent_at timestamptz,
  received_at timestamptz,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  follow_up_at timestamptz,
  follow_up_completed_at timestamptz,
  external_message_id text,
  created_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT operations_communications_body_present_check
    CHECK (length(trim(body)) > 0),
  CONSTRAINT operations_communications_direction_check
    CHECK (direction IN ('outbound', 'inbound', 'internal_note')),
  CONSTRAINT operations_communications_channel_check
    CHECK (channel IN ('email', 'phone', 'video_call', 'in_person', 'other')),
  CONSTRAINT operations_communications_status_check
    CHECK (status IN ('draft', 'ready', 'sent', 'received', 'cancelled')),
  CONSTRAINT operations_communications_sent_status_check
    CHECK (status <> 'sent' OR sent_at IS NOT NULL),
  CONSTRAINT operations_communications_received_status_check
    CHECK (status <> 'received' OR received_at IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS operations_communications_business_occurred_idx
  ON operations_communications(business_id, occurred_at DESC);

CREATE INDEX IF NOT EXISTS operations_communications_contact_idx
  ON operations_communications(contact_id, occurred_at DESC)
  WHERE contact_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS operations_communications_template_idx
  ON operations_communications(template_id)
  WHERE template_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS operations_communications_follow_up_idx
  ON operations_communications(follow_up_at)
  WHERE follow_up_at IS NOT NULL AND follow_up_completed_at IS NULL;

CREATE INDEX IF NOT EXISTS operations_communications_status_idx
  ON operations_communications(status, occurred_at DESC);

CREATE TABLE IF NOT EXISTS operations_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES operations_businesses(id) ON DELETE CASCADE,
  contact_id uuid REFERENCES operations_contacts(id) ON DELETE SET NULL,
  source_communication_id uuid REFERENCES operations_communications(id) ON DELETE SET NULL,
  title text NOT NULL,
  notes text,
  due_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'open',
  completed_at timestamptz,
  snoozed_until timestamptz,
  created_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT operations_tasks_title_present_check
    CHECK (length(trim(title)) > 0),
  CONSTRAINT operations_tasks_status_check
    CHECK (status IN ('open', 'completed', 'snoozed', 'cancelled')),
  CONSTRAINT operations_tasks_completed_status_check
    CHECK (status <> 'completed' OR completed_at IS NOT NULL),
  CONSTRAINT operations_tasks_snoozed_status_check
    CHECK (status <> 'snoozed' OR snoozed_until IS NOT NULL)
);

CREATE UNIQUE INDEX IF NOT EXISTS operations_tasks_source_communication_unique_idx
  ON operations_tasks(source_communication_id)
  WHERE source_communication_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS operations_tasks_due_idx
  ON operations_tasks(status, due_at)
  WHERE status IN ('open', 'snoozed');

CREATE INDEX IF NOT EXISTS operations_tasks_business_idx
  ON operations_tasks(business_id, status, due_at);

CREATE INDEX IF NOT EXISTS operations_tasks_contact_idx
  ON operations_tasks(contact_id)
  WHERE contact_id IS NOT NULL;

INSERT INTO operations_client_communication_templates (
  system_key,
  name,
  category,
  subject_template,
  body_template,
  is_system_default
)
VALUES
  (
    'warm_introduction',
    'Warm introduction',
    'warm_introduction',
    'Website health check for {{businessName}}',
    'Hi {{firstName}},

I hope you are well. I am reaching out because I am currently helping a small number of businesses find website issues before visitors run into them.

For {{businessName}}, I can prepare a practical website health check covering broken links, missing resources, page errors and other issues that can affect trust.

There is no pressure or obligation. If useful, I can send over a short report with the main findings.

Best,
{{senderName}}',
    true
  ),
  (
    'personalized_cold_outreach',
    'Personalized cold outreach',
    'cold_outreach',
    'A quick website observation for {{businessName}}',
    'Hi {{firstName}},

I was reviewing {{websiteDomain}} and noticed this item worth checking:

{{topFinding}}

Scanlark helps identify broken links, missing resources, website errors and other issues that can affect visitors and trust. I am currently offering a small number of free website health reports for businesses that would find this useful.

No obligation, and I am not promising rankings, revenue gains or legal compliance. The report is simply a practical review of website health issues.

Best,
{{senderName}}',
    true
  ),
  (
    'report_offer',
    'Report offer',
    'report_offer',
    'Website health report for {{businessName}}',
    'Hi {{firstName}},

I can prepare a short Scanlark website health report for {{businessName}} covering broken links, missing resources, visible errors and high-priority technical issues.

If you would like me to send one over, just reply and I will put it together.

Best,
{{senderName}}',
    true
  ),
  (
    'report_delivery',
    'Report delivery',
    'report_delivery',
    'Your website health report - {{businessName}}',
    'Hi {{firstName}},

I have attached the website health report for {{businessName}}.

The main item to review first is:

{{topFinding}}

The report also includes {{criticalIssueCount}} critical and {{highIssueCount}} high-priority open issue(s), where applicable.

If you would like help deciding what to fix first, reply here and I can outline the practical next steps.

Best,
{{senderName}}',
    true
  ),
  (
    'no_reply_follow_up',
    'No-reply follow-up',
    'no_reply_follow_up',
    'Re: Website health check for {{businessName}}',
    'Hi {{firstName}},

Just following up on my note about a website health check for {{businessName}}.

If it is useful, I can send over a concise report showing broken links, missing resources, page errors and other issues worth reviewing.

If now is not the right time, no problem.

Best,
{{senderName}}',
    true
  ),
  (
    'interested_reply',
    'Interested reply',
    'interested_reply',
    'Re: Website health report for {{businessName}}',
    'Hi {{firstName}},

Thanks for getting back to me.

I will review {{websiteDomain}} and prepare a practical website health report for {{businessName}}. I will focus on issues that are visible to visitors or likely to affect trust, such as broken links, missing files, page errors and high-priority technical problems.

I will send it over when it is ready.

Best,
{{senderName}}',
    true
  ),
  (
    'pre_quote_questions',
    'Pre-quote questions',
    'pre_quote_questions',
    'A few questions before quoting {{businessName}}',
    'Hi {{firstName}},

Before I put together a quote, could you confirm a few details?

1. Which website issues would you most like fixed first?
2. Do you have access to the website CMS, hosting or developer account?
3. Are there any pages or sections that should not be changed?
4. Is there a deadline I should be aware of?

Once I have that, I can suggest a focused scope.

Best,
{{senderName}}',
    true
  ),
  (
    'work_completed',
    'Work completed',
    'work_completed',
    'Website fixes completed - {{businessName}}',
    'Hi {{firstName}},

The agreed website fixes for {{businessName}} are now complete.

I recommend reviewing the affected pages and letting me know if anything looks different from what you expected.

I can also run a fresh Scanlark check afterwards to confirm the key issues have cleared.

Best,
{{senderName}}',
    true
  ),
  (
    'monitoring_offer',
    'Monitoring offer',
    'monitoring_offer',
    'Ongoing website monitoring for {{businessName}}',
    'Hi {{firstName}},

Now that the website health report is ready, I can also monitor {{websiteDomain}} on an ongoing basis.

That means Scanlark can keep checking for broken links, missing resources, website errors and availability problems so issues are easier to catch before customers do.

If you would like ongoing monitoring, reply here and I can outline the options.

Best,
{{senderName}}',
    true
  )
ON CONFLICT (system_key) DO NOTHING;
