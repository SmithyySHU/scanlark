import assert from "node:assert/strict";
import test from "node:test";
import {
  isMissingEmailTemplateRelationError,
  renderTransactionalEmail,
} from "./emailTemplates";

test("missing email_templates relation falls back to default transactional template", async () => {
  const missingRelationError = Object.assign(
    new Error('relation "email_templates" does not exist'),
    { code: "42P01" },
  );

  const email = await renderTransactionalEmail(
    "scan_failed",
    {
      appName: "Scanlark",
      siteName: "example.com",
      siteUrl: "https://example.com",
      reportUrl: "https://scanlark.app/report?scanRunId=run-1",
      scanRunId: "run-1",
      dashboardUrl: "https://scanlark.app",
      unsubscribeOrPreferencesUrl: "https://scanlark.app/dashboard/settings",
      startedAt: "2026-08-02T00:00:00Z",
      completedAt: "2026-08-02T00:01:00Z",
      errorMessage: "timeout",
      healthScore: "91%",
      issueCount: 0,
      criticalCount: 0,
      highCount: 0,
      severityCounts: "none",
      categoryCounts: "none",
      topIssues: "none",
    },
    {
      getTemplate: async () => {
        throw missingRelationError;
      },
    },
  );

  assert.equal(email.source, "default");
  assert.equal(email.subject.includes("scheduled scan failed"), true);
});

test("unexpected template lookup errors are not silently swallowed", async () => {
  const otherDbError = Object.assign(new Error("database connection failed"), {
    code: "08006",
  });

  await assert.rejects(
    async () => {
      await renderTransactionalEmail(
        "scan_failed",
        {
          appName: "Scanlark",
          siteName: "example.com",
          siteUrl: "https://example.com",
          reportUrl: "https://scanlark.app/report?scanRunId=run-1",
          scanRunId: "run-1",
          dashboardUrl: "https://scanlark.app",
          unsubscribeOrPreferencesUrl: "https://scanlark.app/dashboard/settings",
          startedAt: "2026-08-02T00:00:00Z",
          completedAt: "2026-08-02T00:01:00Z",
          errorMessage: "timeout",
          healthScore: "91%",
          issueCount: 0,
          criticalCount: 0,
          highCount: 0,
          severityCounts: "none",
          categoryCounts: "none",
          topIssues: "none",
        },
        {
          getTemplate: async () => {
            throw otherDbError;
          },
        },
      );
    },
    (err) => {
      assert.equal(err === otherDbError, true);
      return true;
    },
  );
});

test("isMissingEmailTemplateRelationError identifies the expected SQLSTATE", () => {
  const missingRelationError = Object.assign(
    new Error('relation "email_templates" does not exist'),
    { code: "42P01" },
  );
  assert.equal(isMissingEmailTemplateRelationError(missingRelationError), true);

  const unrelatedError = new Error("some other error");
  assert.equal(isMissingEmailTemplateRelationError(unrelatedError), false);
});
