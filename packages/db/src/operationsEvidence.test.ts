import assert from "node:assert/strict";
import test from "node:test";
import {
  HISTORICAL_COMMUNICATION_STATUSES,
  HISTORICAL_QUOTE_STATUSES,
  HISTORICAL_REPORT_STATUSES,
  isHistoricalCommunicationStatus,
  isHistoricalQuoteStatus,
  isHistoricalReportStatus,
} from "./operationsEvidence";

test("historical report states are final and complete", () => {
  assert.deepEqual(
    [...HISTORICAL_REPORT_STATUSES],
    [
      "sent",
      "client_replied",
      "fixes_quoted",
      "work_in_progress",
      "completed",
      "archived",
    ],
  );
  assert.equal(isHistoricalReportStatus("sent"), true);
  assert.equal(isHistoricalReportStatus("draft"), false);
});

test("historical quote states include sent and every post-send state", () => {
  assert.deepEqual(
    [...HISTORICAL_QUOTE_STATUSES],
    [
      "sent",
      "accepted",
      "declined",
      "expired",
      "cancelled",
      "converted_to_work",
    ],
  );
  assert.equal(isHistoricalQuoteStatus("sent"), true);
  assert.equal(isHistoricalQuoteStatus("ready_to_send"), false);
});

test("only sent and received Communications are historical evidence", () => {
  assert.deepEqual(
    [...HISTORICAL_COMMUNICATION_STATUSES],
    ["sent", "received"],
  );
  assert.equal(isHistoricalCommunicationStatus("sent"), true);
  assert.equal(isHistoricalCommunicationStatus("received"), true);
  assert.equal(isHistoricalCommunicationStatus("cancelled"), false);
});
