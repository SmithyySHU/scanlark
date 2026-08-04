import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  appendExactOperationsEmailSentCopy,
  resolveOperationsEmailSentMailbox,
} from "./operationsEmailSentCopy";

const sentCopySource = readFileSync(
  new URL("./operationsEmailSentCopy.ts", import.meta.url),
  "utf8",
);
const finalisationSource = readFileSync(
  new URL("./operationsEmailFinalisation.ts", import.meta.url),
  "utf8",
);

test("Sent-copy worker has no SMTP transport or requeue dependency", () => {
  for (const forbidden of [
    "createOperationsEmailTransport",
    "sendFrozenOperationsEmailMime",
    "requeueOperationsEmailDeliveryWithFrozenMime",
    "recordOperationsEmailSmtpAcceptance",
  ])
    assert.equal(sentCopySource.includes(forbidden), false, forbidden);
});

test("CRM finalisation worker has no SMTP transport or queue dependency", () => {
  for (const forbidden of [
    "createOperationsEmailTransport",
    "sendFrozenOperationsEmailMime",
    "claimDueOperationsEmailSmtpDelivery",
    "requeueOperationsEmailDeliveryWithFrozenMime",
  ])
    assert.equal(finalisationSource.includes(forbidden), false, forbidden);
});

test("configured Sent mailbox must be an exact listed path", () => {
  const mailboxes = [
    { path: "Inbox", specialUse: undefined },
    { path: "Sent Items", specialUse: "\\Sent" },
  ];
  assert.equal(
    resolveOperationsEmailSentMailbox(mailboxes as never, "Sent Items"),
    "Sent Items",
  );
  assert.throws(
    () => resolveOperationsEmailSentMailbox(mailboxes as never, "Sent"),
    /configured_sent_mailbox_not_found/,
  );
});

test("Message-ID is searched before append and an existing UID prevents duplication", async () => {
  const events: string[] = [];
  const raw = Buffer.from("Message-ID: <existing@example.test>\r\n\r\nfrozen");
  const result = await appendExactOperationsEmailSentCopy({
    client: {
      mailboxOpen: async () => {
        events.push("open");
      },
      search: async () => {
        events.push("search");
        return [42];
      },
      append: async () => {
        events.push("append");
        return { destination: "Sent", uid: 43 };
      },
    } as never,
    mailbox: "Sent",
    rawMimeBytes: raw,
    mimeSha256: createHash("sha256").update(raw).digest("hex"),
    fixedMessageId: "<existing@example.test>",
    dateHeader: new Date("2026-08-04T12:00:00.000Z"),
  });
  assert.deepEqual(events, ["open", "search"]);
  assert.deepEqual(result, { uid: 42, alreadyPresent: true });
});

test("append uses the exact frozen bytes, original date and fixed Message-ID search", async () => {
  const raw = Buffer.from(
    "Message-ID: <new@example.test>\r\nDate: fixed\r\n\r\nfrozen",
  );
  const date = new Date("2026-08-04T12:00:00.000Z");
  const submissions: Array<{ bytes: Buffer; flags: string[]; date: Date }> = [];
  const searches: unknown[] = [];
  const result = await appendExactOperationsEmailSentCopy({
    client: {
      mailboxOpen: async () => undefined,
      search: async (query: unknown) => {
        searches.push(query);
        return [];
      },
      append: async (
        _mailbox: string,
        bytes: Buffer,
        flags: string[],
        sentDate: Date,
      ) => {
        submissions.push({ bytes, flags, date: sentDate });
        return { destination: "Sent", uid: 88 };
      },
    } as never,
    mailbox: "Sent",
    rawMimeBytes: raw,
    mimeSha256: createHash("sha256").update(raw).digest("hex"),
    fixedMessageId: "<new@example.test>",
    dateHeader: date,
  });
  assert.strictEqual(submissions[0]?.bytes, raw);
  assert.strictEqual(submissions[0]?.date, date);
  assert.deepEqual(submissions[0]?.flags, ["\\Seen"]);
  assert.deepEqual(searches, [
    { header: { "Message-ID": "<new@example.test>" } },
  ]);
  assert.deepEqual(result, { uid: 88, alreadyPresent: false });
});

test("hash mismatch blocks all IMAP operations", async () => {
  let calls = 0;
  await assert.rejects(
    appendExactOperationsEmailSentCopy({
      client: {
        mailboxOpen: async () => {
          calls += 1;
        },
      } as never,
      mailbox: "Sent",
      rawMimeBytes: Buffer.from("changed"),
      mimeSha256: "0".repeat(64),
      fixedMessageId: "<hash@example.test>",
      dateHeader: new Date("2026-08-04T12:00:00.000Z"),
    }),
    /hash_mismatch/,
  );
  assert.equal(calls, 0);
});

test("automatic discovery requires exactly one IMAP Sent special-use mailbox", () => {
  assert.equal(
    resolveOperationsEmailSentMailbox(
      [{ path: "Sent", specialUse: "\\Sent" }] as never,
      null,
    ),
    "Sent",
  );
  assert.throws(
    () => resolveOperationsEmailSentMailbox([] as never, null),
    /not_discovered/,
  );
  assert.throws(
    () =>
      resolveOperationsEmailSentMailbox(
        [
          { path: "Sent", specialUse: "\\Sent" },
          { path: "Sent Items", specialUse: "\\Sent" },
        ] as never,
        null,
      ),
    /ambiguous/,
  );
});
