import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import { buildOperationsEmailMime } from "./operationsEmailMime";

const bytes = Buffer.from("fixed attachment bytes");
const base = {
  from: { name: "Connor Smith", address: "connor@scanlark.com" },
  replyTo: "contact@scanlark.com",
  to: { name: "Élodie Client", address: "elodie@example.com" },
  subject: "Website report – August",
  date: new Date("2026-08-04T09:30:00.000Z"),
  messageId: "<fixed-operations-email@scanlark.com>",
  html: "<p>Hello</p>",
  plainText: "Hello",
  attachments: [
    {
      filename: "résumé report.pdf",
      contentType: "application/pdf",
      bytes,
      sha256: createHash("sha256").update(bytes).digest("hex"),
    },
  ],
  maxBytes: 1024 * 1024,
};

test("MIME has fixed headers, alternatives, mixed attachments and safe structure", async () => {
  const result = await buildOperationsEmailMime(base);
  const raw = result.raw.toString("utf8");
  assert.match(raw, /^From: Connor Smith <connor@scanlark\.com>/m);
  assert.match(raw, /^Reply-To: contact@scanlark\.com/m);
  assert.match(raw, /^To: =\?UTF-8\?/m);
  assert.match(raw, /^Subject: =\?UTF-8\?/m);
  assert.match(raw, /^Date: Tue, 04 Aug 2026 09:30:00 \+0000/m);
  assert.match(raw, /^Message-ID: <fixed-operations-email@scanlark\.com>/m);
  assert.match(raw, /multipart\/mixed/);
  assert.match(raw, /multipart\/alternative/);
  assert.match(raw, /text\/plain; charset=utf-8/);
  assert.match(raw, /text\/html; charset=utf-8/);
  assert.equal(/^Bcc:/im.test(raw), false);
  assert.equal(/(^|[^\r])\n/.test(raw), false);
  assert.equal(
    result.sha256,
    createHash("sha256").update(result.raw).digest("hex"),
  );
});

test("MIME omits multipart/mixed when there are no attachments", async () => {
  const result = await buildOperationsEmailMime({ ...base, attachments: [] });
  const raw = result.raw.toString("utf8");
  assert.equal(raw.includes("multipart/mixed"), false);
  assert.ok(raw.includes("multipart/alternative"));
});

test("attachment ordering is stable and unicode filenames are encoded", async () => {
  const second = Buffer.from("second");
  const result = await buildOperationsEmailMime({
    ...base,
    attachments: [
      {
        filename: "zeta.txt",
        contentType: "text/plain",
        bytes: second,
        sha256: createHash("sha256").update(second).digest("hex"),
      },
      base.attachments[0],
    ],
  });
  const raw = result.raw.toString("utf8");
  assert.ok(raw.indexOf("report.pdf") < raw.indexOf("zeta.txt"));
  assert.match(raw, /filename\*0\*=utf-8''/i);
});

test("missing bytes, hash changes and message limits block MIME creation", async () => {
  await assert.rejects(
    buildOperationsEmailMime({
      ...base,
      attachments: [{ ...base.attachments[0], bytes: Buffer.alloc(0) }],
    }),
    /mime_attachment_missing/,
  );
  await assert.rejects(
    buildOperationsEmailMime({
      ...base,
      attachments: [{ ...base.attachments[0], bytes: Buffer.from("changed") }],
    }),
    /mime_attachment_hash_mismatch/,
  );
  await assert.rejects(
    buildOperationsEmailMime({ ...base, maxBytes: 10 }),
    /mime_message_too_large/,
  );
  await assert.rejects(
    buildOperationsEmailMime({
      ...base,
      attachments: [{ ...base.attachments[0], filename: "../unsafe.pdf" }],
    }),
    /mime_attachment_filename_invalid/,
  );
});

test("one frozen raw buffer and hash are reused unchanged by both future consumers", async () => {
  const frozen = await buildOperationsEmailMime(base);
  const simulatedSmtp = frozen.raw;
  const simulatedSentAppend = frozen.raw;
  assert.strictEqual(simulatedSmtp, simulatedSentAppend);
  assert.equal(
    createHash("sha256").update(simulatedSmtp).digest("hex"),
    frozen.sha256,
  );
  assert.equal(
    createHash("sha256").update(simulatedSentAppend).digest("hex"),
    frozen.sha256,
  );
});
