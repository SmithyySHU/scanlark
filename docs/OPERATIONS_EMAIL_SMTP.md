# Operations Email delivery and finalisation boundaries (Checkpoints 5–6)

Checkpoint 5 queues and submits frozen MIME to the configured outgoing SMTP
server. Checkpoint 6 independently reconciles accepted real deliveries into CRM
and appends their exact frozen MIME to the IONOS Sent folder. Neither
post-acceptance process can send recipient email.

## Local enablement and test workflow

The module flag is read by the API and worker from the repository-root `.env`
file. For local development:

1. Apply all migrations in sorted order, including
   `049_operations_email_crm_finalisation.sql`.
2. In the root `.env`, set `OPERATIONS_EMAIL_MODULE_ENABLED=true`. Keep
   `OPERATIONS_EMAIL_REAL_SEND_MODE=disabled` for local Checkpoint 5 testing.
3. Restart `npm run dev:api` so the server reloads the flag. Restart
   `npm run dev:worker` after adding or changing SMTP configuration. The Vite
   `npm run dev:web` process does not consume this server flag, so a browser
   reload is sufficient; restarting it is harmless if the complete local stack
   is being restarted.
4. No web rebuild is required while using the Vite development server. A
   production/static web deployment still requires its normal build after code
   changes, but changing this server flag alone does not require a web rebuild.
5. Confirm that the signed-in user has an active membership in the
   `scanlark-operations` internal workspace with role `owner`,
   `operations_admin`, or `operations_member`. `viewer`, inactive, and missing
   memberships do not receive the Email capability. This can be checked without
   exposing credentials:

   ```sql
   SELECT u.email, membership.role, membership.is_active
   FROM internal_workspace_memberships membership
   JOIN internal_workspaces workspace ON workspace.id = membership.workspace_id
   JOIN users u ON u.id = membership.user_id
   WHERE workspace.code = 'scanlark-operations'
     AND lower(u.email) = lower('<signed-in-email>');
   ```

6. Reload the authenticated app and open `/operations/email` directly. The
   Email navigation item and the safe module/SMTP status area should be visible.

Drafting, editor previews, attachment preparation, and standalone draft
creation continue to work when SMTP is not configured. Send Test and Send Email
remain unavailable until SMTP is configured and recently verified. To exercise
the controlled test path, create a standalone draft with **New email**, complete
and save it, open **Final email preview**, then use **Send test**. Test sending
derives the recipient from the signed-in actor and does not require a business
or source Communication.

## Standalone recipients and optional CRM linkage

The To field accepts any syntactically valid email address. Draft creation,
saving, previewing, manual attachments, test sending, and normal standalone
delivery do not require a business, contact, or source Communication.

SMTP rollout policy remains independent of CRM linkage. During development,
test delivery is still restricted to the authenticated actor's derived
allowlisted address, and normal delivery is still governed by
`OPERATIONS_EMAIL_REAL_SEND_MODE` and its recipient allowlist. These checks are
server-side delivery safeguards; they do not require or infer a client record.

For Checkpoint 6 CRM finalization:

- a successfully delivered message that is linked to a business/contact will
  create the immutable sent Communication event in that client's timeline;
- a successfully delivered unlinked standalone message will remain recorded in
  Email without creating a placeholder business or Communication;
- the sent Email UI exposes **Link to business/contact** so an operator
  can attribute an unlinked record explicitly and auditably;
- messages transferred from Communications retain their existing source
  business/contact linkage automatically.

## Nodemailer boundary

The worker calls `transport.sendMail({ envelope, raw })` with the exact frozen
MIME bytes. Nodemailer owns connection setup, SMTP envelope commands, DATA, MIME
streaming, and the final SMTP response inside that single promise. The worker
therefore records `transmission_may_have_begun = true` immediately before it
calls `sendMail`. A worker exit from that point onwards is conservatively
recovered as `delivery_uncertain`.

The outcome boundary is:

- **Definitely not sent:** `sendMail` rejects with conclusive Nodemailer command
  evidence that failure occurred during connection or the SMTP envelope, before
  DATA. This includes connection failure, authentication failure, MAIL FROM or
  RCPT TO rejection, a pre-DATA 4xx response, and a timeout explicitly attached
  to a pre-DATA command. Only clearly transient cases receive bounded automatic
  retry. Authentication, configuration, invalid-recipient, and permanent 5xx
  cases require correction and explicit manual retry.
- **Accepted:** `sendMail` resolves and its `accepted` result contains the one
  intended envelope recipient. The UI describes this only as “Accepted by
  outgoing mail server”; it does not claim recipient delivery or reading.
- **Uncertain:** any DATA/post-DATA error, timeout, disconnect, unknown command,
  missing phase evidence, worker interruption after the risk marker, or resolved
  response that cannot safely prove a pre-transmission failure. Uncertain
  deliveries have retry policy `never` and cannot be manually or automatically
  requeued.

Nodemailer response text is not exposed to operators. Only bounded safe error
messages, normalized command/code tokens, and response classes are retained.

## Frozen-message and retry rules

Date, Message-ID, From, Reply-To, recipient, subject, rendered bodies,
attachments, and the complete raw MIME are assigned once when the delivery is
queued. The SHA-256 digest is checked again before submission. Automatic and
manual retries reuse those exact bytes; they never rebuild the render or replace
attachments.

One real delivery row is allowed per Email message. The API also looks up the
existing row before rendering, and database uniqueness remains the concurrent
backstop. Test requests are idempotent by message and caller-supplied key.

## Test sends

The authenticated Operations actor's email address is the only possible test
recipient and must appear in `OPERATIONS_EMAIL_TEST_ALLOWED_RECIPIENTS`. The API
does not accept a browser-supplied test address. Test subjects and bodies are
visibly marked `[TEST]`, and their records are `delivery_kind = 'test'`.

Test acceptance does not change the Email message lifecycle, create a sent
Communication event, append an IONOS Sent copy, update last-contacted, complete
follow-ups, or change reports, quotes, or pipeline state.

## Rollout gates

`OPERATIONS_EMAIL_MODULE_ENABLED` defaults to `false` and protects the entire
module. `OPERATIONS_EMAIL_REAL_SEND_MODE` independently defaults to `disabled`:

- `disabled`: all real-send requests are blocked;
- `allowlist`: only addresses in
  `OPERATIONS_EMAIL_REAL_SEND_ALLOWED_RECIPIENTS` are permitted;
- `live`: valid ready messages may be queued for their stored recipient.

The worker verifies SMTP with Nodemailer's `verify()` without sending a message.
Queue actions require a recent safe readiness record. Credentials and raw MIME
are never returned by readiness, history, or configuration endpoints.

## CRM finalisation after acceptance

SMTP acceptance creates one reconciliation row in the same database statement.
Linked messages are claimed with a lease and finalised atomically: exactly one
immutable sent Communication is created or reused, the Email is linked to it,
and the business `last_contacted_at` is advanced to the SMTP acceptance time.
The source Communication draft is never edited. Existing source-link queries
therefore derive its “Sent through Email” annotation and both links from the
reverse Email relationship.

Unlinked standalone sends are `not_required` and create no placeholder CRM
records. A later actor-selected business/contact link changes only attribution;
the frozen recipient and content remain unchanged. Contact-recipient mismatches
must be shown for explicit confirmation and are retained in the audit trail.

No additional follow-up or pipeline automation is introduced here. The current
manual mark-sent workflow remains available and retains its existing side
effects; direct-send finalisation does not complete unrelated follow-ups.

## IONOS Sent-folder append boundary

The IMAP worker only claims real deliveries already marked SMTP `sent`; test
deliveries are never eligible. On every attempt it verifies the SHA-256 of the
stored raw MIME, validates the fixed Message-ID, connects to IMAP, and resolves
the destination using either the configured exact mailbox path or exactly one
mailbox advertised with `\\Sent`. It never creates, renames, moves, or deletes a
mailbox.

After opening the destination, the worker searches for the fixed Message-ID.
An existing match is recorded as success without appending. Otherwise it appends
the exact stored bytes with `\\Seen`, then records the returned UID (or confirms
the UID with another Message-ID search). Transient IMAP failures receive bounded
retry; credential, mailbox-discovery, Message-ID, and MIME-integrity failures
stop for correction and explicit manual retry. The manual action is a Sent-copy
retry only and cannot requeue SMTP.

The browser receives only configured/available state and safe errors. Host,
username, password, resolved mailbox hierarchy, raw MIME, and provider error
text remain server/worker-only.
