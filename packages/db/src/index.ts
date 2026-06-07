export {
  createSite,
  createSiteForUser,
  deleteSite,
  deleteSiteForUser,
  getSiteById,
  getSiteByIdForUser,
  getSitesForUser,
  listSitesForUser,
  backfillSitesUserId,
} from "./sites";
export type { DbSiteRow } from "./sites";

export {
  computeNextScheduledAt,
  getDueSites,
  getSiteSchedule,
  getSiteScheduleForUser,
  markSiteScheduled,
  updateSiteSchedule,
  updateSiteScheduleForUser,
} from "./siteSchedule";
export type { SiteScheduleFields, ScheduleFrequency } from "./siteSchedule";

export {
  getLatestScanForSite,
  getLatestScanForSiteForUser,
  getLatestCompletedScanForSiteForUser,
  getRecentScansForSite,
  getRecentScansForSiteForUser,
  getScanRunById,
  getScanRunByIdForUser,
  setScanRunNotified,
} from "./scans";
export type { ScanRunRow, ScanStatus } from "./scans";

export {
  cancelScanRun,
  completeScanRun,
  createScanRun,
  getScanRunStatus,
  touchScanRun,
  setScanRunStatus,
  updateScanRunProgress,
} from "./scanRuns";
export type { LinkClassification, ScanRunSummary } from "./scanRuns";

export {
  getDiffBetweenRuns,
  getDiffBetweenRunsForUser,
  getRecentScanRunsForSite,
  getRecentScanRunsForSiteForUser,
} from "./scanRunsHistory";
export type { ScanLinkMinimalRow, ScanRunHistoryRow } from "./scanRunsHistory";

export {
  getBaselineRunForDiff,
  getCompletedRunForSite,
  getScanDiff,
} from "./scanDiff";
export type {
  ScanDiffChangeType,
  ScanDiffItem,
  ScanDiffMeta,
  ScanDiffRun,
  ScanDiffSide,
  ScanDiffSummary,
} from "./scanDiff";

export { getFixQueueForRuns } from "./fixQueue";
export type {
  FixQueueChangeType,
  FixQueueItem,
  FixQueueNote,
  FixQueueStatusFilter,
  FixQueueSummary,
} from "./fixQueue";

export {
  getResultsForScanRun,
  getResultsForScanRunForUser,
  getResultsSummaryForScanRun,
  getResultsSummaryForScanRunForUser,
  insertScanResult,
} from "./scanResults";
export type { ResultsSummary, ScanResultRow } from "./scanResults";

export {
  getOccurrencesForScanLink,
  getOccurrencesForScanLinkForUser,
  getScanLinkById,
  getScanLinkByIdForUser,
  getScanLinkByRunAndUrl,
  getScanLinkByRunAndUrlForUser,
  getScanLinksForExport,
  getScanLinksForExportForUser,
  getScanLinksForExportFiltered,
  getScanLinksForExportFilteredForUser,
  getScanLinksForRun,
  getScanLinksForRunForUser,
  getScanLinksSummary,
  getScanLinksSummaryForUser,
  getTimeoutCountForRun,
  getTimeoutCountForRunForUser,
  getTopLinksByClassification,
  getTopLinksByClassificationForUser,
  insertScanLinkOccurrence,
  updateScanLinkAfterRecheck,
  setScanLinkIgnoredForRun,
  setScanLinksIgnoredByIds,
  upsertScanLink,
} from "./scanLinksDedup";
export type {
  ExportClassification,
  PaginatedOccurrences,
  ScanLink,
  ScanLinkExportRow,
  ScanLinkOccurrence,
  ScanLinkOccurrenceRow,
} from "./scanLinksDedup";

export { applyIgnoreRulesForScanRun } from "./scanLinksIgnoreApply";

export {
  listIssuesForScanRunForUser,
  replaceIssuesForScanRun,
} from "./scanIssues";
export type {
  ScanIssue,
  ScanIssueCategory,
  ScanIssueSeverity,
  ScanIssueStatus,
  ScanIssueType,
  ScanIssuesSummary,
} from "./scanIssues";

export { upsertScanPageCheck } from "./scanPageChecks";
export type { ScanPageCheckInput, ScanPageCheckRow } from "./scanPageChecks";

export { upsertScanSiteCheck } from "./scanSiteChecks";
export type {
  ScanSiteCheckInput,
  ScanSiteCheckRow,
  ScanSiteCheckType,
} from "./scanSiteChecks";

export {
  deleteLinkNoteForSiteForUser,
  getLinkNoteForSiteByUrlForUser,
  listLinkNotesForSiteForUser,
  normalizeLinkUrl,
  updateLinkNoteForSiteForUser,
  upsertLinkNoteForSiteForUser,
} from "./linkNotes";
export type { LinkNote, LinkNoteStatus } from "./linkNotes";

export { enqueueEmailOutbox } from "./emailOutbox";
export type { EmailOutboxEntry } from "./emailOutbox";

export {
  cancelScanJob,
  claimNextScanJob,
  completeScanJob,
  enqueueScanJob,
  extendScanJobLease,
  failScanJob,
  getJobForScanRun,
  hasActiveJobForSite,
  requeueExpiredScanJobs,
  setScanJobRunId,
} from "./scanJobs";
export type { ScanJobRow, ScanJobStatus } from "./scanJobs";

export {
  createIgnoreRule,
  deleteIgnoreRule,
  findMatchingIgnoreRule,
  getIgnoreRuleById,
  getIgnoreRuleByIdForUser,
  getIgnoreRulesForSite,
  listIgnoreRules,
  listIgnoreRulesForUser,
  listIgnoreRulesForSiteForUser,
  listIgnoreRulesForSite,
  matchesIgnoreRules,
  setIgnoreRuleEnabled,
} from "./ignoreRules";
export type { IgnoreRule, IgnoreRuleType } from "./ignoreRules";

export { isValidEmailAddress, validateSafeRegexPattern } from "./validation";

export {
  insertIgnoredOccurrence,
  listIgnoredLinksForRun,
  listIgnoredLinksForRunForUser,
  listIgnoredOccurrences,
  listIgnoredOccurrencesForUser,
  upsertIgnoredLink,
} from "./ignoredLinks";
export type { IgnoredLinkRow, IgnoredOccurrenceRow } from "./ignoredLinks";

export {
  getLinkCountsForRun,
  getNewLinksSinceLastNotified,
  getPreviousCompletedRunId,
  getSiteNotificationSettings,
  getSiteNotificationSettingsForUser,
  getLastNotifiedScanRunId,
  hasNotificationEvent,
  markScanRunNotified,
  recordNotificationEvent,
  setLastNotifiedScanRunId,
  updateSiteNotificationSettings,
  updateSiteNotificationSettingsForUser,
} from "./notifications";
export type {
  LinkDeltaRow,
  NotificationEventKind,
  NotificationSettings,
} from "./notifications";

export { createUser, getUserByEmail, getUserById, verifyUser } from "./auth";
export type { AuthUser } from "./auth";

export { SCAN_EVENT_CHANNEL } from "./events";
