import React, { useCallback, useEffect, useMemo, useState } from "react";

type OperationsRouteKey =
  | "home"
  | "businesses"
  | "pipeline"
  | "tasks"
  | "communications"
  | "reports"
  | "quotes";

type PipelineStage =
  | "discovered"
  | "researched"
  | "ready_to_contact"
  | "email_sent"
  | "replied"
  | "report_requested"
  | "report_sent"
  | "quote_sent"
  | "won"
  | "ongoing_client"
  | "closed";

type RelationshipType =
  | "prospect"
  | "client"
  | "former_client"
  | "partner"
  | "other";

type BusinessListFilter =
  | "active"
  | "follow_up"
  | "prospects"
  | "clients"
  | "ongoing"
  | "archived";

type OperationsSummary = {
  counts: {
    followUpsDue: number;
    prospectsAwaitingContact: number;
    reportsAwaitingReview: number;
    criticalClientSites: number;
    quotesAwaitingResponse: number;
    openWorkItems: number;
  };
  monitoringAttention: Array<{
    id: string;
    severity: "critical" | "warning" | "info";
    title: string;
    detail: string;
    href: string;
    occurredAt: string | null;
  }>;
  recentActivity: Array<{
    id: string;
    title: string;
    detail: string;
    href: string;
    occurredAt: string;
  }>;
  generatedAt: string;
};

type Business = {
  id: string;
  name: string;
  pipeline_stage: PipelineStage;
  relationship_type: RelationshipType;
  source: string | null;
  business_type: string | null;
  location: string | null;
  phone: string | null;
  general_email: string | null;
  website_url: string | null;
  last_contacted_at: string | null;
  next_follow_up_at: string | null;
  next_action: string | null;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
};

type BusinessListRow = Business & {
  primary_contact_id: string | null;
  primary_contact_first_name: string | null;
  primary_contact_last_name: string | null;
  primary_contact_email: string | null;
  primary_contact_phone: string | null;
  linked_site_count: number;
  latest_scan_id: string | null;
  latest_scan_status: string | null;
  latest_scan_finished_at: string | null;
  critical_issue_count: number;
  high_issue_count: number;
  active_incident_count: number;
};

type Contact = {
  id: string;
  business_id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  job_title: string | null;
  is_primary: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

type LinkedSite = {
  site_id: string;
  url: string;
  site_display_name: string | null;
  client_name: string | null;
  report_display_name: string | null;
  disabled_at: string | null;
  linked_at: string;
  uptime_enabled: boolean | null;
  active_incident_id: string | null;
  active_incident_started_at: string | null;
  latest_scan_id: string | null;
  latest_scan_status: string | null;
  latest_scan_finished_at: string | null;
  latest_scan_started_at: string | null;
  latest_scan_score: number | null;
  critical_issue_count: number;
  high_issue_count: number;
};

type BusinessNote = {
  id: string;
  body: string;
  created_at: string;
  created_by_email: string | null;
};

type BusinessReport = {
  scan_run_id: string;
  site_id: string;
  site_url: string;
  site_display_name: string | null;
  status: string;
  finished_at: string | null;
  share_id: string | null;
  share_enabled: boolean | null;
  share_created_at: string | null;
};

type BusinessDetail = {
  business: Business;
  contacts: Contact[];
  primaryContact: Contact | null;
  linkedSites: LinkedSite[];
  notes: BusinessNote[];
  reports: BusinessReport[];
};

type AvailableSite = {
  id: string;
  url: string;
  site_display_name: string | null;
  client_name: string | null;
  owner_email: string | null;
};

type BusinessFormState = {
  name: string;
  websiteUrl: string;
  generalEmail: string;
  phone: string;
  businessType: string;
  location: string;
  source: string;
  pipelineStage: PipelineStage;
  relationshipType: RelationshipType;
  primaryContactName: string;
  primaryContactEmail: string;
  primaryContactPhone: string;
  initialNote: string;
  nextFollowUpAt: string;
  nextAction: string;
};

type ContactFormState = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  jobTitle: string;
  notes: string;
  isPrimary: boolean;
};

type OperationsPageProps = {
  apiBase: string;
  apiFetch: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
  currentPath: string;
  currentSearch: string;
  authEmail: string;
  onNavigate: (href: string) => void;
  onLogout: () => void;
};

const pipelineStageOptions: Array<{ value: PipelineStage; label: string }> = [
  { value: "discovered", label: "Discovered" },
  { value: "researched", label: "Researched" },
  { value: "ready_to_contact", label: "Ready to contact" },
  { value: "email_sent", label: "Email sent" },
  { value: "replied", label: "Replied" },
  { value: "report_requested", label: "Report requested" },
  { value: "report_sent", label: "Report sent" },
  { value: "quote_sent", label: "Quote sent" },
  { value: "won", label: "Won" },
  { value: "ongoing_client", label: "Ongoing client" },
  { value: "closed", label: "Closed" },
];

const relationshipTypeOptions: Array<{
  value: RelationshipType;
  label: string;
}> = [
  { value: "prospect", label: "Prospect" },
  { value: "client", label: "Client" },
  { value: "former_client", label: "Former client" },
  { value: "partner", label: "Partner" },
  { value: "other", label: "Other" },
];

const routeItems: Array<{
  key: OperationsRouteKey;
  label: string;
  href: string;
}> = [
  { key: "home", label: "Home", href: "/operations" },
  { key: "businesses", label: "Businesses", href: "/operations/businesses" },
  { key: "pipeline", label: "Pipeline", href: "/operations/pipeline" },
  { key: "tasks", label: "Tasks", href: "/operations/tasks" },
  {
    key: "communications",
    label: "Communications",
    href: "/operations/communications",
  },
  { key: "reports", label: "Reports", href: "/operations/reports" },
  { key: "quotes", label: "Quotes", href: "/operations/quotes" },
];

const placeholderContent: Record<
  Exclude<OperationsRouteKey, "home" | "businesses" | "pipeline">,
  {
    eyebrow: string;
    title: string;
    body: string;
    action: string;
    bullets: string[];
  }
> = {
  tasks: {
    eyebrow: "Daily work",
    title: "Tasks",
    body: "Manage follow-ups, report reviews, re-scans, client work, and recurring monitoring tasks.",
    action: "View follow-ups",
    bullets: [
      "Follow-ups",
      "Report reviews",
      "Re-scans",
      "Client work",
      "Recurring monitoring tasks",
    ],
  },
  communications: {
    eyebrow: "Client messaging",
    title: "Communications",
    body: "Manage client outreach drafts, sent communication records, email templates, and follow-up reminders separately from automated transactional email templates.",
    action: "Open businesses",
    bullets: [
      "Client email templates",
      "Outreach drafts",
      "Sent communication records",
      "Follow-up reminders",
    ],
  },
  reports: {
    eyebrow: "Report workflow",
    title: "Reports",
    body: "Track the commercial lifecycle around client reports without duplicating the existing report renderer.",
    action: "Review monitoring reports",
    bullets: [
      "Draft",
      "Needs review",
      "Ready to send",
      "Sent",
      "Client replied",
      "Fixes quoted",
      "Completed",
    ],
  },
  quotes: {
    eyebrow: "Commercial work",
    title: "Quotes",
    body: "Manage draft quotes, sent quotes, accepted work, and declined or expired opportunities.",
    action: "Open businesses",
    bullets: [
      "Draft quotes",
      "Sent quotes",
      "Accepted work",
      "Declined or expired quotes",
    ],
  },
};

const emptySummary: OperationsSummary = {
  counts: {
    followUpsDue: 0,
    prospectsAwaitingContact: 0,
    reportsAwaitingReview: 0,
    criticalClientSites: 0,
    quotesAwaitingResponse: 0,
    openWorkItems: 0,
  },
  monitoringAttention: [],
  recentActivity: [],
  generatedAt: new Date(0).toISOString(),
};

const emptyBusinessForm: BusinessFormState = {
  name: "",
  websiteUrl: "",
  generalEmail: "",
  phone: "",
  businessType: "",
  location: "",
  source: "",
  pipelineStage: "discovered",
  relationshipType: "prospect",
  primaryContactName: "",
  primaryContactEmail: "",
  primaryContactPhone: "",
  initialNote: "",
  nextFollowUpAt: "",
  nextAction: "",
};

const emptyContactForm: ContactFormState = {
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  jobTitle: "",
  notes: "",
  isPrimary: false,
};

function getRouteKey(path: string): OperationsRouteKey {
  const normalized = path.replace(/\/+$/, "") || "/operations";
  if (normalized === "/operations") return "home";
  if (normalized === "/operations/pipeline") return "pipeline";
  if (
    normalized === "/operations/businesses" ||
    normalized.startsWith("/operations/businesses/")
  ) {
    return "businesses";
  }
  const found = routeItems.find((item) => item.href === normalized);
  return found?.key ?? "home";
}

function getBusinessIdFromPath(path: string) {
  const normalized = path.replace(/\/+$/, "");
  const prefix = "/operations/businesses/";
  if (!normalized.startsWith(prefix)) return null;
  const id = normalized.slice(prefix.length);
  return id || null;
}

function formatDate(value: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

function formatDateTime(value: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function stageLabel(value: PipelineStage) {
  return (
    pipelineStageOptions.find((item) => item.value === value)?.label ?? value
  );
}

function relationshipLabel(value: RelationshipType) {
  return (
    relationshipTypeOptions.find((item) => item.value === value)?.label ?? value
  );
}

function contactName(contact: Contact | BusinessListRow | null | undefined) {
  if (!contact) return "No contact";
  const first =
    "first_name" in contact
      ? contact.first_name
      : contact.primary_contact_first_name;
  const last =
    "last_name" in contact
      ? contact.last_name
      : contact.primary_contact_last_name;
  const email =
    "email" in contact ? contact.email : contact.primary_contact_email;
  const name = [first, last].filter(Boolean).join(" ").trim();
  return name || email || "No contact";
}

function splitContactName(value: string) {
  const parts = value.trim().split(/\s+/).filter(Boolean);
  if (parts.length <= 1) return { firstName: parts[0] ?? "", lastName: "" };
  return {
    firstName: parts.slice(0, -1).join(" "),
    lastName: parts.at(-1) ?? "",
  };
}

function isOverdue(value: string | null) {
  if (!value) return false;
  const date = new Date(value);
  return !Number.isNaN(date.getTime()) && date.getTime() <= Date.now();
}

function buildQuery(params: Record<string, string | null | undefined>) {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value != null && value !== "") query.set(key, value);
  });
  const text = query.toString();
  return text ? `?${text}` : "";
}

export const OperationsPage: React.FC<OperationsPageProps> = ({
  apiBase,
  apiFetch,
  currentPath,
  currentSearch,
  authEmail,
  onNavigate,
  onLogout,
}) => {
  const activeRoute = getRouteKey(currentPath);
  const businessId = getBusinessIdFromPath(currentPath);
  const searchParams = useMemo(
    () => new URLSearchParams(currentSearch),
    [currentSearch],
  );
  const [summary, setSummary] = useState<OperationsSummary>(emptySummary);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const [businesses, setBusinesses] = useState<BusinessListRow[]>([]);
  const [businessesTotal, setBusinessesTotal] = useState(0);
  const [businessesLoading, setBusinessesLoading] = useState(false);
  const [businessesError, setBusinessesError] = useState<string | null>(null);
  const [detail, setDetail] = useState<BusinessDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [pipelineStages, setPipelineStages] = useState<
    Array<{ stage: PipelineStage; businesses: BusinessListRow[] }>
  >([]);
  const [pipelineLoading, setPipelineLoading] = useState(false);
  const [availableSites, setAvailableSites] = useState<AvailableSite[]>([]);
  const [addBusinessOpen, setAddBusinessOpen] = useState(false);
  const [businessForm, setBusinessForm] =
    useState<BusinessFormState>(emptyBusinessForm);
  const [businessSaving, setBusinessSaving] = useState(false);
  const [businessFormError, setBusinessFormError] = useState<string | null>(
    null,
  );
  const [editBusinessOpen, setEditBusinessOpen] = useState(false);
  const [contactFormOpen, setContactFormOpen] = useState(false);
  const [editingContactId, setEditingContactId] = useState<string | null>(null);
  const [contactForm, setContactForm] =
    useState<ContactFormState>(emptyContactForm);
  const [noteBody, setNoteBody] = useState("");
  const [selectedSiteId, setSelectedSiteId] = useState("");
  const [clearFollowUpOnContact, setClearFollowUpOnContact] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const activeFilter =
    (searchParams.get("filter") as BusinessListFilter | null) ?? "active";
  const search = searchParams.get("search") ?? "";
  const sort = searchParams.get("sort") ?? "updated_desc";

  const loadSummary = useCallback(async () => {
    setSummaryLoading(true);
    setSummaryError(null);
    try {
      const res = await apiFetch(`${apiBase}/operations/summary`, {
        cache: "no-store",
      });
      if (!res.ok) throw new Error(`Request failed: ${res.status}`);
      setSummary((await res.json()) as OperationsSummary);
    } catch (err) {
      console.warn("Failed to load operations summary", err);
      setSummaryError("Operations summary is unavailable.");
      setSummary(emptySummary);
    } finally {
      setSummaryLoading(false);
    }
  }, [apiBase, apiFetch]);

  const loadBusinesses = useCallback(async () => {
    setBusinessesLoading(true);
    setBusinessesError(null);
    const params: Record<string, string | null | undefined> = {
      search,
      sort,
      archived: activeFilter === "archived" ? "true" : "false",
      followUpDue: activeFilter === "follow_up" ? "true" : undefined,
      relationshipType:
        activeFilter === "prospects"
          ? "prospect"
          : activeFilter === "clients"
            ? "client"
            : undefined,
      pipelineStage: activeFilter === "ongoing" ? "ongoing_client" : undefined,
      limit: "50",
      offset: "0",
    };
    try {
      const res = await apiFetch(
        `${apiBase}/operations/businesses${buildQuery(params)}`,
        {
          cache: "no-store",
        },
      );
      if (!res.ok) throw new Error(`Request failed: ${res.status}`);
      const data = (await res.json()) as {
        businesses: BusinessListRow[];
        totalMatching: number;
      };
      setBusinesses(data.businesses);
      setBusinessesTotal(data.totalMatching);
    } catch (err) {
      console.warn("Failed to load businesses", err);
      setBusinessesError("Businesses could not be loaded.");
      setBusinesses([]);
      setBusinessesTotal(0);
    } finally {
      setBusinessesLoading(false);
    }
  }, [activeFilter, apiBase, apiFetch, search, sort]);

  const loadDetail = useCallback(async () => {
    if (!businessId) return;
    setDetailLoading(true);
    setDetailError(null);
    try {
      const res = await apiFetch(
        `${apiBase}/operations/businesses/${encodeURIComponent(businessId)}`,
        {
          cache: "no-store",
        },
      );
      if (res.status === 404) {
        setDetail(null);
        setDetailError("Business not found.");
        return;
      }
      if (!res.ok) throw new Error(`Request failed: ${res.status}`);
      const data = (await res.json()) as { business: BusinessDetail };
      setDetail(data.business);
    } catch (err) {
      console.warn("Failed to load business", err);
      setDetailError("Business could not be loaded.");
      setDetail(null);
    } finally {
      setDetailLoading(false);
    }
  }, [apiBase, apiFetch, businessId]);

  const loadPipeline = useCallback(async () => {
    setPipelineLoading(true);
    try {
      const res = await apiFetch(`${apiBase}/operations/pipeline`, {
        cache: "no-store",
      });
      if (!res.ok) throw new Error(`Request failed: ${res.status}`);
      const data = (await res.json()) as {
        stages: Array<{ stage: PipelineStage; businesses: BusinessListRow[] }>;
      };
      setPipelineStages(data.stages);
    } catch (err) {
      console.warn("Failed to load pipeline", err);
      setPipelineStages([]);
    } finally {
      setPipelineLoading(false);
    }
  }, [apiBase, apiFetch]);

  const loadAvailableSites = useCallback(async () => {
    try {
      const res = await apiFetch(`${apiBase}/operations/sites`, {
        cache: "no-store",
      });
      if (!res.ok) throw new Error(`Request failed: ${res.status}`);
      const data = (await res.json()) as { sites: AvailableSite[] };
      setAvailableSites(data.sites);
    } catch (err) {
      console.warn("Failed to load available sites", err);
      setAvailableSites([]);
    }
  }, [apiBase, apiFetch]);

  useEffect(() => {
    void loadSummary();
  }, [loadSummary]);

  useEffect(() => {
    if (activeRoute === "businesses" && !businessId) void loadBusinesses();
  }, [activeRoute, businessId, loadBusinesses]);

  useEffect(() => {
    if (businessId) {
      void loadDetail();
      void loadAvailableSites();
    }
  }, [businessId, loadAvailableSites, loadDetail]);

  useEffect(() => {
    if (activeRoute === "pipeline") void loadPipeline();
  }, [activeRoute, loadPipeline]);

  const attentionCards = useMemo(
    () => [
      {
        label: "Follow-ups due",
        value: summary.counts.followUpsDue,
        detail: "Client and prospect follow-ups that need action.",
        href: "/operations/businesses?filter=follow_up&sort=next_follow_up",
      },
      {
        label: "Prospects awaiting contact",
        value: summary.counts.prospectsAwaitingContact,
        detail: "Prospects still in the early outreach stages.",
        href: "/operations/businesses?filter=prospects&sort=next_follow_up",
      },
      {
        label: "Reports awaiting review",
        value: summary.counts.reportsAwaitingReview,
        detail: "Recent completed scans that may need a report pass.",
        href: "/operations/reports",
      },
      {
        label: "Client websites with critical issues",
        value: summary.counts.criticalClientSites,
        detail: "Latest reports with open critical or high-priority issues.",
        href: "/dashboard?selectSite=1",
      },
      {
        label: "Quotes awaiting response",
        value: summary.counts.quotesAwaitingResponse,
        detail: "Sent quotes waiting on a client decision.",
        href: "/operations/quotes",
      },
      {
        label: "Open work items",
        value: summary.counts.openWorkItems,
        detail: "Active work that has not been closed.",
        href: "/operations/tasks",
      },
    ],
    [summary.counts],
  );

  const renderLink = (
    href: string,
    label: React.ReactNode,
    className = "ops-link",
  ) => (
    <a
      href={href}
      className={className}
      onClick={(event) => {
        event.preventDefault();
        onNavigate(href);
      }}
    >
      {label}
    </a>
  );

  function updateListUrl(
    next: Partial<{ filter: BusinessListFilter; search: string; sort: string }>,
  ) {
    onNavigate(
      `/operations/businesses${buildQuery({
        filter: next.filter ?? activeFilter,
        search: next.search ?? search,
        sort: next.sort ?? sort,
      })}`,
    );
  }

  async function submitBusiness(event: React.FormEvent) {
    event.preventDefault();
    setBusinessSaving(true);
    setBusinessFormError(null);
    const primaryName = splitContactName(businessForm.primaryContactName);
    try {
      const res = await apiFetch(`${apiBase}/operations/businesses`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: businessForm.name,
          websiteUrl: businessForm.websiteUrl,
          generalEmail: businessForm.generalEmail,
          phone: businessForm.phone,
          businessType: businessForm.businessType,
          location: businessForm.location,
          source: businessForm.source,
          pipelineStage: businessForm.pipelineStage,
          relationshipType: businessForm.relationshipType,
          nextFollowUpAt: businessForm.nextFollowUpAt || null,
          nextAction: businessForm.nextAction,
          initialNote: businessForm.initialNote,
          primaryContact:
            businessForm.primaryContactName ||
            businessForm.primaryContactEmail ||
            businessForm.primaryContactPhone
              ? {
                  ...primaryName,
                  email: businessForm.primaryContactEmail,
                  phone: businessForm.primaryContactPhone,
                  isPrimary: true,
                }
              : null,
        }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as {
          message?: string;
        } | null;
        throw new Error(data?.message ?? "Failed to add business");
      }
      const data = (await res.json()) as { business: BusinessDetail };
      setAddBusinessOpen(false);
      setBusinessForm(emptyBusinessForm);
      await loadSummary();
      onNavigate(`/operations/businesses/${data.business.business.id}`);
    } catch (err) {
      setBusinessFormError(
        err instanceof Error ? err.message : "Failed to add business",
      );
    } finally {
      setBusinessSaving(false);
    }
  }

  async function patchBusiness(input: Record<string, unknown>) {
    if (!detail) return;
    setActionError(null);
    const res = await apiFetch(
      `${apiBase}/operations/businesses/${encodeURIComponent(detail.business.id)}`,
      {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(input),
      },
    );
    if (!res.ok) {
      const data = (await res.json().catch(() => null)) as {
        message?: string;
      } | null;
      throw new Error(data?.message ?? "Failed to update business");
    }
    await loadDetail();
    await loadSummary();
  }

  async function submitEditBusiness(event: React.FormEvent) {
    event.preventDefault();
    if (!detail) return;
    setBusinessSaving(true);
    setBusinessFormError(null);
    try {
      await patchBusiness({
        name: businessForm.name,
        websiteUrl: businessForm.websiteUrl,
        generalEmail: businessForm.generalEmail,
        phone: businessForm.phone,
        businessType: businessForm.businessType,
        location: businessForm.location,
        source: businessForm.source,
        pipelineStage: businessForm.pipelineStage,
        relationshipType: businessForm.relationshipType,
        nextFollowUpAt: businessForm.nextFollowUpAt || null,
        nextAction: businessForm.nextAction,
      });
      setEditBusinessOpen(false);
    } catch (err) {
      setBusinessFormError(
        err instanceof Error ? err.message : "Failed to update business",
      );
    } finally {
      setBusinessSaving(false);
    }
  }

  async function submitContact(event: React.FormEvent) {
    event.preventDefault();
    if (!detail) return;
    setActionError(null);
    try {
      const url = editingContactId
        ? `${apiBase}/operations/businesses/${encodeURIComponent(
            detail.business.id,
          )}/contacts/${encodeURIComponent(editingContactId)}`
        : `${apiBase}/operations/businesses/${encodeURIComponent(
            detail.business.id,
          )}/contacts`;
      const res = await apiFetch(url, {
        method: editingContactId ? "PATCH" : "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(contactForm),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as {
          message?: string;
        } | null;
        throw new Error(data?.message ?? "Failed to add contact");
      }
      setContactForm(emptyContactForm);
      setEditingContactId(null);
      setContactFormOpen(false);
      await loadDetail();
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : "Failed to add contact",
      );
    }
  }

  async function submitNote(event: React.FormEvent) {
    event.preventDefault();
    if (!detail || !noteBody.trim()) return;
    setActionError(null);
    try {
      const res = await apiFetch(
        `${apiBase}/operations/businesses/${encodeURIComponent(detail.business.id)}/notes`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ body: noteBody }),
        },
      );
      if (!res.ok) throw new Error("Failed to add note");
      setNoteBody("");
      await loadDetail();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to add note");
    }
  }

  async function linkSite(event: React.FormEvent) {
    event.preventDefault();
    if (!detail || !selectedSiteId) return;
    setActionError(null);
    try {
      const res = await apiFetch(
        `${apiBase}/operations/businesses/${encodeURIComponent(detail.business.id)}/sites`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ siteId: selectedSiteId }),
        },
      );
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as {
          message?: string;
        } | null;
        throw new Error(data?.message ?? "Failed to link site");
      }
      setSelectedSiteId("");
      await loadDetail();
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : "Failed to link site",
      );
    }
  }

  async function runDetailAction(action: () => Promise<void>) {
    setActionError(null);
    try {
      await action();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Action failed");
    }
  }

  function openEditBusiness() {
    if (!detail) return;
    const b = detail.business;
    setBusinessForm({
      ...emptyBusinessForm,
      name: b.name,
      websiteUrl: b.website_url ?? "",
      generalEmail: b.general_email ?? "",
      phone: b.phone ?? "",
      businessType: b.business_type ?? "",
      location: b.location ?? "",
      source: b.source ?? "",
      pipelineStage: b.pipeline_stage,
      relationshipType: b.relationship_type,
      nextFollowUpAt: b.next_follow_up_at
        ? b.next_follow_up_at.slice(0, 10)
        : "",
      nextAction: b.next_action ?? "",
    });
    setEditBusinessOpen(true);
  }

  function openEditContact(contact: Contact) {
    setEditingContactId(contact.id);
    setContactForm({
      firstName: contact.first_name ?? "",
      lastName: contact.last_name ?? "",
      email: contact.email ?? "",
      phone: contact.phone ?? "",
      jobTitle: contact.job_title ?? "",
      notes: contact.notes ?? "",
      isPrimary: contact.is_primary,
    });
    setContactFormOpen(true);
  }

  function renderBusinessForm(mode: "create" | "edit") {
    return (
      <form
        className="ops-form"
        onSubmit={mode === "create" ? submitBusiness : submitEditBusiness}
      >
        <div className="ops-form-grid">
          <label>
            Business name
            <input
              value={businessForm.name}
              onChange={(event) =>
                setBusinessForm((prev) => ({
                  ...prev,
                  name: event.target.value,
                }))
              }
              required
            />
          </label>
          <label>
            Website URL
            <input
              value={businessForm.websiteUrl}
              onChange={(event) =>
                setBusinessForm((prev) => ({
                  ...prev,
                  websiteUrl: event.target.value,
                }))
              }
              placeholder="https://example.com"
            />
          </label>
          <label>
            Pipeline stage
            <select
              value={businessForm.pipelineStage}
              onChange={(event) =>
                setBusinessForm((prev) => ({
                  ...prev,
                  pipelineStage: event.target.value as PipelineStage,
                }))
              }
            >
              {pipelineStageOptions.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Relationship type
            <select
              value={businessForm.relationshipType}
              onChange={(event) =>
                setBusinessForm((prev) => ({
                  ...prev,
                  relationshipType: event.target.value as RelationshipType,
                }))
              }
            >
              {relationshipTypeOptions.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            General email
            <input
              value={businessForm.generalEmail}
              onChange={(event) =>
                setBusinessForm((prev) => ({
                  ...prev,
                  generalEmail: event.target.value,
                }))
              }
              type="email"
            />
          </label>
          <label>
            Phone
            <input
              value={businessForm.phone}
              onChange={(event) =>
                setBusinessForm((prev) => ({
                  ...prev,
                  phone: event.target.value,
                }))
              }
            />
          </label>
          <label>
            Business type
            <input
              value={businessForm.businessType}
              onChange={(event) =>
                setBusinessForm((prev) => ({
                  ...prev,
                  businessType: event.target.value,
                }))
              }
            />
          </label>
          <label>
            Location
            <input
              value={businessForm.location}
              onChange={(event) =>
                setBusinessForm((prev) => ({
                  ...prev,
                  location: event.target.value,
                }))
              }
            />
          </label>
          <label>
            Source
            <input
              value={businessForm.source}
              onChange={(event) =>
                setBusinessForm((prev) => ({
                  ...prev,
                  source: event.target.value,
                }))
              }
            />
          </label>
          <label>
            Next follow-up
            <input
              value={businessForm.nextFollowUpAt}
              onChange={(event) =>
                setBusinessForm((prev) => ({
                  ...prev,
                  nextFollowUpAt: event.target.value,
                }))
              }
              type="date"
            />
          </label>
        </div>
        <label>
          Next action
          <input
            value={businessForm.nextAction}
            onChange={(event) =>
              setBusinessForm((prev) => ({
                ...prev,
                nextAction: event.target.value,
              }))
            }
          />
        </label>
        {mode === "create" && (
          <>
            <div className="ops-section-label">Primary contact</div>
            <div className="ops-form-grid">
              <label>
                Name
                <input
                  value={businessForm.primaryContactName}
                  onChange={(event) =>
                    setBusinessForm((prev) => ({
                      ...prev,
                      primaryContactName: event.target.value,
                    }))
                  }
                />
              </label>
              <label>
                Email
                <input
                  value={businessForm.primaryContactEmail}
                  onChange={(event) =>
                    setBusinessForm((prev) => ({
                      ...prev,
                      primaryContactEmail: event.target.value,
                    }))
                  }
                  type="email"
                />
              </label>
              <label>
                Phone
                <input
                  value={businessForm.primaryContactPhone}
                  onChange={(event) =>
                    setBusinessForm((prev) => ({
                      ...prev,
                      primaryContactPhone: event.target.value,
                    }))
                  }
                />
              </label>
            </div>
            <label>
              Initial note
              <textarea
                value={businessForm.initialNote}
                onChange={(event) =>
                  setBusinessForm((prev) => ({
                    ...prev,
                    initialNote: event.target.value,
                  }))
                }
              />
            </label>
          </>
        )}
        {businessFormError && (
          <div className="ops-error">{businessFormError}</div>
        )}
        <div className="ops-form-actions">
          <button
            type="submit"
            className="ops-button ops-button--primary"
            disabled={businessSaving}
          >
            {businessSaving
              ? "Saving..."
              : mode === "create"
                ? "Add business"
                : "Save changes"}
          </button>
          <button
            type="button"
            className="ops-button"
            onClick={() => {
              setAddBusinessOpen(false);
              setEditBusinessOpen(false);
              setBusinessFormError(null);
            }}
          >
            Cancel
          </button>
        </div>
      </form>
    );
  }

  function renderHome() {
    return (
      <>
        <section className="ops-hero">
          <div>
            <div className="ops-badge">Internal Operations</div>
            <h1>Operations</h1>
            <p>
              Manage prospects, client reports, follow-ups and website work.
            </p>
            <span className="ops-muted">
              {summary.generatedAt === emptySummary.generatedAt
                ? "No summary loaded yet"
                : `Updated ${formatDateTime(summary.generatedAt)}`}
            </span>
          </div>
          <button
            type="button"
            className="ops-button ops-button--primary"
            onClick={() => void loadSummary()}
            disabled={summaryLoading}
          >
            {summaryLoading ? "Refreshing..." : "Refresh"}
          </button>
        </section>
        {summaryError && <div className="ops-error">{summaryError}</div>}
        <section className="ops-card-grid" aria-label="Attention summary">
          {attentionCards.map((card) => (
            <button
              key={card.label}
              type="button"
              className="ops-summary-card"
              onClick={() => onNavigate(card.href)}
            >
              <span>{card.label}</span>
              <strong>{card.value}</strong>
              <small>{card.detail}</small>
            </button>
          ))}
        </section>
        <section className="ops-two-column">
          <div className="ops-panel">
            <div className="ops-panel__header">
              <div>
                <div className="ops-eyebrow">Today</div>
                <h2>Today's work</h2>
              </div>
              {renderLink(
                "/operations/businesses?filter=follow_up&sort=next_follow_up",
                "View follow-ups",
              )}
            </div>
            <div className="ops-work-grid">
              {[
                ["Follow-ups due", summary.counts.followUpsDue],
                [
                  "Prospects awaiting contact",
                  summary.counts.prospectsAwaitingContact,
                ],
                [
                  "Reports awaiting review",
                  summary.counts.reportsAwaitingReview,
                ],
              ].map(([label, value]) => (
                <div key={label} className="ops-empty-card">
                  <strong>{label}</strong>
                  <p>
                    {value} item{value === 1 ? "" : "s"} currently need review.
                  </p>
                </div>
              ))}
            </div>
          </div>
          <div className="ops-panel">
            <div className="ops-panel__header">
              <div>
                <div className="ops-eyebrow">Actions</div>
                <h2>Quick actions</h2>
              </div>
            </div>
            <div className="ops-action-grid">
              <button
                className="ops-button"
                onClick={() => setAddBusinessOpen(true)}
              >
                Add prospect
              </button>
              {renderLink("/sites/new", "Add or monitor website", "ops-button")}
              {renderLink(
                "/dashboard?selectSite=1",
                "Start scan",
                "ops-button",
              )}
              {renderLink(
                "/operations/reports",
                "Review reports",
                "ops-button",
              )}
              {renderLink(
                "/operations/businesses?filter=follow_up",
                "View follow-ups",
                "ops-button",
              )}
              {renderLink("/operations/quotes", "Create quote", "ops-button")}
            </div>
          </div>
        </section>
        <section className="ops-two-column">
          <div className="ops-panel">
            <div className="ops-panel__header">
              <div>
                <div className="ops-eyebrow">Monitoring</div>
                <h2>Needs attention</h2>
              </div>
              {renderLink("/dashboard?selectSite=1", "Open monitoring")}
            </div>
            {summary.monitoringAttention.length > 0 ? (
              <div className="ops-list">
                {summary.monitoringAttention.map((item) => (
                  <button
                    type="button"
                    key={item.id}
                    className={`ops-list-item ${item.severity}`}
                    onClick={() => onNavigate(item.href)}
                  >
                    <strong>{item.title}</strong>
                    <span>{item.detail}</span>
                    <small>{formatDateTime(item.occurredAt)}</small>
                  </button>
                ))}
              </div>
            ) : (
              <div className="ops-empty-card">
                <strong>No monitoring warnings</strong>
                <p>
                  No down sites, recent failed scans, or critical client website
                  issues need attention right now.
                </p>
              </div>
            )}
          </div>
          <div className="ops-panel">
            <div className="ops-panel__header">
              <div>
                <div className="ops-eyebrow">Activity</div>
                <h2>Recent activity</h2>
              </div>
            </div>
            {summary.recentActivity.length > 0 ? (
              <div className="ops-timeline">
                {summary.recentActivity.map((item) => (
                  <button
                    type="button"
                    key={item.id}
                    className="ops-activity"
                    onClick={() => onNavigate(item.href)}
                  >
                    <strong>{item.title}</strong>
                    <span>{item.detail}</span>
                    <small>{formatDateTime(item.occurredAt)}</small>
                  </button>
                ))}
              </div>
            ) : (
              <div className="ops-empty-card">
                <strong>No activity yet</strong>
                <p>
                  Site additions, scan completions, shared reports and uptime
                  alerts will appear here.
                </p>
              </div>
            )}
          </div>
        </section>
        {addBusinessOpen && (
          <div className="ops-modal">
            <div className="ops-modal__panel">
              <div className="ops-panel__header">
                <h2>Add business</h2>
                <button
                  className="ops-button"
                  onClick={() => setAddBusinessOpen(false)}
                >
                  Close
                </button>
              </div>
              {renderBusinessForm("create")}
            </div>
          </div>
        )}
      </>
    );
  }

  function renderBusinessesList() {
    const filters: Array<{ key: BusinessListFilter; label: string }> = [
      { key: "active", label: "All active" },
      { key: "follow_up", label: "Follow-up due" },
      { key: "prospects", label: "Prospects" },
      { key: "clients", label: "Clients" },
      { key: "ongoing", label: "Ongoing clients" },
      { key: "archived", label: "Archived" },
    ];
    return (
      <>
        <section className="ops-hero">
          <div>
            <div className="ops-eyebrow">Relationships</div>
            <h1>Businesses</h1>
            <p>Manage prospects, clients, contacts and monitored websites.</p>
          </div>
          <button
            type="button"
            className="ops-button ops-button--primary"
            onClick={() => {
              setBusinessForm(emptyBusinessForm);
              setAddBusinessOpen(true);
            }}
          >
            Add business
          </button>
        </section>
        <section className="ops-panel">
          <div className="ops-filterbar">
            <input
              aria-label="Search businesses"
              placeholder="Search businesses, contacts, email or website"
              value={search}
              onChange={(event) =>
                updateListUrl({ search: event.target.value })
              }
            />
            <select
              value={sort}
              onChange={(event) => updateListUrl({ sort: event.target.value })}
            >
              <option value="updated_desc">Recently updated</option>
              <option value="name">Name</option>
              <option value="next_follow_up">Next follow-up</option>
            </select>
          </div>
          <div className="ops-segmented">
            {filters.map((filter) => (
              <button
                key={filter.key}
                type="button"
                className={activeFilter === filter.key ? "active" : ""}
                onClick={() => updateListUrl({ filter: filter.key })}
              >
                {filter.label}
              </button>
            ))}
          </div>
        </section>
        {businessesError && <div className="ops-error">{businessesError}</div>}
        <section className="ops-panel">
          <div className="ops-panel__header">
            <h2>
              {businessesLoading
                ? "Loading businesses"
                : `${businessesTotal} businesses`}
            </h2>
          </div>
          {businesses.length === 0 && !businessesLoading ? (
            <div className="ops-empty-panel">
              <h2>No businesses yet</h2>
              <p>
                No businesses yet. Add prospects you want to research and track
                them from first contact through to ongoing client.
              </p>
              <button
                className="ops-button ops-button--primary"
                onClick={() => setAddBusinessOpen(true)}
              >
                Add your first business
              </button>
            </div>
          ) : (
            <div className="ops-table">
              <div className="ops-table__head">
                <span>Business</span>
                <span>Contact</span>
                <span>Stage</span>
                <span>Follow-up</span>
                <span>Website attention</span>
                <span>Updated</span>
              </div>
              {businesses.map((business) => (
                <button
                  type="button"
                  className="ops-table__row"
                  key={business.id}
                  onClick={() =>
                    onNavigate(`/operations/businesses/${business.id}`)
                  }
                >
                  <span>
                    <strong>{business.name}</strong>
                    <small>
                      {business.website_url ??
                        `${business.linked_site_count} linked site${business.linked_site_count === 1 ? "" : "s"}`}
                    </small>
                  </span>
                  <span>
                    {contactName(business)}
                    <small>
                      {business.primary_contact_email ??
                        business.primary_contact_phone ??
                        ""}
                    </small>
                  </span>
                  <span>
                    {stageLabel(business.pipeline_stage)}
                    <small>
                      {relationshipLabel(business.relationship_type)}
                    </small>
                  </span>
                  <span>
                    {business.next_follow_up_at ? (
                      <strong
                        className={
                          isOverdue(business.next_follow_up_at)
                            ? "ops-overdue"
                            : ""
                        }
                      >
                        {isOverdue(business.next_follow_up_at)
                          ? "Overdue: "
                          : ""}
                        {formatDate(business.next_follow_up_at)}
                      </strong>
                    ) : (
                      "-"
                    )}
                    <small>{business.next_action ?? ""}</small>
                  </span>
                  <span>
                    {business.active_incident_count > 0
                      ? "Site down"
                      : business.critical_issue_count +
                            business.high_issue_count >
                          0
                        ? `${business.critical_issue_count} critical, ${business.high_issue_count} high`
                        : "No warnings"}
                    <small>{business.latest_scan_status ?? "No scans"}</small>
                  </span>
                  <span>{formatDateTime(business.updated_at)}</span>
                </button>
              ))}
            </div>
          )}
        </section>
        {addBusinessOpen && (
          <div className="ops-modal">
            <div className="ops-modal__panel">
              <div className="ops-panel__header">
                <h2>Add business</h2>
                <button
                  className="ops-button"
                  onClick={() => setAddBusinessOpen(false)}
                >
                  Close
                </button>
              </div>
              {renderBusinessForm("create")}
            </div>
          </div>
        )}
      </>
    );
  }

  function renderBusinessDetail() {
    if (detailLoading)
      return <div className="ops-panel">Loading business...</div>;
    if (detailError || !detail) {
      return (
        <section className="ops-empty-panel">
          <h1>{detailError ?? "Business not found"}</h1>
          {renderLink(
            "/operations/businesses",
            "Back to businesses",
            "ops-button",
          )}
        </section>
      );
    }
    const b = detail.business;
    return (
      <>
        <section className="ops-hero">
          <div>
            <div className="ops-eyebrow">
              {relationshipLabel(b.relationship_type)}
            </div>
            <h1>{b.name}</h1>
            <p>
              {stageLabel(b.pipeline_stage)} · Primary contact:{" "}
              {contactName(detail.primaryContact)}
            </p>
            <div className="ops-meta-row">
              <span>Next follow-up: {formatDate(b.next_follow_up_at)}</span>
              <span>Next action: {b.next_action ?? "-"}</span>
              <span>
                Website status:{" "}
                {detail.linkedSites.some((site) => site.active_incident_id)
                  ? "Attention needed"
                  : "No active incidents"}
              </span>
            </div>
          </div>
          <div className="ops-action-grid">
            <button className="ops-button" onClick={openEditBusiness}>
              Edit business
            </button>
            <button
              className="ops-button"
              onClick={() => {
                setEditingContactId(null);
                setContactForm(emptyContactForm);
                setContactFormOpen(true);
              }}
            >
              Add contact
            </button>
            <button
              className="ops-button"
              onClick={() =>
                void runDetailAction(async () => {
                  await patchBusiness({
                    markContactedNow: true,
                    clearNextFollowUp: clearFollowUpOnContact,
                  });
                })
              }
            >
              Mark contacted now
            </button>
            <button
              className="ops-button"
              onClick={() =>
                window.confirm(
                  b.is_archived
                    ? "Restore this business?"
                    : "Archive this business?",
                ) &&
                void runDetailAction(async () => {
                  const endpoint = b.is_archived ? "restore" : "archive";
                  const res = await apiFetch(
                    `${apiBase}/operations/businesses/${encodeURIComponent(b.id)}/${endpoint}`,
                    { method: "POST" },
                  );
                  if (!res.ok)
                    throw new Error("Failed to update archive state");
                  await loadDetail();
                  await loadSummary();
                })
              }
            >
              {b.is_archived ? "Restore" : "Archive"}
            </button>
          </div>
        </section>
        <label className="ops-checkbox">
          <input
            type="checkbox"
            checked={clearFollowUpOnContact}
            onChange={(event) =>
              setClearFollowUpOnContact(event.target.checked)
            }
          />
          Clear next follow-up when marking contacted
        </label>
        {actionError && <div className="ops-error">{actionError}</div>}
        <section className="ops-two-column">
          <div className="ops-panel">
            <div className="ops-panel__header">
              <h2>Overview</h2>
              <select
                value={b.pipeline_stage}
                onChange={(event) =>
                  void runDetailAction(async () => {
                    await patchBusiness({ pipelineStage: event.target.value });
                  })
                }
              >
                {pipelineStageOptions.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </div>
            <dl className="ops-definition-grid">
              <dt>Website</dt>
              <dd>
                {b.website_url ? (
                  <a href={b.website_url}>{b.website_url}</a>
                ) : (
                  "-"
                )}
              </dd>
              <dt>Email</dt>
              <dd>
                {b.general_email ? (
                  <a href={`mailto:${b.general_email}`}>{b.general_email}</a>
                ) : (
                  "-"
                )}
              </dd>
              <dt>Phone</dt>
              <dd>{b.phone ?? "-"}</dd>
              <dt>Source</dt>
              <dd>{b.source ?? "-"}</dd>
              <dt>Business type</dt>
              <dd>{b.business_type ?? "-"}</dd>
              <dt>Location</dt>
              <dd>{b.location ?? "-"}</dd>
              <dt>Last contacted</dt>
              <dd>{formatDate(b.last_contacted_at)}</dd>
              <dt>Created</dt>
              <dd>{formatDateTime(b.created_at)}</dd>
              <dt>Updated</dt>
              <dd>{formatDateTime(b.updated_at)}</dd>
            </dl>
          </div>
          <div className="ops-panel">
            <h2>Contacts</h2>
            {detail.contacts.length === 0 ? (
              <div className="ops-empty-card">No contacts yet.</div>
            ) : (
              <div className="ops-list">
                {detail.contacts.map((contact) => (
                  <div key={contact.id} className="ops-list-card">
                    <strong>
                      {contactName(contact)}{" "}
                      {contact.is_primary ? "· Primary" : ""}
                    </strong>
                    <span>{contact.job_title ?? ""}</span>
                    <span>
                      {contact.email ? (
                        <a href={`mailto:${contact.email}`}>{contact.email}</a>
                      ) : (
                        ""
                      )}
                      {contact.email && contact.phone ? " · " : ""}
                      {contact.phone ?? ""}
                    </span>
                    {contact.notes && <small>{contact.notes}</small>}
                    <div className="ops-inline-actions">
                      <button
                        className="ops-button"
                        onClick={() => openEditContact(contact)}
                      >
                        Edit
                      </button>
                      {!contact.is_primary && (
                        <button
                          className="ops-button"
                          onClick={() =>
                            void runDetailAction(async () => {
                              const res = await apiFetch(
                                `${apiBase}/operations/businesses/${encodeURIComponent(b.id)}/contacts/${encodeURIComponent(
                                  contact.id,
                                )}/set-primary`,
                                { method: "POST" },
                              );
                              if (!res.ok)
                                throw new Error(
                                  "Failed to set primary contact",
                                );
                              await loadDetail();
                            })
                          }
                        >
                          Set primary
                        </button>
                      )}
                      <button
                        className="ops-button"
                        onClick={() =>
                          window.confirm("Remove this contact?") &&
                          void runDetailAction(async () => {
                            const res = await apiFetch(
                              `${apiBase}/operations/businesses/${encodeURIComponent(b.id)}/contacts/${encodeURIComponent(
                                contact.id,
                              )}`,
                              { method: "DELETE" },
                            );
                            if (!res.ok)
                              throw new Error("Failed to remove contact");
                            await loadDetail();
                          })
                        }
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
        <section className="ops-two-column">
          <div className="ops-panel">
            <div className="ops-panel__header">
              <h2>Websites</h2>
              {renderLink("/sites/new", "Add and monitor new site")}
            </div>
            <form className="ops-inline-form" onSubmit={linkSite}>
              <select
                value={selectedSiteId}
                onChange={(event) => setSelectedSiteId(event.target.value)}
              >
                <option value="">Link existing site</option>
                {availableSites
                  .filter(
                    (site) =>
                      !detail.linkedSites.some(
                        (linked) => linked.site_id === site.id,
                      ),
                  )
                  .map((site) => (
                    <option key={site.id} value={site.id}>
                      {site.site_display_name ?? site.url}
                    </option>
                  ))}
              </select>
              <button className="ops-button" disabled={!selectedSiteId}>
                Link site
              </button>
            </form>
            {detail.linkedSites.length === 0 ? (
              <div className="ops-empty-card">
                No monitored sites are linked yet.
              </div>
            ) : (
              <div className="ops-list">
                {detail.linkedSites.map((site) => (
                  <div key={site.site_id} className="ops-list-card">
                    <strong>{site.site_display_name ?? site.url}</strong>
                    <span>
                      {site.active_incident_id
                        ? "Currently down"
                        : "No active uptime incident"}{" "}
                      · Latest scan: {site.latest_scan_status ?? "none"}
                    </span>
                    <small>
                      {site.latest_scan_score == null
                        ? "No score"
                        : `Score ${site.latest_scan_score}`}{" "}
                      · {site.critical_issue_count} critical ·{" "}
                      {site.high_issue_count} high
                    </small>
                    <div className="ops-inline-actions">
                      {renderLink(
                        "/dashboard?selectSite=1",
                        "Monitoring",
                        "ops-button",
                      )}
                      {site.latest_scan_id &&
                        renderLink(
                          `/report?scanRunId=${site.latest_scan_id}`,
                          "Report",
                          "ops-button",
                        )}
                      <button
                        className="ops-button"
                        onClick={() =>
                          window.confirm(
                            "Unlink this site from the business? The site and scans will stay intact.",
                          ) &&
                          void runDetailAction(async () => {
                            const res = await apiFetch(
                              `${apiBase}/operations/businesses/${encodeURIComponent(b.id)}/sites/${encodeURIComponent(
                                site.site_id,
                              )}`,
                              { method: "DELETE" },
                            );
                            if (!res.ok)
                              throw new Error("Failed to unlink site");
                            await loadDetail();
                          })
                        }
                      >
                        Unlink
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="ops-panel">
            <h2>Related reports</h2>
            {detail.reports.length === 0 ? (
              <div className="ops-empty-card">
                No completed reports for linked sites yet.
              </div>
            ) : (
              <div className="ops-list">
                {detail.reports.map((report) => (
                  <div key={report.scan_run_id} className="ops-list-card">
                    <strong>
                      {report.site_display_name ?? report.site_url}
                    </strong>
                    <span>{formatDateTime(report.finished_at)}</span>
                    <small>
                      {report.share_enabled
                        ? "Share link exists"
                        : "No active share link"}
                    </small>
                    <div className="ops-inline-actions">
                      {renderLink(
                        `/report?scanRunId=${report.scan_run_id}`,
                        "View",
                        "ops-button",
                      )}
                      {renderLink(
                        `/report?scanRunId=${report.scan_run_id}&print=1`,
                        "Print/PDF",
                        "ops-button",
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
        <section className="ops-panel">
          <h2>Internal notes</h2>
          <form className="ops-note-form" onSubmit={submitNote}>
            <textarea
              value={noteBody}
              onChange={(event) => setNoteBody(event.target.value)}
              placeholder="Add an internal note"
            />
            <button
              className="ops-button ops-button--primary"
              disabled={!noteBody.trim()}
            >
              Add note
            </button>
          </form>
          {detail.notes.length === 0 ? (
            <div className="ops-empty-card">No notes yet.</div>
          ) : (
            <div className="ops-timeline">
              {detail.notes.map((note) => (
                <div key={note.id} className="ops-note">
                  <small>
                    {formatDateTime(note.created_at)} ·{" "}
                    {note.created_by_email ?? "Internal operator"}
                  </small>
                  <p>{note.body}</p>
                </div>
              ))}
            </div>
          )}
        </section>
        {editBusinessOpen && (
          <div className="ops-modal">
            <div className="ops-modal__panel">
              <div className="ops-panel__header">
                <h2>Edit business</h2>
                <button
                  className="ops-button"
                  onClick={() => setEditBusinessOpen(false)}
                >
                  Close
                </button>
              </div>
              {renderBusinessForm("edit")}
            </div>
          </div>
        )}
        {contactFormOpen && (
          <div className="ops-modal">
            <div className="ops-modal__panel">
              <div className="ops-panel__header">
                <h2>{editingContactId ? "Edit contact" : "Add contact"}</h2>
                <button
                  className="ops-button"
                  onClick={() => {
                    setContactFormOpen(false);
                    setEditingContactId(null);
                  }}
                >
                  Close
                </button>
              </div>
              <form className="ops-form" onSubmit={submitContact}>
                <div className="ops-form-grid">
                  {(
                    [
                      "firstName",
                      "lastName",
                      "email",
                      "phone",
                      "jobTitle",
                    ] as const
                  ).map((field) => (
                    <label key={field}>
                      {field === "firstName"
                        ? "First name"
                        : field === "lastName"
                          ? "Last name"
                          : field === "jobTitle"
                            ? "Job title"
                            : field[0].toUpperCase() + field.slice(1)}
                      <input
                        value={contactForm[field]}
                        type={field === "email" ? "email" : "text"}
                        onChange={(event) =>
                          setContactForm((prev) => ({
                            ...prev,
                            [field]: event.target.value,
                          }))
                        }
                      />
                    </label>
                  ))}
                </div>
                <label className="ops-checkbox">
                  <input
                    type="checkbox"
                    checked={contactForm.isPrimary}
                    onChange={(event) =>
                      setContactForm((prev) => ({
                        ...prev,
                        isPrimary: event.target.checked,
                      }))
                    }
                  />
                  Primary contact
                </label>
                <label>
                  Notes
                  <textarea
                    value={contactForm.notes}
                    onChange={(event) =>
                      setContactForm((prev) => ({
                        ...prev,
                        notes: event.target.value,
                      }))
                    }
                  />
                </label>
                <div className="ops-form-actions">
                  <button className="ops-button ops-button--primary">
                    {editingContactId ? "Save contact" : "Add contact"}
                  </button>
                  <button
                    type="button"
                    className="ops-button"
                    onClick={() => {
                      setContactFormOpen(false);
                      setEditingContactId(null);
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </>
    );
  }

  function renderPipeline() {
    return (
      <>
        <section className="ops-hero">
          <div>
            <div className="ops-eyebrow">Commercial flow</div>
            <h1>Pipeline</h1>
            <p>
              Businesses grouped by consultancy stage. Drag-and-drop is
              intentionally not included yet.
            </p>
          </div>
          <button
            className="ops-button ops-button--primary"
            onClick={() => setAddBusinessOpen(true)}
          >
            Add business
          </button>
        </section>
        <section className="ops-pipeline">
          {pipelineLoading && (
            <div className="ops-panel">Loading pipeline...</div>
          )}
          {pipelineStages.map((stage) => (
            <div className="ops-stage-column" key={stage.stage}>
              <div className="ops-stage-column__title">
                <strong>{stageLabel(stage.stage)}</strong>
                <span>{stage.businesses.length}</span>
              </div>
              {stage.businesses.length === 0 ? (
                <div className="ops-empty-card">No businesses</div>
              ) : (
                stage.businesses.map((business) => (
                  <div key={business.id} className="ops-pipeline-card">
                    <button
                      onClick={() =>
                        onNavigate(`/operations/businesses/${business.id}`)
                      }
                    >
                      <strong>{business.name}</strong>
                      <span>{contactName(business)}</span>
                      <small>{business.next_action ?? "No next action"}</small>
                      <small>
                        Follow-up: {formatDate(business.next_follow_up_at)}
                      </small>
                    </button>
                    <select
                      value={business.pipeline_stage}
                      onChange={(event) =>
                        void runDetailAction(async () => {
                          const res = await apiFetch(
                            `${apiBase}/operations/businesses/${encodeURIComponent(business.id)}`,
                            {
                              method: "PATCH",
                              headers: { "content-type": "application/json" },
                              body: JSON.stringify({
                                pipelineStage: event.target.value,
                              }),
                            },
                          );
                          if (!res.ok)
                            throw new Error("Failed to change stage");
                          await loadPipeline();
                          await loadSummary();
                        })
                      }
                    >
                      {pipelineStageOptions.map((item) => (
                        <option key={item.value} value={item.value}>
                          {item.label}
                        </option>
                      ))}
                    </select>
                  </div>
                ))
              )}
            </div>
          ))}
        </section>
        {addBusinessOpen && (
          <div className="ops-modal">
            <div className="ops-modal__panel">
              <div className="ops-panel__header">
                <h2>Add business</h2>
                <button
                  className="ops-button"
                  onClick={() => setAddBusinessOpen(false)}
                >
                  Close
                </button>
              </div>
              {renderBusinessForm("create")}
            </div>
          </div>
        )}
      </>
    );
  }

  function renderPlaceholder(
    route: Exclude<OperationsRouteKey, "home" | "businesses" | "pipeline">,
  ) {
    const content = placeholderContent[route];
    return (
      <section className="ops-placeholder">
        <div>
          <div className="ops-eyebrow">{content.eyebrow}</div>
          <h1>{content.title}</h1>
          <p>{content.body}</p>
        </div>
        <div className="ops-empty-panel">
          <h2>No records yet</h2>
          <p>
            This page is ready for the future Operations workflow. It is empty
            because Scanlark does not have records for this area yet.
          </p>
          {renderLink(
            route === "reports"
              ? "/dashboard/reports"
              : "/operations/businesses",
            content.action,
            "ops-button ops-button--primary",
          )}
        </div>
        <div className="ops-stage-grid">
          {content.bullets.map((item) => (
            <div key={item} className="ops-stage-card">
              {item}
            </div>
          ))}
        </div>
      </section>
    );
  }

  return (
    <div className="ops-page">
      <style>{operationsStyles}</style>
      <header className="ops-topbar">
        <div>
          <strong>Scanlark</strong>
          <span>Founder operations workspace</span>
        </div>
        <nav className="ops-global-nav" aria-label="Internal workspaces">
          {renderLink("/operations", "Operations")}
          {renderLink("/dashboard?selectSite=1", "Monitoring")}
          {renderLink("/admin", "System Admin")}
        </nav>
        <div className="ops-account">
          <span>{authEmail}</span>
          <button type="button" onClick={onLogout}>
            Log out
          </button>
        </div>
      </header>
      <div className="ops-shell">
        <aside className="ops-sidebar">
          <div className="ops-sidebar__title">Operations</div>
          <nav aria-label="Operations sections">
            {routeItems.map((item) =>
              renderLink(
                item.href,
                item.label,
                activeRoute === item.key
                  ? "ops-side-link active"
                  : "ops-side-link",
              ),
            )}
          </nav>
        </aside>
        <main className="ops-main">
          {activeRoute === "home"
            ? renderHome()
            : activeRoute === "businesses"
              ? businessId
                ? renderBusinessDetail()
                : renderBusinessesList()
              : activeRoute === "pipeline"
                ? renderPipeline()
                : renderPlaceholder(activeRoute)}
        </main>
      </div>
    </div>
  );
};

const operationsStyles = `
  .ops-page {
    min-height: 100vh;
    background: var(--bg);
    color: var(--text);
    padding: 16px;
  }
  .ops-topbar {
    position: sticky;
    top: 0;
    z-index: 20;
    display: grid;
    grid-template-columns: minmax(180px, 0.8fr) minmax(260px, 1.2fr) auto;
    gap: 16px;
    align-items: center;
    max-width: 1440px;
    margin: 0 auto 16px;
    padding: 12px 16px;
    border: 1px solid var(--border);
    border-radius: 12px;
    background: color-mix(in srgb, var(--panel) 94%, transparent);
    box-shadow: var(--shadow);
  }
  .ops-topbar strong {
    display: block;
    font-family: var(--font-display);
    font-size: 18px;
  }
  .ops-topbar span,
  .ops-muted,
  .ops-meta-row,
  .ops-list-card span,
  .ops-list-card small,
  .ops-pipeline-card span,
  .ops-pipeline-card small {
    color: var(--text-muted);
    font-size: 12px;
  }
  .ops-global-nav,
  .ops-account,
  .ops-action-grid,
  .ops-form-actions,
  .ops-inline-actions,
  .ops-meta-row,
  .ops-segmented,
  .ops-inline-form {
    display: flex;
    gap: 8px;
    align-items: center;
    flex-wrap: wrap;
  }
  .ops-account {
    justify-content: flex-end;
  }
  .ops-account button,
  .ops-link,
  .ops-button,
  .ops-segmented button {
    border: 1px solid var(--border);
    background: color-mix(in srgb, var(--panel-elev) 88%, transparent);
    color: var(--text);
    border-radius: 8px;
    min-height: 36px;
    padding: 8px 11px;
    font-size: 12px;
    font-weight: 700;
    text-decoration: none;
    cursor: pointer;
  }
  .ops-button--primary,
  .ops-segmented button.active {
    background: var(--accent);
    border-color: var(--accent);
    color: var(--accent-contrast);
  }
  .ops-button:disabled {
    cursor: not-allowed;
    opacity: 0.7;
  }
  .ops-shell {
    max-width: 1440px;
    margin: 0 auto;
    display: grid;
    grid-template-columns: 220px minmax(0, 1fr);
    gap: 16px;
    align-items: start;
  }
  .ops-sidebar,
  .ops-panel,
  .ops-hero,
  .ops-placeholder,
  .ops-empty-panel,
  .ops-modal__panel {
    border: 1px solid var(--border);
    border-radius: 12px;
    background: var(--panel);
    box-shadow: var(--shadow);
  }
  .ops-sidebar {
    position: sticky;
    top: 86px;
    display: grid;
    gap: 10px;
    padding: 12px;
  }
  .ops-sidebar__title,
  .ops-section-label {
    color: var(--text-muted);
    font-size: 11px;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.06em;
  }
  .ops-sidebar nav {
    display: grid;
    gap: 6px;
  }
  .ops-side-link {
    display: block;
    border: 1px solid transparent;
    border-radius: 8px;
    padding: 9px 10px;
    color: var(--text-muted);
    text-decoration: none;
    font-size: 13px;
    font-weight: 700;
  }
  .ops-side-link.active {
    border-color: var(--accent);
    background: color-mix(in srgb, var(--accent) 12%, transparent);
    color: var(--text);
  }
  .ops-main,
  .ops-panel,
  .ops-placeholder,
  .ops-empty-panel,
  .ops-form,
  .ops-list,
  .ops-timeline,
  .ops-work-grid,
  .ops-stage-grid {
    display: grid;
    gap: 14px;
    min-width: 0;
  }
  .ops-hero {
    display: flex;
    justify-content: space-between;
    gap: 16px;
    align-items: flex-start;
    padding: 22px;
  }
  .ops-hero h1,
  .ops-placeholder h1,
  .ops-panel h2,
  .ops-empty-panel h2 {
    margin: 0;
    font-family: var(--font-display);
  }
  .ops-hero h1 {
    font-size: clamp(30px, 4vw, 44px);
    line-height: 1.05;
  }
  .ops-hero p,
  .ops-placeholder p,
  .ops-empty-panel p,
  .ops-empty-card p,
  .ops-note p {
    color: var(--text-muted);
    line-height: 1.6;
    margin: 8px 0 0;
  }
  .ops-badge,
  .ops-eyebrow {
    display: inline-flex;
    width: max-content;
    margin-bottom: 8px;
    color: var(--warning);
    font-size: 11px;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }
  .ops-card-grid,
  .ops-two-column,
  .ops-form-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 12px;
  }
  .ops-card-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
  .ops-summary-card,
  .ops-empty-card,
  .ops-stage-card,
  .ops-list-item,
  .ops-activity,
  .ops-list-card,
  .ops-pipeline-card,
  .ops-note {
    border: 1px solid var(--border);
    border-radius: 10px;
    background: color-mix(in srgb, var(--panel-elev) 76%, transparent);
    color: var(--text);
    padding: 13px;
  }
  .ops-summary-card,
  .ops-list-item,
  .ops-activity {
    display: grid;
    gap: 8px;
    width: 100%;
    text-align: left;
    cursor: pointer;
  }
  .ops-summary-card:hover,
  .ops-list-item:hover,
  .ops-activity:hover,
  .ops-table__row:hover {
    border-color: var(--accent);
  }
  .ops-summary-card span {
    color: var(--text-muted);
    font-size: 12px;
    font-weight: 800;
    text-transform: uppercase;
  }
  .ops-summary-card strong {
    font-family: var(--font-display);
    font-size: 34px;
    line-height: 1;
  }
  .ops-panel {
    padding: 18px;
  }
  .ops-panel__header {
    display: flex;
    justify-content: space-between;
    gap: 12px;
    align-items: flex-start;
  }
  .ops-list-card,
  .ops-pipeline-card,
  .ops-note {
    display: grid;
    gap: 7px;
  }
  .ops-list-item.critical {
    border-color: color-mix(in srgb, var(--danger) 48%, var(--border));
  }
  .ops-list-item.warning {
    border-color: color-mix(in srgb, var(--warning) 48%, var(--border));
  }
  .ops-placeholder {
    padding: 22px;
  }
  .ops-empty-panel {
    padding: 18px;
    background: color-mix(in srgb, var(--panel-elev) 70%, transparent);
  }
  .ops-stage-grid {
    grid-template-columns: repeat(auto-fit, minmax(170px, 1fr));
  }
  .ops-error {
    border: 1px solid color-mix(in srgb, var(--danger) 45%, var(--border));
    border-radius: 10px;
    background: color-mix(in srgb, var(--danger) 12%, transparent);
    color: var(--danger);
    padding: 12px;
    font-size: 13px;
  }
  .ops-filterbar {
    display: grid;
    grid-template-columns: minmax(220px, 1fr) 180px;
    gap: 10px;
  }
  .ops-form label,
  .ops-filterbar,
  .ops-note-form {
    display: grid;
    gap: 6px;
  }
  .ops-form input,
  .ops-form select,
  .ops-form textarea,
  .ops-filterbar input,
  .ops-filterbar select,
  .ops-inline-form select,
  .ops-panel select,
  .ops-note-form textarea {
    border: 1px solid var(--border);
    border-radius: 8px;
    background: var(--panel-elev);
    color: var(--text);
    min-height: 38px;
    padding: 8px 10px;
  }
  .ops-form textarea,
  .ops-note-form textarea {
    min-height: 92px;
    resize: vertical;
  }
  .ops-table {
    display: grid;
    gap: 8px;
    overflow-x: auto;
  }
  .ops-table__head,
  .ops-table__row {
    display: grid;
    grid-template-columns: 1.3fr 1fr 0.9fr 1fr 1fr 0.8fr;
    gap: 10px;
    min-width: 920px;
    align-items: start;
  }
  .ops-table__head {
    color: var(--text-muted);
    font-size: 11px;
    font-weight: 800;
    text-transform: uppercase;
  }
  .ops-table__row {
    border: 1px solid var(--border);
    border-radius: 10px;
    background: color-mix(in srgb, var(--panel-elev) 76%, transparent);
    color: var(--text);
    padding: 12px;
    text-align: left;
    cursor: pointer;
  }
  .ops-table__row span {
    display: grid;
    gap: 4px;
  }
  .ops-table__row small {
    color: var(--text-muted);
    overflow-wrap: anywhere;
  }
  .ops-overdue {
    color: var(--warning);
  }
  .ops-definition-grid {
    display: grid;
    grid-template-columns: 140px minmax(0, 1fr);
    gap: 10px;
    margin: 0;
  }
  .ops-definition-grid dt {
    color: var(--text-muted);
    font-weight: 700;
  }
  .ops-definition-grid dd {
    margin: 0;
    overflow-wrap: anywhere;
  }
  .ops-checkbox {
    display: flex;
    gap: 8px;
    align-items: center;
    color: var(--text-muted);
    font-size: 13px;
  }
  .ops-modal {
    position: fixed;
    inset: 0;
    z-index: 60;
    display: grid;
    place-items: center;
    padding: 18px;
    background: rgba(0, 0, 0, 0.58);
  }
  .ops-modal__panel {
    width: min(760px, 100%);
    max-height: min(760px, calc(100vh - 36px));
    overflow: auto;
    padding: 18px;
  }
  .ops-pipeline {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
    gap: 12px;
  }
  .ops-stage-column {
    display: grid;
    gap: 10px;
    align-content: start;
    border: 1px solid var(--border);
    border-radius: 12px;
    background: var(--panel);
    padding: 12px;
  }
  .ops-stage-column__title {
    display: flex;
    justify-content: space-between;
    gap: 8px;
    color: var(--text);
  }
  .ops-pipeline-card button {
    display: grid;
    gap: 5px;
    width: 100%;
    border: 0;
    background: transparent;
    color: var(--text);
    padding: 0;
    text-align: left;
    cursor: pointer;
  }
  .ops-note p {
    white-space: pre-wrap;
  }
  @media (max-width: 980px) {
    .ops-topbar,
    .ops-shell,
    .ops-two-column,
    .ops-filterbar {
      grid-template-columns: 1fr;
    }
    .ops-sidebar {
      position: static;
    }
    .ops-sidebar nav {
      grid-template-columns: repeat(auto-fit, minmax(130px, 1fr));
    }
    .ops-card-grid {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }
  @media (max-width: 640px) {
    .ops-page {
      padding: 10px;
    }
    .ops-card-grid,
    .ops-form-grid {
      grid-template-columns: 1fr;
    }
    .ops-hero,
    .ops-panel__header {
      display: grid;
    }
    .ops-account {
      justify-content: flex-start;
    }
  }
`;
