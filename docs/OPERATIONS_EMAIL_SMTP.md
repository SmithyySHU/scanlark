# Operations Email SMTP boundary (Checkpoint 5)

Checkpoint 5 queues and submits frozen MIME to the configured outgoing SMTP
server. It does not append to the IONOS Sent folder or finalize CRM state; those
remain Checkpoint 6 work.

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
