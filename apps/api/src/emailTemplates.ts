import {
  DEFAULT_EMAIL_TEMPLATE_BY_KEY,
  getEmailTemplate,
  type DefaultEmailTemplate,
  type EmailTemplateKey,
} from "@scanlark/db";

const APP_URL =
  process.env.APP_BASE_URL || process.env.APP_URL || "http://localhost:5173";

export type EmailTemplateVariables = Record<
  string,
  string | number | boolean | null | undefined
>;

export type RenderedTransactionalEmail = {
  subject: string;
  html: string;
  text: string;
  source: "database" | "default";
};

type TemplateParts = {
  subjectTemplate: string;
  htmlTemplate: string;
  textTemplate: string | null;
};

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function templateValue(
  variables: EmailTemplateVariables,
  name: string,
  mode: "subject" | "text" | "html",
) {
  const raw = variables[name];
  if (raw === null || raw === undefined) return "";
  const value = String(raw);
  if (mode === "subject") return value.replace(/[\r\n]+/g, " ").trim();
  if (mode === "html") return escapeHtml(value).replace(/\n/g, "<br />");
  return value;
}

function renderString(
  template: string,
  variables: EmailTemplateVariables,
  mode: "subject" | "text" | "html",
) {
  return template.replace(/{{\s*([a-zA-Z0-9_]+)\s*}}/g, (_match, name) =>
    templateValue(variables, name, mode),
  );
}

export function sanitizeEmailHtml(input: string) {
  return input
    .replace(
      /<\s*(script|style|iframe|object|embed)\b[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi,
      "",
    )
    .replace(
      /<\s*(script|style|iframe|object|embed|link|meta)\b[^>]*\/?\s*>/gi,
      "",
    )
    .replace(/\s+on[a-z]+\s*=\s*"[^"]*"/gi, "")
    .replace(/\s+on[a-z]+\s*=\s*'[^']*'/gi, "")
    .replace(/\s+on[a-z]+\s*=\s*[^\s>]+/gi, "")
    .replace(
      /\s+(href|src|action|formaction|xlink:href)\s*=\s*"(?!(?:https?:|mailto:|#|\/|{{))[^"]*"/gi,
      "",
    )
    .replace(
      /\s+(href|src|action|formaction|xlink:href)\s*=\s*'(?!(?:https?:|mailto:|#|\/|{{))[^']*'/gi,
      "",
    )
    .replace(
      /\s+(href|src|action|formaction|xlink:href)\s*=\s*(javascript:|data:)[^\s>]*/gi,
      "",
    );
}

function validateParts(parts: TemplateParts) {
  return (
    parts.subjectTemplate.trim().length > 0 &&
    parts.htmlTemplate.trim().length > 0
  );
}

export function renderTemplateParts(
  parts: TemplateParts,
  variables: EmailTemplateVariables,
): RenderedTransactionalEmail {
  if (!validateParts(parts)) {
    throw new Error("invalid_email_template");
  }
  const sanitizedHtml = sanitizeEmailHtml(parts.htmlTemplate);
  return {
    subject: renderString(parts.subjectTemplate, variables, "subject"),
    html: renderString(sanitizedHtml, variables, "html"),
    text: renderString(parts.textTemplate ?? "", variables, "text"),
    source: "default",
  };
}

function defaultsForKey(key: EmailTemplateKey): DefaultEmailTemplate {
  const defaults = DEFAULT_EMAIL_TEMPLATE_BY_KEY.get(key);
  if (!defaults) throw new Error("email_template_default_missing");
  return defaults;
}

export async function renderTransactionalEmail(
  key: EmailTemplateKey,
  variables: EmailTemplateVariables,
): Promise<RenderedTransactionalEmail> {
  const defaults = defaultsForKey(key);
  try {
    const dbTemplate = await getEmailTemplate(key);
    if (dbTemplate?.enabled) {
      const rendered = renderTemplateParts(
        {
          subjectTemplate: dbTemplate.subject_template,
          htmlTemplate: dbTemplate.html_template,
          textTemplate: dbTemplate.text_template,
        },
        variables,
      );
      return { ...rendered, source: "database" };
    }
  } catch (err) {
    console.error(`Email template fallback for ${key}`, err);
  }

  const rendered = renderTemplateParts(
    {
      subjectTemplate: defaults.subjectTemplate,
      htmlTemplate: defaults.htmlTemplate,
      textTemplate: defaults.textTemplate,
    },
    variables,
  );
  return { ...rendered, source: "default" };
}

export function getSampleTemplateVariables(
  key: EmailTemplateKey,
  overrides: EmailTemplateVariables = {},
): EmailTemplateVariables {
  const base = APP_URL.replace(/\/+$/, "");
  const defaults: EmailTemplateVariables = {
    appName: "Scanlark",
    siteName: "demo.scanlark.com",
    siteUrl: "https://demo.scanlark.com",
    reportUrl: `${base}/report?scanRunId=sample`,
    scanRunId: "sample-scan-run",
    dashboardUrl: base,
    unsubscribeOrPreferencesUrl: `${base}/dashboard/settings`,
    startedAt: new Date(Date.now() - 1000 * 60 * 8).toISOString(),
    completedAt: new Date().toISOString(),
    errorMessage: "The scan could not finish before the worker timeout.",
    healthScore: "87%",
    issueCount: "6",
    criticalCount: "1",
    highCount: "2",
    severityCounts: "critical: 1 | high: 2 | medium: 3",
    categoryCounts: "SEO: 2 | SSL/HTTPS: 1 | Security headers: 2 | Links: 1",
    topIssues:
      "- [critical] Missing HTTPS redirect (SSL/HTTPS) - https://demo.scanlark.com\n- [high] Missing content security policy (Security headers) - https://demo.scanlark.com",
    checkUrl: "https://demo.scanlark.com",
    incidentId: "sample-incident",
    uptimeStatus: "down",
    createdAt: new Date().toISOString(),
  };

  const template = defaultsForKey(key);
  return template.variables.reduce<EmailTemplateVariables>(
    (values, variable) => ({
      ...values,
      [variable]: overrides[variable] ?? defaults[variable] ?? "",
    }),
    { ...overrides },
  );
}
