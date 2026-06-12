export {
  createSite,
  createSiteForUser,
  deleteSite,
  deleteSiteForUser,
  getSiteById,
  getSiteByIdForUser,
  getSitesForUser,
  listSitesForUser,
  cacheSiteAvatarForUser,
  backfillSitesUserId,
  getSiteAvatarForUser,
  markSiteAvatarUnavailableForUser,
  updateSiteMetadataForUser,
} from "./sites";
export type {
  CacheSiteAvatarInput,
  DbSiteRow,
  SiteAvatarAsset,
  SiteAvatarStatus,
  SiteMetadataFields,
} from "./sites";

export {
  computeNextScheduledAt,
  enqueueScheduledScanIfDue,
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
  setScanRunIssueGenerationStatus,
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
  listIssuesForScanRun,
  listIssuesForScanRunForUser,
  replaceIssuesForScanRun,
} from "./scanIssues";
export type {
  ResolvedScanIssue,
  ScanIssue,
  ScanIssueCategory,
  ScanIssueChangeStatus,
  ScanIssueSeverity,
  ScanIssueStatus,
  ScanIssueType,
  ScanIssuesSummary,
} from "./scanIssues";

export { formatIssuePresentation } from "./issuePresentation";
export type { IssuePresentation } from "./issuePresentation";

export { upsertScanPageCheck } from "./scanPageChecks";
export type { ScanPageCheckInput, ScanPageCheckRow } from "./scanPageChecks";

export {
  listScanSiteCheckTypesForRun,
  upsertScanSiteCheck,
} from "./scanSiteChecks";
export type {
  ScanSiteCheckInput,
  ScanSiteCheckRow,
  ScanSiteCheckType,
} from "./scanSiteChecks";

export {
  getScanTechnicalDiagnostics,
  getScanTechnicalDiagnosticsForUser,
} from "./scanTechnicalDiagnostics";
export type { ScanTechnicalDiagnosticsSummary } from "./scanTechnicalDiagnostics";

export {
  deleteLinkNoteForSiteForUser,
  getLinkNoteForSiteByUrlForUser,
  listLinkNotesForSiteForUser,
  normalizeLinkUrl,
  updateLinkNoteForSiteForUser,
  upsertLinkNoteForSiteForUser,
} from "./linkNotes";
export type { LinkNote, LinkNoteStatus } from "./linkNotes";

export {
  enqueueEmailOutbox,
  markEmailOutboxFailed,
  markEmailOutboxRecorded,
  markEmailOutboxSent,
} from "./emailOutbox";
export type { EmailOutboxEntry } from "./emailOutbox";

export {
  getAdminFailedEmailForRetry,
  getAdminOverview,
  getAdminSiteDetail,
  getAdminUserDetail,
  listAdminAuditLog,
  listAdminEmailOutbox,
  listAdminScans,
  listAdminShareLinks,
  listAdminSites,
  listAdminUptime,
  listAdminUsers,
  recordAdminAuditLog,
  revokeAdminShareLink,
  setAdminSiteDisabled,
  setAdminSiteSchedulePaused,
  setAdminUptimePaused,
  setAdminUserDisabled,
} from "./admin";
export type {
  AdminActor,
  AdminAuditLogRow,
  AdminEmailOutboxRow,
  AdminScanRow,
  AdminShareLinkRow,
  AdminSiteRow,
  AdminUptimeRow,
  AdminUserRow,
} from "./admin";

export {
  createOrRotateReportShareForRunForUser,
  disableReportShareForRunForUser,
  getReportShareForRunForUser,
  getSharedReportAccessByToken,
  recordReportShareView,
} from "./reportShares";
export type {
  ReportShareRow,
  ReportShareWithToken,
  SharedReportAccess,
} from "./reportShares";

export {
  cancelScanJob,
  claimNextScanJob,
  completeScanJob,
  enqueueExistingScanRunIfIdle,
  enqueueScanJob,
  enqueueManualScanIfIdle,
  extendScanJobLease,
  failScanJob,
  getActiveSiteScan,
  getJobForScanRun,
  hasActiveJobForSite,
  recoverStaleQueuedScanJobs,
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
  getIssueNotificationDigestForRun,
  getNewLinksSinceLastNotified,
  getPreviousCompletedRunId,
  getSiteNotificationSettings,
  getSiteNotificationSettingsForUser,
  getLastNotifiedScanRunId,
  hasNotificationEvent,
  markScanRunNotified,
  recordNotificationEvent,
  tryRecordNotificationEvent,
  setLastNotifiedScanRunId,
  updateSiteNotificationSettings,
  updateSiteNotificationSettingsForUser,
} from "./notifications";
export type {
  IssueNotificationDigest,
  LinkDeltaRow,
  NotificationEventKind,
  NotificationSettings,
} from "./notifications";

export {
  createAppNotification,
  createScanAppNotificationsForRun,
  getUnreadAppNotificationCount,
  getUserNotificationPreferences,
  listRecentAppNotificationsForUser,
  markAllAppNotificationsReadForUser,
  markAppNotificationReadForUser,
  shouldCreateAppNotification,
  updateUserNotificationPreferences,
  USER_NOTIFICATION_PREFERENCE_FIELDS,
} from "./appNotifications";
export type {
  AppNotification,
  AppNotificationKind,
  AppNotificationSeverity,
  UpdateUserNotificationPreferencesInput,
  UserNotificationPreferenceField,
  UserNotificationPreferences,
} from "./appNotifications";

export {
  claimDueUptimeMonitors,
  getOrCreateUptimeMonitorForSite,
  getOrCreateUptimeMonitorForSiteForUser,
  getUptimeIncidentById,
  getUptimeMonitorSettingsForUser,
  getUptimeStatusForSiteForUser,
  recordUptimeCheck,
  updateUptimeMonitorSettingsForUser,
} from "./uptimeMonitors";
export type {
  ClaimedUptimeMonitor,
  RecordedUptimeCheck,
  UptimeCheckInput,
  UptimeCheckRow,
  UptimeCheckStatus,
  UptimeIncidentNotificationContext,
  UptimeIncidentRow,
  UptimeIncidentStatus,
  UptimeSettingsRow,
  UptimeStatus,
  UptimeStatusSummary,
} from "./uptimeMonitors";

export {
  computeSeverityScore,
  createEmptySeverityCounts,
  getScanCategoryScores,
  getScanCategoryScoresForUser,
  getScoreBand,
} from "./scanCategoryScores";
export type {
  ScanCategoryScore,
  ScanCategoryScoreKey,
  ScanCategoryScoreStatus,
  ScanScoreBand,
  SeverityCounts,
} from "./scanCategoryScores";

export {
  createUser,
  getUserByEmail,
  getUserById,
  updateUserProfile,
  verifyUser,
} from "./auth";
export type { AuthUser } from "./auth";

export { SCAN_EVENT_CHANNEL } from "./events";
