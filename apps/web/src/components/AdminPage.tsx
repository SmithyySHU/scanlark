import { useEffect, useMemo, useState } from "react";

type ApiFetch = (
  input: RequestInfo | URL,
  init?: RequestInit,
) => Promise<Response>;

type AdminTab =
  | "overview"
  | "users"
  | "sites"
  | "scans"
  | "uptime"
  | "email"
  | "templates"
  | "shares"
  | "audit";

type AuthUser = {
  id: string;
  email: string;
  displayName?: string | null;
  name?: string;
  isAdmin?: boolean;
};

type AuditAction = {
  id: string;
  admin_email: string;
  action: string;
  target_type: string;
  target_id: string;
  metadata_json?: Record<string, unknown>;
  created_at: string;
};

type OverviewData = {
  totals: {
    users: number;
    sites: number;
    recentScans: number;
    failedScans: number;
    activeScans: number;
    emailFailures: number;
    uptimeDown: number;
  };
  recentAdminActions: AuditAction[];
};

type UserRow = {
  id: string;
  email: string;
  display_name: string | null;
  created_at: string;
  updated_at: string;
  disabled_at: string | null;
  site_count: number;
  scan_count: number;
};

type SiteRow = {
  id: string;
  user_id: string;
  owner_email: string;
  owner_display_name: string | null;
  url: string;
  created_at: string;
  disabled_at: string | null;
  permission_confirmed_at: string | null;
  permission_confirmed_by_user_id: string | null;
  permission_confirmation_text_version: string | null;
  is_sample_site: boolean;
  verification_status: string;
  schedule_enabled: boolean;
  site_display_name: string | null;
  client_name: string | null;
  report_display_name: string | null;
  uptime_enabled: boolean | null;
  last_scan_id: string | null;
  last_scan_status: string | null;
  last_scan_started_at: string | null;
  last_scan_finished_at: string | null;
};

type ScanRow = {
  id: string;
  site_id: string;
  site_url: string;
  site_display_name: string | null;
  user_id: string;
  owner_email: string;
  status: string;
  started_at: string;
  finished_at: string | null;
  updated_at: string;
  start_url: string;
  total_links: number;
  checked_links: number;
  broken_links: number;
  trigger_type: string;
  error_message: string | null;
  job_id: string | null;
  job_status: string | null;
};

type UptimeRow = {
  settings_id: string;
  site_id: string;
  site_url: string;
  site_display_name: string | null;
  owner_email: string;
  enabled: boolean;
  check_url: string;
  interval_minutes: number;
  failure_threshold: number;
  next_check_at: string | null;
  updated_at: string;
  last_check_status: string | null;
  last_checked_at: string | null;
  last_status_code: number | null;
  last_response_time_ms: number | null;
  active_incident_id: string | null;
  active_incident_started_at: string | null;
  active_incident_failure_count: number | null;
};

type EmailRow = {
  id: string;
  user_id: string | null;
  user_email: string | null;
  site_id: string | null;
  site_url: string | null;
  scan_run_id: string | null;
  email_type: string;
  to_email: string;
  subject: string;
  status: string;
  created_at: string;
  updated_at: string;
  sent_at: string | null;
  failed_at: string | null;
  suppressed_at: string | null;
  last_error: string | null;
};

type EmailTemplateRow = {
  id: string;
  key: string;
  name: string;
  description: string;
  subject_template: string;
  html_template: string;
  text_template: string | null;
  enabled: boolean;
  version: number;
  created_at: string;
  updated_at: string;
  updated_by_user_id: string | null;
  updated_by_email: string | null;
  variables: string[];
};

type EmailTemplateEditor = {
  subjectTemplate: string;
  htmlTemplate: string;
  textTemplate: string;
  enabled: boolean;
  changeNote: string;
  testRecipient: string;
};

type EmailTemplatePreview = {
  subject: string;
  html: string;
  text: string;
  source: string;
};

type ShareRow = {
  id: string;
  scan_run_id: string;
  site_id: string;
  site_url: string;
  site_display_name: string | null;
  created_by_email: string;
  enabled: boolean;
  created_at: string;
  disabled_at: string | null;
  last_viewed_at: string | null;
  view_count: number;
  share_reference: string;
};

type DetailState =
  | { type: "user"; id: string; data: UserDetail | null; loading: boolean }
  | { type: "site"; id: string; data: SiteDetail | null; loading: boolean }
  | null;

type UserDetail = {
  user: UserRow;
  recentSites: SiteRow[];
  recentScans: ScanRow[];
};

type SiteDetail = {
  site: SiteRow;
  recentScans: ScanRow[];
  uptime: UptimeRow[];
};

type AdminPageProps = {
  apiBase: string;
  apiFetch: ApiFetch;
  authUser: AuthUser;
  onBackToDashboard: () => void;
};

const TABS: Array<{ key: AdminTab; label: string }> = [
  { key: "overview", label: "Overview" },
  { key: "users", label: "Users" },
  { key: "sites", label: "Sites" },
  { key: "scans", label: "Scans / Jobs" },
  { key: "uptime", label: "Uptime" },
  { key: "email", label: "Email Outbox" },
  { key: "templates", label: "Email Templates" },
  { key: "shares", label: "Share Links" },
  { key: "audit", label: "Audit Log" },
];

const PAGE_SIZE = 50;

function formatDate(value: string | null | undefined) {
  if (!value) return "Not available";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not available";
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function formatDuration(start: string, end: string | null) {
  if (!end) return "Running";
  const startMs = Date.parse(start);
  const endMs = Date.parse(end);
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs)) return "Unknown";
  const seconds = Math.max(0, Math.round((endMs - startMs) / 1000));
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return `${minutes}m ${remainder}s`;
}

function displaySiteName(site: Pick<SiteRow, "site_display_name" | "url">) {
  return site.site_display_name?.trim() || site.url;
}

function statusTone(status: string | null | undefined) {
  if (!status) return "neutral";
  if (["completed", "sent", "up", "recorded"].includes(status)) return "good";
  if (["failed", "down", "cancelled"].includes(status)) return "bad";
  if (["queued", "running", "in_progress", "degraded"].includes(status)) {
    return "warn";
  }
  return "neutral";
}

async function parseError(res: Response) {
  const text = await res.text().catch(() => "");
  if (!text) return `Request failed (${res.status})`;
  try {
    const parsed = JSON.parse(text) as { message?: string; error?: string };
    return parsed.message ?? parsed.error ?? `Request failed (${res.status})`;
  } catch {
    return text.slice(0, 180);
  }
}

function MetadataPreview({ value }: { value?: Record<string, unknown> }) {
  if (!value || Object.keys(value).length === 0) {
    return <span className="admin-muted">None</span>;
  }
  return (
    <code className="admin-code">
      {JSON.stringify(value, null, 2).slice(0, 240)}
    </code>
  );
}

export function AdminPage({
  apiBase,
  apiFetch,
  authUser,
  onBackToDashboard,
}: AdminPageProps) {
  const [activeTab, setActiveTab] = useState<AdminTab>("overview");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [offset, setOffset] = useState(0);
  const [refreshKey, setRefreshKey] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [detail, setDetail] = useState<DetailState>(null);
  const [overview, setOverview] = useState<OverviewData | null>(null);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [sites, setSites] = useState<SiteRow[]>([]);
  const [scans, setScans] = useState<ScanRow[]>([]);
  const [uptime, setUptime] = useState<UptimeRow[]>([]);
  const [emails, setEmails] = useState<EmailRow[]>([]);
  const [emailTemplates, setEmailTemplates] = useState<EmailTemplateRow[]>([]);
  const [selectedTemplateKey, setSelectedTemplateKey] = useState<string | null>(
    null,
  );
  const [templateEditor, setTemplateEditor] =
    useState<EmailTemplateEditor | null>(null);
  const [templatePreview, setTemplatePreview] =
    useState<EmailTemplatePreview | null>(null);
  const [shares, setShares] = useState<ShareRow[]>([]);
  const [auditActions, setAuditActions] = useState<AuditAction[]>([]);

  const rowsOnPage = useMemo(() => {
    if (activeTab === "users") return users.length;
    if (activeTab === "sites") return sites.length;
    if (activeTab === "scans") return scans.length;
    if (activeTab === "uptime") return uptime.length;
    if (activeTab === "email") return emails.length;
    if (activeTab === "templates") return emailTemplates.length;
    if (activeTab === "shares") return shares.length;
    if (activeTab === "audit") return auditActions.length;
    return 0;
  }, [
    activeTab,
    auditActions.length,
    emails.length,
    emailTemplates.length,
    scans.length,
    shares.length,
    sites.length,
    uptime.length,
    users.length,
  ]);

  useEffect(() => {
    setOffset(0);
    setDetail(null);
  }, [activeTab]);

  useEffect(() => {
    if (activeTab !== "users" && activeTab !== "sites") return;
    setOffset(0);
  }, [activeTab, search]);

  useEffect(() => {
    if (activeTab !== "scans" && activeTab !== "email") return;
    setOffset(0);
  }, [activeTab, statusFilter]);

  useEffect(() => {
    if (activeTab !== "templates" || !selectedTemplateKey) return;
    const template = emailTemplates.find(
      (item) => item.key === selectedTemplateKey,
    );
    if (!template) return;
    setTemplateEditor({
      subjectTemplate: template.subject_template,
      htmlTemplate: template.html_template,
      textTemplate: template.text_template ?? "",
      enabled: template.enabled,
      changeNote: "",
      testRecipient: authUser.email,
    });
    setTemplatePreview(null);
  }, [activeTab, authUser.email, emailTemplates, selectedTemplateKey]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      const params = new URLSearchParams();
      if (activeTab !== "overview") {
        params.set("limit", String(PAGE_SIZE));
        params.set("offset", String(offset));
      }
      if ((activeTab === "users" || activeTab === "sites") && search.trim()) {
        params.set("search", search.trim());
      }
      if ((activeTab === "scans" || activeTab === "email") && statusFilter) {
        params.set("status", statusFilter);
      }

      const suffix = params.toString() ? `?${params.toString()}` : "";
      const endpointByTab: Record<AdminTab, string> = {
        overview: "/admin/overview",
        users: `/admin/users${suffix}`,
        sites: `/admin/sites${suffix}`,
        scans: `/admin/scans${suffix}`,
        uptime: `/admin/uptime${suffix}`,
        email: `/admin/email-outbox${suffix}`,
        templates: "/admin/email-templates",
        shares: `/admin/share-links${suffix}`,
        audit: `/admin/audit-log${suffix}`,
      };

      try {
        const res = await apiFetch(`${apiBase}${endpointByTab[activeTab]}`, {
          cache: "no-store",
        });
        if (!res.ok) throw new Error(await parseError(res));
        const data = await res.json();
        if (cancelled) return;
        if (activeTab === "overview") setOverview(data as OverviewData);
        if (activeTab === "users") {
          setUsers((data as { users: UserRow[] }).users ?? []);
        }
        if (activeTab === "sites") {
          setSites((data as { sites: SiteRow[] }).sites ?? []);
        }
        if (activeTab === "scans") {
          setScans((data as { scans: ScanRow[] }).scans ?? []);
        }
        if (activeTab === "uptime") {
          setUptime((data as { monitors: UptimeRow[] }).monitors ?? []);
        }
        if (activeTab === "email") {
          setEmails((data as { emails: EmailRow[] }).emails ?? []);
        }
        if (activeTab === "templates") {
          const templates =
            (data as { templates: EmailTemplateRow[] }).templates ?? [];
          setEmailTemplates(templates);
          setSelectedTemplateKey((current) =>
            current && templates.some((template) => template.key === current)
              ? current
              : (templates[0]?.key ?? null),
          );
        }
        if (activeTab === "shares") {
          setShares((data as { shares: ShareRow[] }).shares ?? []);
        }
        if (activeTab === "audit") {
          setAuditActions((data as { actions: AuditAction[] }).actions ?? []);
        }
      } catch (err: unknown) {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : "Failed to load admin data",
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [activeTab, apiBase, apiFetch, offset, refreshKey, search, statusFilter]);

  async function postAction(path: string, success: string) {
    setBusyAction(path);
    setError(null);
    setNotice(null);
    try {
      const res = await apiFetch(`${apiBase}${path}`, { method: "POST" });
      if (!res.ok) throw new Error(await parseError(res));
      setNotice(success);
      setRefreshKey((value) => value + 1);
      if (detail) {
        void loadDetail(detail.type, detail.id);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Action failed");
    } finally {
      setBusyAction(null);
    }
  }

  async function loadDetail(type: "user" | "site", id: string) {
    setDetail({ type, id, data: null, loading: true });
    try {
      const res = await apiFetch(
        `${apiBase}/admin/${type === "user" ? "users" : "sites"}/${encodeURIComponent(id)}`,
        {
          cache: "no-store",
        },
      );
      if (!res.ok) throw new Error(await parseError(res));
      const data = await res.json();
      setDetail({
        type,
        id,
        data: data as UserDetail & SiteDetail,
        loading: false,
      });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load detail");
      setDetail(null);
    }
  }

  const selectedTemplate = useMemo(
    () =>
      emailTemplates.find((template) => template.key === selectedTemplateKey) ??
      null,
    [emailTemplates, selectedTemplateKey],
  );

  async function previewTemplate() {
    if (!selectedTemplate || !templateEditor) return;
    setBusyAction(`template-preview:${selectedTemplate.key}`);
    setError(null);
    setNotice(null);
    try {
      const res = await apiFetch(
        `${apiBase}/admin/email-templates/${encodeURIComponent(
          selectedTemplate.key,
        )}/preview`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(templateEditor),
        },
      );
      if (!res.ok) throw new Error(await parseError(res));
      const data = (await res.json()) as {
        preview: EmailTemplatePreview;
      };
      setTemplatePreview(data.preview);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Preview failed");
    } finally {
      setBusyAction(null);
    }
  }

  async function saveTemplate() {
    if (!selectedTemplate || !templateEditor) return;
    setBusyAction(`template-save:${selectedTemplate.key}`);
    setError(null);
    setNotice(null);
    try {
      const res = await apiFetch(
        `${apiBase}/admin/email-templates/${encodeURIComponent(
          selectedTemplate.key,
        )}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(templateEditor),
        },
      );
      if (!res.ok) throw new Error(await parseError(res));
      const data = (await res.json()) as { template: EmailTemplateRow };
      setEmailTemplates((templates) =>
        templates.map((template) =>
          template.key === data.template.key ? data.template : template,
        ),
      );
      setNotice("Email template saved");
      setRefreshKey((value) => value + 1);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setBusyAction(null);
    }
  }

  async function sendTemplateTest() {
    if (!selectedTemplate || !templateEditor) return;
    setBusyAction(`template-test:${selectedTemplate.key}`);
    setError(null);
    setNotice(null);
    try {
      const res = await apiFetch(
        `${apiBase}/admin/email-templates/${encodeURIComponent(
          selectedTemplate.key,
        )}/test`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ toEmail: templateEditor.testRecipient }),
        },
      );
      if (!res.ok) throw new Error(await parseError(res));
      setNotice("Template test email send attempted");
      setRefreshKey((value) => value + 1);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Test send failed");
    } finally {
      setBusyAction(null);
    }
  }

  async function restoreTemplateDefault() {
    if (!selectedTemplate) return;
    setBusyAction(`template-restore:${selectedTemplate.key}`);
    setError(null);
    setNotice(null);
    try {
      const res = await apiFetch(
        `${apiBase}/admin/email-templates/${encodeURIComponent(
          selectedTemplate.key,
        )}/restore-default`,
        { method: "POST" },
      );
      if (!res.ok) throw new Error(await parseError(res));
      const data = (await res.json()) as { template: EmailTemplateRow };
      setEmailTemplates((templates) =>
        templates.map((template) =>
          template.key === data.template.key ? data.template : template,
        ),
      );
      setNotice("Email template restored to default");
      setRefreshKey((value) => value + 1);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Restore failed");
    } finally {
      setBusyAction(null);
    }
  }

  function renderStatus(value: string | null | undefined) {
    return (
      <span className={`admin-status admin-status--${statusTone(value)}`}>
        {value ?? "unknown"}
      </span>
    );
  }

  function renderFilters() {
    if (activeTab === "users" || activeTab === "sites") {
      return (
        <label className="admin-filter">
          <span>
            {activeTab === "users" ? "Search email" : "Search domain or user"}
          </span>
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={
              activeTab === "users" ? "user@example.com" : "example.com"
            }
          />
        </label>
      );
    }
    if (activeTab === "scans") {
      return (
        <label className="admin-filter">
          <span>Status</span>
          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
          >
            <option value="">All statuses</option>
            <option value="queued">Queued</option>
            <option value="running">Job running</option>
            <option value="in_progress">Scan running</option>
            <option value="completed">Completed</option>
            <option value="failed">Failed</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </label>
      );
    }
    if (activeTab === "email") {
      return (
        <label className="admin-filter">
          <span>Status</span>
          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
          >
            <option value="">All statuses</option>
            <option value="queued">Queued</option>
            <option value="sent">Sent</option>
            <option value="failed">Failed</option>
            <option value="recorded">Recorded</option>
            <option value="suppressed">Suppressed</option>
          </select>
        </label>
      );
    }
    return null;
  }

  function renderPager() {
    if (activeTab === "overview" || activeTab === "templates") return null;
    return (
      <div className="admin-pager">
        <button
          type="button"
          className="admin-button admin-button--secondary"
          disabled={offset === 0 || loading}
          onClick={() => setOffset((value) => Math.max(0, value - PAGE_SIZE))}
        >
          Previous
        </button>
        <span>
          Rows {offset + 1}
          {rowsOnPage > 0 ? `-${offset + rowsOnPage}` : ""}
        </span>
        <button
          type="button"
          className="admin-button admin-button--secondary"
          disabled={rowsOnPage < PAGE_SIZE || loading}
          onClick={() => setOffset((value) => value + PAGE_SIZE)}
        >
          Next
        </button>
      </div>
    );
  }

  function renderOverview() {
    const totals = overview?.totals;
    const cards = [
      ["Total users", totals?.users],
      ["Total sites", totals?.sites],
      ["Recent scans", totals?.recentScans],
      ["Failed scans", totals?.failedScans],
      ["Queued/running scans", totals?.activeScans],
      ["Email failures", totals?.emailFailures],
      ["Uptime monitors down", totals?.uptimeDown],
    ];
    return (
      <>
        <div className="admin-card-grid">
          {cards.map(([label, value]) => (
            <div className="admin-card" key={label}>
              <div className="admin-card__label">{label}</div>
              <div className="admin-card__value">{value ?? "..."}</div>
            </div>
          ))}
        </div>
        <div className="admin-section-grid">
          <section className="admin-panel">
            <h2>Recent Admin Actions</h2>
            {renderAuditTable(overview?.recentAdminActions ?? [])}
          </section>
          <section className="admin-panel">
            <h2>Subscription Placeholders</h2>
            <div className="admin-placeholder">
              Plan, site limit overrides, billing state, and payment controls
              are reserved for a future admin sprint.
            </div>
          </section>
        </div>
      </>
    );
  }

  function renderUsers() {
    return (
      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Email</th>
              <th>Display name</th>
              <th>Created</th>
              <th>Last seen</th>
              <th>Sites</th>
              <th>Scans</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id}>
                <td>{user.email}</td>
                <td>{user.display_name || "Not set"}</td>
                <td>{formatDate(user.created_at)}</td>
                <td>Not tracked</td>
                <td>{user.site_count}</td>
                <td>{user.scan_count}</td>
                <td>
                  {user.disabled_at
                    ? renderStatus("disabled")
                    : renderStatus("active")}
                </td>
                <td>
                  <div className="admin-actions">
                    <button
                      type="button"
                      onClick={() => void loadDetail("user", user.id)}
                    >
                      View
                    </button>
                    {user.disabled_at ? (
                      <button
                        type="button"
                        disabled={
                          busyAction === `/admin/users/${user.id}/enable`
                        }
                        onClick={() =>
                          void postAction(
                            `/admin/users/${user.id}/enable`,
                            "User enabled",
                          )
                        }
                      >
                        Enable
                      </button>
                    ) : (
                      <button
                        type="button"
                        disabled={
                          user.id === authUser.id ||
                          busyAction === `/admin/users/${user.id}/disable`
                        }
                        onClick={() =>
                          void postAction(
                            `/admin/users/${user.id}/disable`,
                            "User disabled",
                          )
                        }
                      >
                        Disable
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  function renderSites() {
    return (
      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Site</th>
              <th>Owner</th>
              <th>Client</th>
              <th>Created</th>
              <th>Verification</th>
              <th>Source</th>
              <th>Scheduled scans</th>
              <th>Uptime</th>
              <th>Last scan</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {sites.map((site) => (
              <tr key={site.id}>
                <td>
                  <strong>{displaySiteName(site)}</strong>
                  <span className="admin-subtext">{site.url}</span>
                </td>
                <td>{site.owner_email}</td>
                <td>{site.client_name || "Not set"}</td>
                <td>{formatDate(site.created_at)}</td>
                <td>
                  {renderStatus(site.verification_status)}
                  {site.permission_confirmed_at ? (
                    <span className="admin-subtext">
                      {formatDate(site.permission_confirmed_at)}
                    </span>
                  ) : null}
                </td>
                <td>{site.is_sample_site ? "Scanlark demo" : "User site"}</td>
                <td>{site.schedule_enabled ? "Enabled" : "Paused"}</td>
                <td>{site.uptime_enabled ? "Enabled" : "Paused"}</td>
                <td>{renderStatus(site.last_scan_status)}</td>
                <td>
                  {site.disabled_at
                    ? renderStatus("disabled")
                    : renderStatus("active")}
                </td>
                <td>
                  <div className="admin-actions">
                    <button
                      type="button"
                      onClick={() => void loadDetail("site", site.id)}
                    >
                      View
                    </button>
                    {site.disabled_at ? (
                      <button
                        type="button"
                        onClick={() =>
                          void postAction(
                            `/admin/sites/${site.id}/enable`,
                            "Site enabled",
                          )
                        }
                      >
                        Enable
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() =>
                          void postAction(
                            `/admin/sites/${site.id}/disable`,
                            "Site disabled",
                          )
                        }
                      >
                        Disable
                      </button>
                    )}
                    <button
                      type="button"
                      disabled={!!site.disabled_at}
                      onClick={() =>
                        void postAction(
                          `/admin/sites/${site.id}/scheduled-scans/${site.schedule_enabled ? "pause" : "resume"}`,
                          site.schedule_enabled
                            ? "Scheduled scans paused"
                            : "Scheduled scans resumed",
                        )
                      }
                    >
                      {site.schedule_enabled ? "Pause scans" : "Resume scans"}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  function renderScans() {
    return (
      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Scan</th>
              <th>Site</th>
              <th>User</th>
              <th>Status</th>
              <th>Job</th>
              <th>Started</th>
              <th>Duration</th>
              <th>Counts</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {scans.map((scan) => (
              <tr key={scan.id}>
                <td>
                  <code>{scan.id.slice(0, 8)}</code>
                  <span className="admin-subtext">{scan.trigger_type}</span>
                </td>
                <td>
                  <strong>{scan.site_display_name || scan.site_url}</strong>
                  <span className="admin-subtext">{scan.start_url}</span>
                </td>
                <td>{scan.owner_email}</td>
                <td>{renderStatus(scan.status)}</td>
                <td>{renderStatus(scan.job_status)}</td>
                <td>{formatDate(scan.started_at)}</td>
                <td>{formatDuration(scan.started_at, scan.finished_at)}</td>
                <td>
                  {scan.checked_links}/{scan.total_links} checked,{" "}
                  {scan.broken_links} broken
                </td>
                <td>
                  <div className="admin-actions">
                    <button
                      type="button"
                      disabled={
                        scan.status !== "queued" &&
                        scan.status !== "in_progress"
                      }
                      onClick={() =>
                        void postAction(
                          `/admin/scans/${scan.id}/cancel`,
                          "Scan cancelled",
                        )
                      }
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      disabled={
                        scan.status !== "failed" && scan.status !== "cancelled"
                      }
                      onClick={() =>
                        void postAction(
                          `/admin/scans/${scan.id}/retry`,
                          "Scan retry queued",
                        )
                      }
                    >
                      Retry
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  function renderUptime() {
    return (
      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Monitor</th>
              <th>Owner</th>
              <th>Enabled</th>
              <th>Status</th>
              <th>Last check</th>
              <th>Incident</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {uptime.map((monitor) => (
              <tr key={monitor.settings_id}>
                <td>
                  <strong>
                    {monitor.site_display_name || monitor.site_url}
                  </strong>
                  <span className="admin-subtext">{monitor.check_url}</span>
                </td>
                <td>{monitor.owner_email}</td>
                <td>{monitor.enabled ? "Enabled" : "Paused"}</td>
                <td>{renderStatus(monitor.last_check_status ?? "unknown")}</td>
                <td>{formatDate(monitor.last_checked_at)}</td>
                <td>
                  {monitor.active_incident_id
                    ? `${monitor.active_incident_failure_count ?? 0} failures`
                    : "None"}
                </td>
                <td>
                  <button
                    type="button"
                    onClick={() =>
                      void postAction(
                        `/admin/uptime/${monitor.settings_id}/${monitor.enabled ? "pause" : "resume"}`,
                        monitor.enabled
                          ? "Uptime monitor paused"
                          : "Uptime monitor resumed",
                      )
                    }
                  >
                    {monitor.enabled ? "Pause" : "Resume"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  function renderEmail() {
    return (
      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Type</th>
              <th>Recipient</th>
              <th>Subject</th>
              <th>Status</th>
              <th>Created</th>
              <th>Sent/failed</th>
              <th>Error</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {emails.map((email) => (
              <tr key={email.id}>
                <td>{email.email_type}</td>
                <td>{email.to_email}</td>
                <td>{email.subject}</td>
                <td>{renderStatus(email.status)}</td>
                <td>{formatDate(email.created_at)}</td>
                <td>{formatDate(email.sent_at ?? email.failed_at)}</td>
                <td>{email.last_error || "None"}</td>
                <td>
                  <button
                    type="button"
                    disabled={email.status !== "failed"}
                    onClick={() =>
                      void postAction(
                        `/admin/email-outbox/${email.id}/retry`,
                        "Email retry attempted",
                      )
                    }
                  >
                    Retry
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  function renderEmailTemplates() {
    return (
      <div className="admin-template-layout">
        <section className="admin-panel admin-template-list">
          <div className="admin-template-warning">
            Transactional emails only. Do not use this for marketing campaigns.
          </div>
          <div className="admin-table-wrap">
            <table className="admin-table admin-template-table">
              <thead>
                <tr>
                  <th>Template</th>
                  <th>Enabled</th>
                  <th>Version</th>
                  <th>Updated</th>
                </tr>
              </thead>
              <tbody>
                {emailTemplates.map((template) => (
                  <tr
                    key={template.key}
                    className={
                      selectedTemplateKey === template.key
                        ? "admin-row-selected"
                        : undefined
                    }
                    onClick={() => setSelectedTemplateKey(template.key)}
                  >
                    <td>
                      <strong>{template.name}</strong>
                      <span className="admin-subtext">{template.key}</span>
                    </td>
                    <td>{template.enabled ? "Enabled" : "Disabled"}</td>
                    <td>{template.version}</td>
                    <td>
                      {formatDate(template.updated_at)}
                      <span className="admin-subtext">
                        {template.updated_by_email || "System default"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="admin-panel admin-template-editor">
          {!selectedTemplate || !templateEditor ? (
            <div className="admin-empty">Select a template to edit.</div>
          ) : (
            <>
              <div className="admin-template-heading">
                <div>
                  <h2>{selectedTemplate.name}</h2>
                  <p>{selectedTemplate.description}</p>
                </div>
                {renderStatus(templateEditor.enabled ? "enabled" : "disabled")}
              </div>

              <label className="admin-field">
                <span>Subject</span>
                <input
                  value={templateEditor.subjectTemplate}
                  onChange={(event) =>
                    setTemplateEditor({
                      ...templateEditor,
                      subjectTemplate: event.target.value,
                    })
                  }
                />
              </label>

              <label className="admin-field">
                <span>HTML</span>
                <textarea
                  rows={10}
                  value={templateEditor.htmlTemplate}
                  onChange={(event) =>
                    setTemplateEditor({
                      ...templateEditor,
                      htmlTemplate: event.target.value,
                    })
                  }
                />
              </label>

              <label className="admin-field">
                <span>Text</span>
                <textarea
                  rows={8}
                  value={templateEditor.textTemplate}
                  onChange={(event) =>
                    setTemplateEditor({
                      ...templateEditor,
                      textTemplate: event.target.value,
                    })
                  }
                />
              </label>

              <label className="admin-check">
                <input
                  type="checkbox"
                  checked={templateEditor.enabled}
                  onChange={(event) =>
                    setTemplateEditor({
                      ...templateEditor,
                      enabled: event.target.checked,
                    })
                  }
                />
                <span>Use this database template when sending emails</span>
              </label>

              <label className="admin-field">
                <span>Change note</span>
                <input
                  value={templateEditor.changeNote}
                  onChange={(event) =>
                    setTemplateEditor({
                      ...templateEditor,
                      changeNote: event.target.value,
                    })
                  }
                  placeholder="Optional note for template history"
                />
              </label>

              <div className="admin-variable-list">
                {selectedTemplate.variables.map((variable) => (
                  <code key={variable}>{`{{${variable}}}`}</code>
                ))}
              </div>

              <div className="admin-template-actions">
                <button
                  type="button"
                  className="admin-button"
                  disabled={
                    busyAction === `template-preview:${selectedTemplate.key}`
                  }
                  onClick={() => void previewTemplate()}
                >
                  Preview
                </button>
                <button
                  type="button"
                  className="admin-button"
                  disabled={
                    busyAction === `template-save:${selectedTemplate.key}`
                  }
                  onClick={() => void saveTemplate()}
                >
                  Save
                </button>
                <button
                  type="button"
                  className="admin-button admin-button--secondary"
                  disabled={
                    busyAction === `template-restore:${selectedTemplate.key}`
                  }
                  onClick={() => void restoreTemplateDefault()}
                >
                  Restore default
                </button>
              </div>

              <div className="admin-template-test">
                <label className="admin-field">
                  <span>Test recipient</span>
                  <input
                    value={templateEditor.testRecipient}
                    onChange={(event) =>
                      setTemplateEditor({
                        ...templateEditor,
                        testRecipient: event.target.value,
                      })
                    }
                    placeholder={authUser.email}
                  />
                </label>
                <button
                  type="button"
                  className="admin-button"
                  disabled={
                    busyAction === `template-test:${selectedTemplate.key}`
                  }
                  onClick={() => void sendTemplateTest()}
                >
                  Send test
                </button>
              </div>

              <div className="admin-template-preview">
                <h3>Preview</h3>
                {templatePreview ? (
                  <>
                    <p>
                      <strong>Subject</strong>
                      <span>{templatePreview.subject}</span>
                    </p>
                    <div
                      className="admin-template-preview__html"
                      dangerouslySetInnerHTML={{ __html: templatePreview.html }}
                    />
                    <pre>{templatePreview.text}</pre>
                    <span className="admin-subtext">
                      Source: {templatePreview.source}
                    </span>
                  </>
                ) : (
                  <div className="admin-empty">
                    Generate a preview to inspect rendered sample content.
                  </div>
                )}
              </div>
            </>
          )}
        </section>
      </div>
    );
  }

  function renderShares() {
    return (
      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Reference</th>
              <th>Site</th>
              <th>Created by</th>
              <th>Created</th>
              <th>Views</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {shares.map((share) => (
              <tr key={share.id}>
                <td>
                  <code>{share.share_reference}</code>
                </td>
                <td>
                  <strong>{share.site_display_name || share.site_url}</strong>
                  <span className="admin-subtext">{share.site_url}</span>
                </td>
                <td>{share.created_by_email}</td>
                <td>{formatDate(share.created_at)}</td>
                <td>{share.view_count}</td>
                <td>
                  {share.enabled
                    ? renderStatus("active")
                    : renderStatus("revoked")}
                </td>
                <td>
                  <button
                    type="button"
                    disabled={!share.enabled}
                    onClick={() =>
                      void postAction(
                        `/admin/share-links/${share.id}/revoke`,
                        "Share link revoked",
                      )
                    }
                  >
                    Revoke
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  function renderAuditTable(rows: AuditAction[]) {
    if (rows.length === 0)
      return <div className="admin-empty">No admin actions recorded.</div>;
    return (
      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Time</th>
              <th>Admin</th>
              <th>Action</th>
              <th>Target</th>
              <th>Metadata</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((action) => (
              <tr key={action.id}>
                <td>{formatDate(action.created_at)}</td>
                <td>{action.admin_email}</td>
                <td>{action.action}</td>
                <td>
                  {action.target_type}: {action.target_id.slice(0, 12)}
                </td>
                <td>
                  <MetadataPreview value={action.metadata_json} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  function renderAudit() {
    return renderAuditTable(auditActions);
  }

  function renderDetail() {
    if (!detail) return null;
    return (
      <aside className="admin-detail">
        <div className="admin-detail__header">
          <h2>{detail.type === "user" ? "User Detail" : "Site Detail"}</h2>
          <button type="button" onClick={() => setDetail(null)}>
            Close
          </button>
        </div>
        {detail.loading || !detail.data ? (
          <div className="admin-empty">Loading detail...</div>
        ) : detail.type === "user" ? (
          <div className="admin-detail__body">
            <p>
              <strong>Email</strong>
              <span>{(detail.data as UserDetail).user.email}</span>
            </p>
            <p>
              <strong>Display name</strong>
              <span>
                {(detail.data as UserDetail).user.display_name || "Not set"}
              </span>
            </p>
            <p>
              <strong>Status</strong>
              <span>
                {(detail.data as UserDetail).user.disabled_at
                  ? "Disabled"
                  : "Active"}
              </span>
            </p>
            <p>
              <strong>Created</strong>
              <span>
                {formatDate((detail.data as UserDetail).user.created_at)}
              </span>
            </p>
            <h3>Recent Sites</h3>
            {(detail.data as UserDetail).recentSites.length === 0 ? (
              <div className="admin-empty">No sites.</div>
            ) : (
              (detail.data as UserDetail).recentSites.map((site) => (
                <div className="admin-mini-row" key={site.id}>
                  <span>{displaySiteName(site)}</span>
                  {renderStatus(site.disabled_at ? "disabled" : "active")}
                </div>
              ))
            )}
            <h3>Recent Scans</h3>
            {(detail.data as UserDetail).recentScans.length === 0 ? (
              <div className="admin-empty">No scans.</div>
            ) : (
              (detail.data as UserDetail).recentScans.map((scan) => (
                <div className="admin-mini-row" key={scan.id}>
                  <span>{scan.site_display_name || scan.site_url}</span>
                  {renderStatus(scan.status)}
                </div>
              ))
            )}
          </div>
        ) : (
          <div className="admin-detail__body">
            <p>
              <strong>Site</strong>
              <span>{displaySiteName((detail.data as SiteDetail).site)}</span>
            </p>
            <p>
              <strong>URL</strong>
              <span>{(detail.data as SiteDetail).site.url}</span>
            </p>
            <p>
              <strong>Owner</strong>
              <span>{(detail.data as SiteDetail).site.owner_email}</span>
            </p>
            <p>
              <strong>Client</strong>
              <span>
                {(detail.data as SiteDetail).site.client_name || "Not set"}
              </span>
            </p>
            <p>
              <strong>Status</strong>
              <span>
                {(detail.data as SiteDetail).site.disabled_at
                  ? "Disabled"
                  : "Active"}
              </span>
            </p>
            <p>
              <strong>Verification</strong>
              <span>
                {(detail.data as SiteDetail).site.verification_status}
              </span>
            </p>
            <p>
              <strong>Source</strong>
              <span>
                {(detail.data as SiteDetail).site.is_sample_site
                  ? "Scanlark demo"
                  : "User site"}
              </span>
            </p>
            <p>
              <strong>Permission confirmed</strong>
              <span>
                {(detail.data as SiteDetail).site.permission_confirmed_at
                  ? formatDate(
                      (detail.data as SiteDetail).site.permission_confirmed_at,
                    )
                  : "Not confirmed"}
              </span>
            </p>
            <h3>Recent Scans</h3>
            {(detail.data as SiteDetail).recentScans.length === 0 ? (
              <div className="admin-empty">No scans.</div>
            ) : (
              (detail.data as SiteDetail).recentScans.map((scan) => (
                <div className="admin-mini-row" key={scan.id}>
                  <span>{formatDate(scan.started_at)}</span>
                  {renderStatus(scan.status)}
                </div>
              ))
            )}
            <h3>Uptime</h3>
            {(detail.data as SiteDetail).uptime.length === 0 ? (
              <div className="admin-empty">No uptime monitor.</div>
            ) : (
              (detail.data as SiteDetail).uptime.map((monitor) => (
                <div className="admin-mini-row" key={monitor.settings_id}>
                  <span>{monitor.check_url}</span>
                  {renderStatus(monitor.enabled ? "enabled" : "paused")}
                </div>
              ))
            )}
          </div>
        )}
      </aside>
    );
  }

  function renderActiveTab() {
    if (loading && activeTab === "overview")
      return <div className="admin-empty">Loading admin overview...</div>;
    if (activeTab === "overview") return renderOverview();
    if (loading)
      return <div className="admin-empty">Loading admin records...</div>;
    if (activeTab === "users" && users.length === 0)
      return <div className="admin-empty">No users found.</div>;
    if (activeTab === "sites" && sites.length === 0)
      return <div className="admin-empty">No sites found.</div>;
    if (activeTab === "scans" && scans.length === 0)
      return <div className="admin-empty">No scans found.</div>;
    if (activeTab === "uptime" && uptime.length === 0)
      return <div className="admin-empty">No uptime monitors found.</div>;
    if (activeTab === "email" && emails.length === 0)
      return <div className="admin-empty">No email outbox records found.</div>;
    if (activeTab === "templates" && emailTemplates.length === 0)
      return <div className="admin-empty">No email templates found.</div>;
    if (activeTab === "shares" && shares.length === 0)
      return <div className="admin-empty">No share links found.</div>;
    if (activeTab === "audit" && auditActions.length === 0)
      return <div className="admin-empty">No admin actions recorded.</div>;
    if (activeTab === "users") return renderUsers();
    if (activeTab === "sites") return renderSites();
    if (activeTab === "scans") return renderScans();
    if (activeTab === "uptime") return renderUptime();
    if (activeTab === "email") return renderEmail();
    if (activeTab === "templates") return renderEmailTemplates();
    if (activeTab === "shares") return renderShares();
    return renderAudit();
  }

  return (
    <div className="admin-page">
      <style>{adminStyles}</style>
      <header className="admin-header">
        <div>
          <span className="admin-warning">Internal admin</span>
          <h1>Scanlark Admin</h1>
          <p>{authUser.email}</p>
        </div>
        <button
          type="button"
          className="admin-button admin-button--secondary"
          onClick={onBackToDashboard}
        >
          Dashboard
        </button>
      </header>

      <div className="admin-shell">
        <nav className="admin-tabs" aria-label="Admin sections">
          {TABS.map((tab) => (
            <button
              type="button"
              key={tab.key}
              className={activeTab === tab.key ? "is-active" : undefined}
              onClick={() => setActiveTab(tab.key)}
            >
              {tab.label}
            </button>
          ))}
        </nav>

        <main className="admin-main">
          <div className="admin-toolbar">
            <div>
              <h2>{TABS.find((tab) => tab.key === activeTab)?.label}</h2>
              {notice && <div className="admin-notice">{notice}</div>}
              {error && <div className="admin-error">{error}</div>}
            </div>
            <div className="admin-toolbar__actions">
              {renderFilters()}
              <button
                type="button"
                className="admin-button admin-button--secondary"
                onClick={() => setRefreshKey((value) => value + 1)}
              >
                Refresh
              </button>
            </div>
          </div>
          {renderActiveTab()}
          {renderPager()}
        </main>

        {renderDetail()}
      </div>
    </div>
  );
}

const adminStyles = `
  .admin-page {
    min-height: 100vh;
    background: var(--bg);
    color: var(--text);
    padding: 18px;
  }
  .admin-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 16px;
    margin: 0 auto 18px;
    max-width: 1480px;
  }
  .admin-header h1 {
    margin: 8px 0 4px;
    font-family: var(--font-display);
    font-size: 28px;
  }
  .admin-header p {
    margin: 0;
    color: var(--text-muted);
    font-size: 13px;
  }
  .admin-warning {
    display: inline-flex;
    align-items: center;
    min-height: 24px;
    border: 1px solid var(--warning);
    border-radius: 999px;
    padding: 0 10px;
    color: var(--warning);
    font-size: 11px;
    font-weight: 700;
    text-transform: uppercase;
  }
  .admin-shell {
    display: grid;
    grid-template-columns: 190px minmax(0, 1fr);
    gap: 16px;
    max-width: 1480px;
    margin: 0 auto;
  }
  .admin-tabs {
    display: flex;
    flex-direction: column;
    gap: 6px;
    align-self: start;
    position: sticky;
    top: 16px;
  }
  .admin-tabs button,
  .admin-actions button,
  .admin-detail button,
  .admin-button {
    border: 1px solid var(--border);
    background: var(--panel);
    color: var(--text);
    border-radius: 8px;
    min-height: 34px;
    padding: 0 10px;
    cursor: pointer;
    font: inherit;
    font-size: 12px;
  }
  .admin-tabs button {
    text-align: left;
    min-height: 38px;
  }
  .admin-tabs button.is-active {
    border-color: var(--accent);
    color: var(--accent);
    background: color-mix(in srgb, var(--accent) 10%, var(--panel));
  }
  .admin-actions button:disabled,
  .admin-button:disabled,
  .admin-detail button:disabled {
    cursor: not-allowed;
    opacity: 0.55;
  }
  .admin-main,
  .admin-detail,
  .admin-panel,
  .admin-card {
    border: 1px solid var(--border);
    background: var(--panel);
    border-radius: 8px;
  }
  .admin-main {
    min-width: 0;
    padding: 14px;
  }
  .admin-toolbar {
    display: flex;
    justify-content: space-between;
    gap: 12px;
    align-items: flex-start;
    margin-bottom: 14px;
  }
  .admin-toolbar h2,
  .admin-panel h2,
  .admin-detail h2 {
    margin: 0;
    font-size: 16px;
    font-family: var(--font-display);
  }
  .admin-toolbar__actions {
    display: flex;
    gap: 10px;
    align-items: flex-end;
    flex-wrap: wrap;
    justify-content: flex-end;
  }
  .admin-filter {
    display: grid;
    gap: 4px;
    font-size: 11px;
    color: var(--text-muted);
  }
  .admin-filter input,
  .admin-filter select {
    min-height: 34px;
    border: 1px solid var(--border);
    border-radius: 8px;
    background: var(--bg);
    color: var(--text);
    padding: 0 10px;
  }
  .admin-card-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(170px, 1fr));
    gap: 10px;
  }
  .admin-card {
    padding: 14px;
  }
  .admin-card__label {
    color: var(--text-muted);
    font-size: 12px;
  }
  .admin-card__value {
    font-size: 28px;
    font-weight: 800;
    margin-top: 8px;
  }
  .admin-section-grid {
    display: grid;
    grid-template-columns: minmax(0, 1.4fr) minmax(280px, 0.6fr);
    gap: 12px;
    margin-top: 14px;
  }
  .admin-panel {
    padding: 14px;
    min-width: 0;
  }
  .admin-placeholder,
  .admin-empty {
    border: 1px dashed var(--border);
    border-radius: 8px;
    padding: 14px;
    color: var(--text-muted);
    font-size: 13px;
    margin-top: 10px;
  }
  .admin-table-wrap {
    overflow: auto;
  }
  .admin-table {
    width: 100%;
    min-width: 860px;
    border-collapse: collapse;
    font-size: 12px;
  }
  .admin-table th,
  .admin-table td {
    border-bottom: 1px solid var(--border);
    padding: 10px 8px;
    text-align: left;
    vertical-align: top;
  }
  .admin-table th {
    color: var(--text-muted);
    font-size: 11px;
    text-transform: uppercase;
  }
  .admin-table strong,
  .admin-table code {
    display: block;
    max-width: 280px;
    overflow-wrap: anywhere;
  }
  .admin-subtext {
    display: block;
    margin-top: 4px;
    color: var(--text-muted);
    max-width: 320px;
    overflow-wrap: anywhere;
  }
  .admin-muted {
    color: var(--text-muted);
  }
  .admin-code {
    white-space: pre-wrap;
    overflow-wrap: anywhere;
    color: var(--text-muted);
  }
  .admin-status {
    display: inline-flex;
    align-items: center;
    min-height: 22px;
    border-radius: 999px;
    padding: 0 8px;
    font-size: 11px;
    font-weight: 700;
    background: var(--border);
    color: var(--text);
  }
  .admin-status--good {
    background: color-mix(in srgb, var(--success) 18%, var(--panel));
    color: var(--success);
  }
  .admin-status--bad {
    background: color-mix(in srgb, var(--danger) 16%, var(--panel));
    color: var(--danger);
  }
  .admin-status--warn {
    background: color-mix(in srgb, var(--warning) 16%, var(--panel));
    color: var(--warning);
  }
  .admin-actions {
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
  }
  .admin-notice,
  .admin-error {
    margin-top: 8px;
    font-size: 12px;
  }
  .admin-notice {
    color: var(--success);
  }
  .admin-error {
    color: var(--warning);
  }
  .admin-pager {
    display: flex;
    justify-content: flex-end;
    align-items: center;
    gap: 10px;
    margin-top: 14px;
    color: var(--text-muted);
    font-size: 12px;
  }
  .admin-detail {
    padding: 14px;
    align-self: start;
    position: sticky;
    top: 16px;
    max-height: calc(100vh - 32px);
    overflow: auto;
  }
  .admin-shell:has(.admin-detail) {
    grid-template-columns: 190px minmax(0, 1fr) minmax(300px, 360px);
  }
  .admin-detail__header {
    display: flex;
    justify-content: space-between;
    gap: 10px;
    align-items: center;
    margin-bottom: 12px;
  }
  .admin-detail__body {
    display: grid;
    gap: 12px;
    font-size: 13px;
  }
  .admin-detail__body p {
    display: grid;
    gap: 4px;
    margin: 0;
  }
  .admin-detail__body p strong {
    color: var(--text-muted);
    font-size: 11px;
    text-transform: uppercase;
  }
  .admin-detail__body h3 {
    margin: 8px 0 0;
    font-size: 13px;
  }
  .admin-mini-row {
    display: flex;
    justify-content: space-between;
    gap: 10px;
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 8px;
  }
  .admin-template-layout {
    display: grid;
    grid-template-columns: minmax(320px, 0.8fr) minmax(0, 1.2fr);
    gap: 14px;
  }
  .admin-template-warning {
    border: 1px solid var(--warning);
    border-radius: 8px;
    color: var(--warning);
    padding: 10px;
    margin-bottom: 12px;
    font-size: 12px;
    font-weight: 700;
  }
  .admin-template-table {
    min-width: 640px;
  }
  .admin-template-table tr {
    cursor: pointer;
  }
  .admin-row-selected td {
    background: color-mix(in srgb, var(--accent) 8%, transparent);
  }
  .admin-template-editor {
    display: grid;
    gap: 12px;
  }
  .admin-template-heading {
    display: flex;
    justify-content: space-between;
    gap: 12px;
    align-items: flex-start;
  }
  .admin-template-heading p {
    margin: 6px 0 0;
    color: var(--text-muted);
    font-size: 13px;
  }
  .admin-field {
    display: grid;
    gap: 5px;
    font-size: 12px;
    color: var(--text-muted);
  }
  .admin-field input,
  .admin-field textarea {
    width: 100%;
    border: 1px solid var(--border);
    border-radius: 8px;
    background: var(--bg);
    color: var(--text);
    padding: 9px 10px;
    font: inherit;
    font-size: 13px;
  }
  .admin-field textarea {
    min-height: 120px;
    resize: vertical;
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas,
      "Liberation Mono", "Courier New", monospace;
  }
  .admin-check {
    display: flex;
    gap: 8px;
    align-items: center;
    font-size: 13px;
  }
  .admin-variable-list {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }
  .admin-variable-list code {
    border: 1px solid var(--border);
    border-radius: 999px;
    padding: 4px 8px;
    color: var(--text-muted);
    background: var(--bg);
    font-size: 11px;
  }
  .admin-template-actions,
  .admin-template-test {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    align-items: flex-end;
  }
  .admin-template-test .admin-field {
    min-width: min(320px, 100%);
    flex: 1;
  }
  .admin-template-preview {
    display: grid;
    gap: 10px;
    border-top: 1px solid var(--border);
    padding-top: 12px;
  }
  .admin-template-preview h3 {
    margin: 0;
    font-size: 14px;
  }
  .admin-template-preview p {
    display: grid;
    gap: 4px;
    margin: 0;
  }
  .admin-template-preview p strong {
    color: var(--text-muted);
    font-size: 11px;
    text-transform: uppercase;
  }
  .admin-template-preview__html,
  .admin-template-preview pre {
    border: 1px solid var(--border);
    border-radius: 8px;
    background: var(--bg);
    padding: 12px;
    overflow: auto;
    overflow-wrap: anywhere;
  }
  .admin-template-preview pre {
    white-space: pre-wrap;
    color: var(--text-muted);
    font-size: 12px;
  }
  @media (max-width: 980px) {
    .admin-page {
      padding: 12px;
    }
    .admin-header,
    .admin-toolbar {
      flex-direction: column;
      align-items: stretch;
    }
    .admin-shell,
    .admin-shell:has(.admin-detail) {
      grid-template-columns: 1fr;
    }
    .admin-tabs {
      position: static;
      flex-direction: row;
      overflow-x: auto;
    }
    .admin-tabs button {
      white-space: nowrap;
    }
    .admin-section-grid {
      grid-template-columns: 1fr;
    }
    .admin-template-layout {
      grid-template-columns: 1fr;
    }
    .admin-detail {
      position: static;
      max-height: none;
    }
  }
`;
