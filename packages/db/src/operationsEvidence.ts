import type { OperationsCommunicationStatus } from "./operationsCommunications";
import type { OperationsQuoteStatus } from "./operationsQuotesWork";
import type { OperationsReportStatus } from "./operationsReports";

export const IMMUTABLE_ARTIFACT_ERROR = "artifact_immutable" as const;
export const STALE_REVISION_ERROR = "stale_revision" as const;

export const HISTORICAL_REPORT_STATUSES = [
  "sent",
  "client_replied",
  "fixes_quoted",
  "work_in_progress",
  "completed",
  "archived",
] as const satisfies readonly OperationsReportStatus[];

export const HISTORICAL_QUOTE_STATUSES = [
  "sent",
  "accepted",
  "declined",
  "expired",
  "cancelled",
  "converted_to_work",
] as const satisfies readonly OperationsQuoteStatus[];

export const HISTORICAL_COMMUNICATION_STATUSES = [
  "sent",
  "received",
] as const satisfies readonly OperationsCommunicationStatus[];

export function isHistoricalReportStatus(status: OperationsReportStatus) {
  return (HISTORICAL_REPORT_STATUSES as readonly string[]).includes(status);
}

export function isHistoricalQuoteStatus(status: OperationsQuoteStatus) {
  return (HISTORICAL_QUOTE_STATUSES as readonly string[]).includes(status);
}

export function isHistoricalCommunicationStatus(
  status: OperationsCommunicationStatus,
) {
  return (HISTORICAL_COMMUNICATION_STATUSES as readonly string[]).includes(
    status,
  );
}

export function immutableArtifactError(kind: string) {
  return new Error(`${IMMUTABLE_ARTIFACT_ERROR}:${kind}`);
}

export function staleRevisionError(kind: string) {
  return new Error(`${STALE_REVISION_ERROR}:${kind}`);
}
