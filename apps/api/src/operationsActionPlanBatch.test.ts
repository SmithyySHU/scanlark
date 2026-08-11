import assert from "node:assert/strict";
import test from "node:test";
import { parseOperationsReportActionPlanBatchUpdateInput } from "./operationsHelpers";

const actionId = "11111111-1111-4111-8111-111111111111";
const observationId = "22222222-2222-4222-8222-222222222222";

test("parses one revision-bound Action Plan workspace batch", () => {
  assert.deepEqual(
    parseOperationsReportActionPlanBatchUpdateInput({
      expectedRevision: 7,
      actionPlanItems: [
        {
          id: actionId,
          groupKey: "address_soon",
          summary: "Updated summary",
        },
      ],
      positiveObservations: [
        {
          id: observationId,
          title: "Updated observation",
          isIncluded: true,
        },
      ],
    }),
    {
      expectedRevision: 7,
      actionPlanItems: [
        {
          id: actionId,
          groupKey: "address_soon",
          summary: "Updated summary",
          displayOrder: undefined,
        },
      ],
      positiveObservations: [
        {
          id: observationId,
          title: "Updated observation",
          isIncluded: true,
          displayOrder: undefined,
        },
      ],
    },
  );
});

test("requires one top-level revision and rejects child revision tokens", () => {
  assert.throws(
    () =>
      parseOperationsReportActionPlanBatchUpdateInput({
        actionPlanItems: [],
        positiveObservations: [],
      }),
    /invalid_expected_revision/,
  );
  assert.throws(
    () =>
      parseOperationsReportActionPlanBatchUpdateInput({
        expectedRevision: 7,
        actionPlanItems: [{ id: actionId, expectedRevision: 7 }],
        positiveObservations: [],
      }),
    /invalid_action_plan_item_revision/,
  );
});

test("rejects oversized Action Plan batches as invalid input", () => {
  assert.throws(
    () =>
      parseOperationsReportActionPlanBatchUpdateInput({
        expectedRevision: 7,
        actionPlanItems: Array.from({ length: 251 }, () => ({ id: actionId })),
        positiveObservations: [],
      }),
    /invalid_action_plan_batch_size/,
  );
});
