import React, { useCallback, useEffect, useMemo, useState } from "react";

type ApiFetch = (
  input: RequestInfo | URL,
  init?: RequestInit,
) => Promise<Response>;

type EmailStatus =
  | "draft"
  | "ready"
  | "queued"
  | "sending"
  | "sent"
  | "failed"
  | "delivery_uncertain"
  | "cancelled";

type Folder = "drafts" | "ready" | "sent" | "failed";

type EmailSummary = {
  id: string;
  source_communication_id: string | null;
  sent_communication_id: string | null;
  business_id: string;
  recipient_name: string | null;
  recipient_address: string;
  subject: string;
  status: EmailStatus;
  revision: number;
  updated_at: string;
  sent_at: string | null;
  business_name: string;
  contact_name: string | null;
  last_editor_label: string | null;
  sent_actor_label: string | null;
  safe_display_error: string | null;
};

type EmailDetail = EmailSummary & {
  report_id: string | null;
  quote_id: string | null;
  from_name: string;
  from_address: string;
  reply_to_address: string | null;
  preheader: string | null;
  editor_body: string;
  rendered_html: string | null;
  plain_text: string | null;
  source_snapshot_json: Record<string, unknown>;
  contact_email: string | null;
  created_actor_label: string | null;
  created_at: string;
};

type EmailAttachment = {
  id: string;
  source_type: "report_pdf" | "quote_pdf" | "manual";
  source_version: string | null;
  display_filename: string;
  verified_mime_type: string | null;
  size_bytes: string | number;
  sha256: string | null;
  source_generated_at: string | null;
};

type AttachmentOption = {
  sourceType: "report_pdf" | "quote_pdf";
  renderId: string;
  documentId: string;
  documentTitle: string;
  documentReference: string;
  sourceVersion: string;
  filename: string;
  sizeBytes: number;
  generatedAt: string;
};

type FinalPreview = {
  html: string;
  plainText: string;
  htmlSha256: string;
  plainTextSha256: string;
  attachmentSetSha256: string;
  estimatedMimeBytes: number;
  requiredAttachmentTypes: Array<"report_pdf" | "quote_pdf">;
};

type EditorForm = {
  recipientName: string;
  recipientAddress: string;
  subject: string;
  preheader: string;
  editorBody: string;
};

const folderItems: Array<{ key: Folder; label: string; icon: string }> = [
  { key: "drafts", label: "Drafts", icon: "D" },
  { key: "ready", label: "Ready to send", icon: "R" },
  { key: "sent", label: "Sent", icon: "S" },
  { key: "failed", label: "Failed", icon: "!" },
];

function detailToForm(message: EmailDetail): EditorForm {
  return {
    recipientName: message.recipient_name ?? "",
    recipientAddress: message.recipient_address,
    subject: message.subject,
    preheader: message.preheader ?? "",
    editorBody: message.editor_body,
  };
}

function formatDate(value: string | null | undefined) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function formatBytes(value: number | string) {
  const bytes = Number(value);
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KiB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MiB`;
}

function requiredAttachmentTypes(message: EmailDetail) {
  const requirements = Array.isArray(
    message.source_snapshot_json.attachmentRequirements,
  )
    ? message.source_snapshot_json.attachmentRequirements
    : [];
  const required = new Set<"report_pdf" | "quote_pdf">();
  for (const item of requirements) {
    if (
      !item ||
      typeof item !== "object" ||
      (item as { required?: unknown }).required !== true
    )
      continue;
    const key = (item as { key?: unknown }).key;
    if (key === "quote_pdf") required.add("quote_pdf");
    if (key === "client_report_pdf" || key === "updated_report_pdf")
      required.add("report_pdf");
  }
  return required;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function previewDocument(body: string) {
  const paragraphs = body
    .trim()
    .split(/\n{2,}/)
    .map(
      (paragraph) => `<p>${escapeHtml(paragraph).replace(/\n/g, "<br>")}</p>`,
    )
    .join("");
  return `<!doctype html><html><head><meta charset="utf-8"><style>body{font:15px/1.6 system-ui,sans-serif;color:#17212b;padding:28px;max-width:680px;margin:auto}p{margin:0 0 1em}</style></head><body>${paragraphs}</body></html>`;
}

async function responseMessage(response: Response, fallback: string) {
  const data = (await response.json().catch(() => null)) as {
    message?: string;
  } | null;
  return data?.message ?? fallback;
}

export function OperationsEmailWorkspace({
  apiBase,
  apiFetch,
  currentSearch,
  onNavigate,
}: {
  apiBase: string;
  apiFetch: ApiFetch;
  currentSearch: string;
  onNavigate: (href: string) => void;
}) {
  const initialParams = useMemo(
    () => new URLSearchParams(currentSearch),
    [currentSearch],
  );
  const requestedFolder = initialParams.get("folder");
  const [folder, setFolder] = useState<Folder>(
    requestedFolder === "ready" ||
      requestedFolder === "sent" ||
      requestedFolder === "failed"
      ? requestedFolder
      : "drafts",
  );
  const [search, setSearch] = useState("");
  const [accessState, setAccessState] = useState<
    "checking" | "available" | "unavailable" | "forbidden" | "error"
  >("checking");
  const [messages, setMessages] = useState<EmailSummary[]>([]);
  const [counts, setCounts] = useState<Record<Folder, number>>({
    drafts: 0,
    ready: 0,
    sent: 0,
    failed: 0,
  });
  const [selectedId, setSelectedId] = useState<string | null>(
    initialParams.get("message"),
  );
  const [detail, setDetail] = useState<EmailDetail | null>(null);
  const [form, setForm] = useState<EditorForm | null>(null);
  const [loadingList, setLoadingList] = useState(true);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [saveState, setSaveState] = useState<
    "saved" | "dirty" | "saving" | "error" | "conflict"
  >("saved");
  const [error, setError] = useState<string | null>(null);
  const [conflictLatest, setConflictLatest] = useState<EmailDetail | null>(
    null,
  );
  const [attachments, setAttachments] = useState<EmailAttachment[]>([]);
  const [attachmentOptions, setAttachmentOptions] = useState<
    AttachmentOption[]
  >([]);
  const [attachmentBusy, setAttachmentBusy] = useState(false);
  const [finalPreview, setFinalPreview] = useState<FinalPreview | null>(null);
  const [previewTab, setPreviewTab] = useState<"editor" | "final" | "plain">(
    "editor",
  );
  const editable = detail?.status === "draft" || detail?.status === "ready";

  useEffect(() => {
    const controller = new AbortController();
    void apiFetch(`${apiBase}/operations/email/config`, {
      cache: "no-store",
      signal: controller.signal,
    })
      .then((response) => {
        if (response.ok) setAccessState("available");
        else if (response.status === 404) setAccessState("unavailable");
        else if (response.status === 401 || response.status === 403) {
          setAccessState("forbidden");
        } else setAccessState("error");
      })
      .catch(() => {
        if (!controller.signal.aborted) setAccessState("error");
      });
    return () => controller.abort();
  }, [apiBase, apiFetch]);

  const loadList = useCallback(async () => {
    if (accessState !== "available") return;
    setLoadingList(true);
    setError(null);
    try {
      const query = new URLSearchParams({ folder, limit: "100" });
      if (search.trim()) query.set("search", search.trim());
      const response = await apiFetch(
        `${apiBase}/operations/email/messages?${query.toString()}`,
        { cache: "no-store" },
      );
      if (!response.ok)
        throw new Error(
          await responseMessage(response, "Failed to load Email messages"),
        );
      const data = (await response.json()) as {
        messages: EmailSummary[];
        counts: { draft: number; ready: number; sent: number; failed: number };
      };
      setMessages(data.messages);
      setCounts({
        drafts: data.counts.draft,
        ready: data.counts.ready,
        sent: data.counts.sent,
        failed: data.counts.failed,
      });
      if (!selectedId && data.messages[0]) setSelectedId(data.messages[0].id);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Failed to load Email messages",
      );
    } finally {
      setLoadingList(false);
    }
  }, [accessState, apiBase, apiFetch, folder, search, selectedId]);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadList(), 200);
    return () => window.clearTimeout(timer);
  }, [loadList]);

  const loadDetail = useCallback(
    async (id: string) => {
      setLoadingDetail(true);
      setError(null);
      try {
        const response = await apiFetch(
          `${apiBase}/operations/email/messages/${encodeURIComponent(id)}`,
          { cache: "no-store" },
        );
        if (!response.ok)
          throw new Error(
            await responseMessage(response, "Failed to load Email message"),
          );
        const data = (await response.json()) as {
          message: EmailDetail;
          attachments?: EmailAttachment[];
        };
        setDetail(data.message);
        setAttachments(data.attachments ?? []);
        setAttachmentOptions([]);
        setFinalPreview(null);
        setPreviewTab("editor");
        setForm(detailToForm(data.message));
        setSaveState("saved");
        setConflictLatest(null);
      } catch (caught) {
        setError(
          caught instanceof Error
            ? caught.message
            : "Failed to load Email message",
        );
      } finally {
        setLoadingDetail(false);
      }
    },
    [apiBase, apiFetch],
  );

  useEffect(() => {
    if (selectedId && accessState === "available") void loadDetail(selectedId);
    else {
      setDetail(null);
      setForm(null);
    }
  }, [accessState, loadDetail, selectedId]);

  const loadAttachmentOptions = useCallback(
    async (messageId: string) => {
      const response = await apiFetch(
        `${apiBase}/operations/email/messages/${encodeURIComponent(messageId)}/attachment-options`,
        { cache: "no-store" },
      );
      if (!response.ok) {
        throw new Error(
          await responseMessage(response, "Failed to load attachments"),
        );
      }
      const data = (await response.json()) as {
        options: AttachmentOption[];
        attachments: EmailAttachment[];
      };
      setAttachmentOptions(data.options);
      setAttachments(data.attachments);
    },
    [apiBase, apiFetch],
  );

  useEffect(() => {
    if (!detail) return;
    void loadAttachmentOptions(detail.id).catch((caught) =>
      setError(
        caught instanceof Error ? caught.message : "Failed to load attachments",
      ),
    );
  }, [detail?.id, loadAttachmentOptions]);

  useEffect(() => {
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (
        saveState !== "dirty" &&
        saveState !== "error" &&
        saveState !== "conflict"
      )
        return;
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", beforeUnload);
    return () => window.removeEventListener("beforeunload", beforeUnload);
  }, [saveState]);

  const save = useCallback(async () => {
    if (!detail || !form || !editable || saveState === "saving") return detail;
    setSaveState("saving");
    setError(null);
    const response = await apiFetch(
      `${apiBase}/operations/email/messages/${encodeURIComponent(detail.id)}`,
      {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ expectedRevision: detail.revision, ...form }),
      },
    );
    if (response.status === 409) {
      const data = (await response.json().catch(() => null)) as {
        message?: string;
        latest?: EmailDetail;
      } | null;
      setConflictLatest(data?.latest ?? null);
      setSaveState("conflict");
      setError(
        data?.message ??
          "This message changed elsewhere. Your edits are still here.",
      );
      return null;
    }
    if (!response.ok) {
      setSaveState("error");
      setError(await responseMessage(response, "Failed to save Email message"));
      return null;
    }
    const data = (await response.json()) as { message: EmailDetail };
    const next = { ...detail, ...data.message };
    setDetail(next);
    setSaveState("saved");
    setConflictLatest(null);
    void loadList();
    return next;
  }, [apiBase, apiFetch, detail, editable, form, loadList, saveState]);

  useEffect(() => {
    if (saveState !== "dirty" || !editable) return;
    const timer = window.setTimeout(() => void save(), 1000);
    return () => window.clearTimeout(timer);
  }, [editable, form, save, saveState]);

  function updateForm<K extends keyof EditorForm>(
    key: K,
    value: EditorForm[K],
  ) {
    setForm((current) => (current ? { ...current, [key]: value } : current));
    setSaveState("dirty");
    setError(null);
  }

  function confirmDiscard() {
    return (
      saveState === "saved" ||
      saveState === "saving" ||
      window.confirm("Discard unsaved Email edits?")
    );
  }

  function selectMessage(id: string) {
    if (id === selectedId || !confirmDiscard()) return;
    setSelectedId(id);
    onNavigate(
      `/operations/email?folder=${folder}&message=${encodeURIComponent(id)}`,
    );
  }

  function selectFolder(next: Folder) {
    if (next === folder || !confirmDiscard()) return;
    setFolder(next);
    setSelectedId(null);
    setDetail(null);
    onNavigate(`/operations/email?folder=${next}`);
  }

  async function transition(target: "ready" | "draft") {
    let current = detail;
    if (!current) return;
    if (saveState !== "saved") current = await save();
    if (!current) return;
    setError(null);
    const response = await apiFetch(
      `${apiBase}/operations/email/messages/${encodeURIComponent(current.id)}/${target === "draft" ? "return-to-draft" : "ready"}`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ expectedRevision: current.revision }),
      },
    );
    if (!response.ok) {
      setError(
        await responseMessage(response, `Failed to mark Email ${target}`),
      );
      return;
    }
    const data = (await response.json()) as { message: EmailDetail };
    setDetail((existing) =>
      existing ? { ...existing, ...data.message } : data.message,
    );
    setSaveState("saved");
    setFolder(target === "ready" ? "ready" : "drafts");
    onNavigate(
      `/operations/email?folder=${target === "ready" ? "ready" : "drafts"}&message=${current.id}`,
    );
    void loadList();
  }

  async function mutateAttachment(
    request: () => Promise<Response>,
    fallback: string,
  ) {
    if (!detail || attachmentBusy) return;
    setAttachmentBusy(true);
    setError(null);
    try {
      const response = await request();
      if (!response.ok)
        throw new Error(await responseMessage(response, fallback));
      const data = (await response.json()) as {
        messageRevision: number;
        messageStatus: EmailStatus;
      };
      setDetail((current) =>
        current
          ? {
              ...current,
              revision: data.messageRevision,
              status: data.messageStatus,
            }
          : current,
      );
      setFinalPreview(null);
      setPreviewTab("editor");
      await loadAttachmentOptions(detail.id);
      void loadList();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : fallback);
    } finally {
      setAttachmentBusy(false);
    }
  }

  function addGenerated(option: AttachmentOption) {
    if (!detail) return;
    void mutateAttachment(
      () =>
        apiFetch(
          `${apiBase}/operations/email/messages/${encodeURIComponent(detail.id)}/attachments/generated`,
          {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              expectedRevision: detail.revision,
              sourceType: option.sourceType,
              renderId: option.renderId,
            }),
          },
        ),
      "Failed to attach generated PDF",
    );
  }

  function uploadManual(file: File) {
    if (!detail) return;
    const body = new FormData();
    body.set("expectedRevision", String(detail.revision));
    body.set("file", file);
    void mutateAttachment(
      () =>
        apiFetch(
          `${apiBase}/operations/email/messages/${encodeURIComponent(detail.id)}/attachments/manual`,
          { method: "POST", body },
        ),
      "The attachment was rejected",
    );
  }

  function removeAttachment(attachmentId: string) {
    if (!detail) return;
    void mutateAttachment(
      () =>
        apiFetch(
          `${apiBase}/operations/email/messages/${encodeURIComponent(detail.id)}/attachments/${encodeURIComponent(attachmentId)}`,
          {
            method: "DELETE",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ expectedRevision: detail.revision }),
          },
        ),
      "Failed to remove attachment",
    );
  }

  async function generateQuotePdf() {
    if (!detail?.quote_id || attachmentBusy) return;
    setAttachmentBusy(true);
    setError(null);
    try {
      const response = await apiFetch(
        `${apiBase}/operations/email/messages/${encodeURIComponent(detail.id)}/quote-renders/${encodeURIComponent(detail.quote_id)}`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ expectedRevision: detail.revision }),
        },
      );
      if (!response.ok) {
        throw new Error(
          await responseMessage(response, "Failed to generate quote PDF"),
        );
      }
      await loadAttachmentOptions(detail.id);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Failed to generate quote PDF",
      );
    } finally {
      setAttachmentBusy(false);
    }
  }

  async function renderFinalPreview() {
    let current = detail;
    if (!current) return;
    if (saveState !== "saved") current = await save();
    if (!current) return;
    setError(null);
    const response = await apiFetch(
      `${apiBase}/operations/email/messages/${encodeURIComponent(current.id)}/final-preview`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ expectedRevision: current.revision }),
      },
    );
    const data = (await response.json().catch(() => null)) as
      | (FinalPreview & { message?: string; errors?: string[] })
      | null;
    if (!response.ok || !data?.html) {
      setFinalPreview(null);
      setError(
        data?.errors?.join(" ") ??
          data?.message ??
          "Final preview validation failed",
      );
      return;
    }
    setFinalPreview(data);
    setPreviewTab("final");
  }

  function reloadLatest() {
    if (conflictLatest) {
      setDetail((existing) =>
        existing ? { ...existing, ...conflictLatest } : conflictLatest,
      );
      setForm(detailToForm(conflictLatest));
      setConflictLatest(null);
      setSaveState("saved");
      setError(null);
    } else if (selectedId) {
      void loadDetail(selectedId);
    }
  }

  if (accessState === "checking") {
    return <div className="ops-empty-card">Checking Email access…</div>;
  }
  if (accessState === "unavailable") {
    return (
      <div className="ops-empty-card">
        Operations Email is not available in this environment.
      </div>
    );
  }
  if (accessState === "forbidden") {
    return (
      <div className="ops-empty-card">
        Your Operations role does not permit access to Email.
      </div>
    );
  }
  if (accessState === "error") {
    return (
      <div className="ops-empty-card">
        Operations Email access could not be verified.
      </div>
    );
  }

  return (
    <section className="ops-email-module">
      <style>{emailStyles}</style>
      <header className="ops-email-header">
        <div>
          <div className="ops-eyebrow">Internal messaging</div>
          <h1>Operations Email</h1>
          <p>Prepare and review outgoing messages in an isolated workspace.</p>
        </div>
        <div
          className={`ops-email-save-state ops-email-save-state--${saveState}`}
          aria-live="polite"
        >
          {saveState === "saving"
            ? "Saving…"
            : saveState === "dirty"
              ? "Unsaved changes"
              : saveState === "conflict"
                ? "Save conflict"
                : saveState === "error"
                  ? "Save failed"
                  : "Saved"}
        </div>
      </header>
      {error && (
        <div className="ops-error ops-email-error" role="alert">
          <span>{error}</span>
          {saveState === "conflict" && (
            <button className="ops-button" onClick={reloadLatest}>
              Reload latest
            </button>
          )}
        </div>
      )}
      <div className={`ops-email-shell ${selectedId ? "has-selection" : ""}`}>
        <nav className="ops-email-folders" aria-label="Email folders">
          {folderItems.map((item) => (
            <button
              key={item.key}
              className={folder === item.key ? "active" : ""}
              onClick={() => selectFolder(item.key)}
            >
              <span className="ops-email-folder-icon" aria-hidden="true">
                {item.icon}
              </span>
              <span>{item.label}</span>
              <strong>{counts[item.key]}</strong>
            </button>
          ))}
        </nav>
        <section
          className="ops-email-list-pane"
          aria-label={`${folder} messages`}
        >
          <div className="ops-email-list-toolbar">
            <label htmlFor="ops-email-search">Search {folder}</label>
            <input
              id="ops-email-search"
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Business, recipient, subject"
            />
          </div>
          {loadingList ? (
            <div className="ops-empty-card">Loading messages…</div>
          ) : messages.length === 0 ? (
            <div className="ops-empty-card">No messages in {folder}.</div>
          ) : (
            <div className="ops-email-message-list">
              {messages.map((message) => (
                <button
                  key={message.id}
                  className={selectedId === message.id ? "active" : ""}
                  onClick={() => selectMessage(message.id)}
                >
                  <span className="ops-email-list-top">
                    <strong>{message.business_name}</strong>
                    <time>{formatDate(message.updated_at)}</time>
                  </span>
                  <span className="ops-email-list-subject">
                    {message.subject}
                  </span>
                  <span className="ops-email-list-recipient">
                    {message.recipient_name || message.recipient_address}
                  </span>
                  <span className="ops-email-list-recipient">
                    {message.status === "sent"
                      ? message.sent_actor_label
                        ? `Sent by ${message.sent_actor_label}`
                        : "Sent"
                      : message.last_editor_label
                        ? `Edited by ${message.last_editor_label}`
                        : ""}
                  </span>
                  <span
                    className={`ops-email-status ops-email-status--${message.status}`}
                  >
                    {message.status.split("_").join(" ")}
                  </span>
                </button>
              ))}
            </div>
          )}
        </section>
        <section className="ops-email-editor-pane" aria-label="Email editor">
          {selectedId && (
            <button
              className="ops-button ops-email-mobile-back"
              onClick={() => {
                if (confirmDiscard()) setSelectedId(null);
              }}
            >
              Back to messages
            </button>
          )}
          {loadingDetail ? (
            <div className="ops-empty-card">Loading message…</div>
          ) : !detail || !form ? (
            <div className="ops-email-empty-editor">
              <div className="ops-email-empty-mark">✉</div>
              <h2>Select a message</h2>
              <p>
                Choose a draft, ready message, or delivery record to inspect it.
              </p>
            </div>
          ) : (
            <div className="ops-email-editor">
              <div className="ops-email-editor-title">
                <div>
                  <span>{detail.business_name}</span>
                  <h2>{form.subject || "No subject"}</h2>
                </div>
                <span
                  className={`ops-email-status ops-email-status--${detail.status}`}
                >
                  {detail.status.split("_").join(" ")}
                </span>
              </div>
              <div className="ops-email-meta">
                {detail.contact_name ||
                  detail.recipient_name ||
                  detail.recipient_address}
                {detail.contact_email ? ` · ${detail.contact_email}` : ""}
                {detail.sent_at ? ` · Sent ${formatDate(detail.sent_at)}` : ""}
              </div>
              {detail.status === "delivery_uncertain" && (
                <div className="ops-warning">
                  <strong>Delivery uncertain.</strong> This message may already
                  have been accepted. It must not be resent automatically and
                  requires manual investigation.
                </div>
              )}
              {detail.safe_display_error && (
                <div className="ops-warning">{detail.safe_display_error}</div>
              )}
              <div className="ops-email-fields">
                <label>
                  From
                  <input
                    value={`${detail.from_name} <${detail.from_address}>`}
                    readOnly
                  />
                </label>
                <label>
                  Reply-To
                  <input
                    value={detail.reply_to_address ?? detail.from_address}
                    readOnly
                  />
                </label>
                <label>
                  Recipient name
                  <input
                    value={form.recipientName}
                    onChange={(event) =>
                      updateForm("recipientName", event.target.value)
                    }
                    disabled={!editable}
                  />
                </label>
                <label>
                  Recipient email
                  <input
                    type="email"
                    value={form.recipientAddress}
                    onChange={(event) =>
                      updateForm("recipientAddress", event.target.value)
                    }
                    disabled={!editable}
                    required
                  />
                </label>
                <label className="wide">
                  Subject
                  <input
                    value={form.subject}
                    onChange={(event) =>
                      updateForm("subject", event.target.value)
                    }
                    disabled={!editable}
                    required
                  />
                </label>
                <label className="wide">
                  Preheader
                  <input
                    value={form.preheader}
                    onChange={(event) =>
                      updateForm("preheader", event.target.value)
                    }
                    disabled={!editable}
                  />
                </label>
                <label className="wide">
                  Message
                  <textarea
                    rows={14}
                    value={form.editorBody}
                    onChange={(event) =>
                      updateForm("editorBody", event.target.value)
                    }
                    disabled={!editable}
                    required
                  />
                </label>
              </div>
              <div className="ops-email-editor-actions">
                {editable && (
                  <button
                    className="ops-button"
                    onClick={() => void save()}
                    disabled={saveState === "saving"}
                  >
                    Save now
                  </button>
                )}
                {detail.status === "draft" && (
                  <button
                    className="ops-button ops-button--primary"
                    onClick={() => void transition("ready")}
                  >
                    Mark ready
                  </button>
                )}
                {detail.status === "ready" && (
                  <button
                    className="ops-button"
                    onClick={() => void transition("draft")}
                  >
                    Return to draft
                  </button>
                )}
                {detail.source_communication_id && (
                  <button
                    className="ops-button"
                    onClick={() =>
                      onNavigate(
                        `/operations/communications?communication=${detail.source_communication_id}`,
                      )
                    }
                  >
                    View source Communication
                  </button>
                )}
                {detail.sent_communication_id && (
                  <button
                    className="ops-button"
                    onClick={() =>
                      onNavigate(
                        `/operations/communications?communication=${detail.sent_communication_id}`,
                      )
                    }
                  >
                    View sent Communication event
                  </button>
                )}
              </div>
              <section
                className="ops-email-attachments"
                aria-label="Attachments"
              >
                <div className="ops-email-panel-heading">
                  <div>
                    <strong>Attachments</strong>
                    <small>
                      Only persisted, validated files are used in the final
                      message.
                    </small>
                  </div>
                  <span>
                    {formatBytes(
                      attachments.reduce(
                        (sum, item) => sum + Number(item.size_bytes),
                        0,
                      ),
                    )}{" "}
                    total
                  </span>
                </div>
                <div className="ops-email-requirements">
                  {requiredAttachmentTypes(detail).has("report_pdf") && (
                    <span
                      className={
                        attachments.some(
                          (item) => item.source_type === "report_pdf",
                        )
                          ? "satisfied"
                          : "missing"
                      }
                    >
                      {attachments.some(
                        (item) => item.source_type === "report_pdf",
                      )
                        ? "✓ Report PDF attached"
                        : "! Report PDF required"}
                    </span>
                  )}
                  {requiredAttachmentTypes(detail).has("quote_pdf") && (
                    <span
                      className={
                        attachments.some(
                          (item) => item.source_type === "quote_pdf",
                        )
                          ? "satisfied"
                          : "missing"
                      }
                    >
                      {attachments.some(
                        (item) => item.source_type === "quote_pdf",
                      )
                        ? "✓ Quote PDF attached"
                        : "! Quote PDF required"}
                    </span>
                  )}
                  {requiredAttachmentTypes(detail).size === 0 && (
                    <span>
                      No generated attachment is required by this template.
                    </span>
                  )}
                </div>
                {attachments.length > 0 && (
                  <div className="ops-email-attachment-list">
                    {attachments.map((attachment) => (
                      <div key={attachment.id}>
                        <div>
                          <strong>{attachment.display_filename}</strong>
                          <small>
                            {attachment.source_type.replace("_", " ")} ·{" "}
                            {attachment.source_version ?? "manual upload"} ·{" "}
                            {formatBytes(attachment.size_bytes)}
                          </small>
                        </div>
                        <a
                          className="ops-button"
                          href={`${apiBase}/operations/email/messages/${encodeURIComponent(detail.id)}/attachments/${encodeURIComponent(attachment.id)}/download`}
                        >
                          Download
                        </a>
                        {editable && (
                          <button
                            className="ops-button"
                            disabled={attachmentBusy}
                            onClick={() => removeAttachment(attachment.id)}
                          >
                            Remove
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
                {editable && (
                  <div className="ops-email-attachment-actions">
                    {attachmentOptions
                      .filter(
                        (option) =>
                          !attachments.some(
                            (item) =>
                              item.display_filename.toLowerCase() ===
                              option.filename.toLowerCase(),
                          ),
                      )
                      .map((option) => (
                        <button
                          key={option.renderId}
                          className="ops-button"
                          disabled={attachmentBusy}
                          onClick={() => addGenerated(option)}
                        >
                          Attach {option.documentTitle} ·{" "}
                          {option.documentReference} (
                          {formatBytes(option.sizeBytes)})
                        </button>
                      ))}
                    {detail.quote_id &&
                      !attachmentOptions.some(
                        (option) =>
                          option.sourceType === "quote_pdf" &&
                          option.documentId === detail.quote_id,
                      ) && (
                        <button
                          className="ops-button"
                          disabled={attachmentBusy}
                          onClick={() => void generateQuotePdf()}
                        >
                          Generate persisted quote PDF
                        </button>
                      )}
                    <label className="ops-button ops-email-upload">
                      Upload manual file
                      <input
                        type="file"
                        disabled={attachmentBusy}
                        accept=".pdf,.docx,.xlsx,.pptx,.png,.jpg,.jpeg,.txt,.csv"
                        onChange={(event) => {
                          const file = event.target.files?.[0];
                          if (file) uploadManual(file);
                          event.currentTarget.value = "";
                        }}
                      />
                    </label>
                  </div>
                )}
                <small>
                  PDF, DOCX, XLSX, PPTX, PNG, JPEG, TXT or CSV. 10 MiB per file;
                  20 MiB total.
                </small>
              </section>
              <div
                className="ops-email-preview-tabs"
                role="tablist"
                aria-label="Email previews"
              >
                <button
                  className={previewTab === "editor" ? "active" : ""}
                  onClick={() => setPreviewTab("editor")}
                >
                  Editor
                </button>
                <button
                  className={previewTab === "final" ? "active" : ""}
                  onClick={() =>
                    finalPreview
                      ? setPreviewTab("final")
                      : void renderFinalPreview()
                  }
                >
                  Final email preview
                </button>
                <button
                  className={previewTab === "plain" ? "active" : ""}
                  onClick={() =>
                    finalPreview
                      ? setPreviewTab("plain")
                      : void renderFinalPreview()
                  }
                >
                  Plain text
                </button>
              </div>
              <div className="ops-email-previews">
                {previewTab === "editor" && (
                  <section>
                    <div>
                      <strong>Editor preview</strong>
                      <small>
                        Working copy before the direct-send wrapper is rendered.
                      </small>
                    </div>
                    <iframe
                      sandbox=""
                      srcDoc={
                        form.editorBody === detail.editor_body &&
                        detail.rendered_html
                          ? detail.rendered_html
                          : previewDocument(form.editorBody)
                      }
                      title="Sanitized Email HTML editor preview"
                    />
                  </section>
                )}
                {previewTab === "final" && (
                  <section>
                    <div>
                      <strong>Final email preview</strong>
                      <small>
                        This server-rendered preview includes the Scanlark
                        signature used for direct sending.
                      </small>
                    </div>
                    {finalPreview ? (
                      <iframe
                        sandbox=""
                        srcDoc={finalPreview.html}
                        title="Final direct-send Email preview"
                      />
                    ) : (
                      <div className="ops-empty-card">
                        <button
                          className="ops-button"
                          onClick={() => void renderFinalPreview()}
                        >
                          Validate and render final preview
                        </button>
                      </div>
                    )}
                  </section>
                )}
                {previewTab === "plain" && (
                  <section>
                    <div>
                      <strong>Plain text</strong>
                      <small>
                        Generated server-side from the same saved revision.
                      </small>
                    </div>
                    <pre>
                      {finalPreview?.plainText ??
                        "Render the final preview to inspect plain text."}
                    </pre>
                  </section>
                )}
              </div>
              <footer className="ops-email-meta">
                Revision {detail.revision} · Last updated{" "}
                {formatDate(detail.updated_at)}
                {detail.last_editor_label
                  ? ` by ${detail.last_editor_label}`
                  : ""}
              </footer>
            </div>
          )}
        </section>
      </div>
    </section>
  );
}

const emailStyles = `
  .ops-email-module { display: grid; gap: 14px; min-width: 0; }
  .ops-email-header { display: flex; align-items: end; justify-content: space-between; gap: 24px; }
  .ops-email-header h1 { margin: 3px 0; }
  .ops-email-header p { margin: 0; color: var(--text-muted); }
  .ops-email-save-state { border: 1px solid var(--border); border-radius: 999px; padding: 7px 11px; font-size: 12px; color: var(--text-muted); background: var(--panel); }
  .ops-email-save-state--dirty, .ops-email-save-state--error, .ops-email-save-state--conflict { color: #9a5a08; border-color: #d8a34a; }
  .ops-email-error { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
  .ops-email-shell { display: grid; grid-template-columns: 150px minmax(240px, .72fr) minmax(440px, 1.6fr); min-height: 690px; border: 1px solid var(--border); border-radius: 14px; overflow: hidden; background: var(--panel); box-shadow: var(--shadow); }
  .ops-email-folders { padding: 14px 10px; background: color-mix(in srgb, var(--panel) 70%, var(--bg)); border-right: 1px solid var(--border); }
  .ops-email-folders button { width: 100%; display: grid; grid-template-columns: 26px 1fr auto; gap: 7px; align-items: center; border: 0; border-radius: 9px; padding: 9px; background: transparent; color: var(--text); text-align: left; cursor: pointer; }
  .ops-email-folders button.active { background: var(--accent-soft); color: var(--accent); }
  .ops-email-folders button strong { font-size: 11px; }
  .ops-email-folder-icon { display: grid; place-items: center; width: 24px; height: 24px; border: 1px solid currentColor; border-radius: 7px; font-size: 11px; font-weight: 800; }
  .ops-email-list-pane { border-right: 1px solid var(--border); min-width: 0; background: color-mix(in srgb, var(--panel) 95%, var(--bg)); }
  .ops-email-list-toolbar { padding: 14px; border-bottom: 1px solid var(--border); }
  .ops-email-list-toolbar label { display: block; margin-bottom: 6px; color: var(--text-muted); font-size: 12px; font-weight: 700; }
  .ops-email-list-toolbar input { width: 100%; box-sizing: border-box; }
  .ops-email-message-list { display: grid; max-height: 630px; overflow: auto; }
  .ops-email-message-list > button { display: grid; gap: 5px; padding: 14px; border: 0; border-bottom: 1px solid var(--border); background: transparent; color: var(--text); text-align: left; cursor: pointer; }
  .ops-email-message-list > button:hover, .ops-email-message-list > button.active { background: var(--accent-soft); }
  .ops-email-list-top { display: flex; justify-content: space-between; gap: 8px; }
  .ops-email-list-top time, .ops-email-list-recipient { color: var(--text-muted); font-size: 11px; }
  .ops-email-list-subject { overflow: hidden; white-space: nowrap; text-overflow: ellipsis; font-size: 13px; }
  .ops-email-status { display: inline-flex; width: fit-content; border-radius: 999px; padding: 3px 7px; background: var(--bg); color: var(--text-muted); font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: .05em; }
  .ops-email-status--ready { background: #fff1c7; color: #805400; }
  .ops-email-status--sent { background: #dff5e7; color: #21663c; }
  .ops-email-status--failed, .ops-email-status--delivery_uncertain { background: #fde5e1; color: #962f22; }
  .ops-email-editor-pane { min-width: 0; padding: 18px; overflow: auto; }
  .ops-email-empty-editor { min-height: 500px; display: grid; place-content: center; justify-items: center; color: var(--text-muted); text-align: center; }
  .ops-email-empty-mark { display: grid; place-items: center; width: 58px; height: 58px; border-radius: 18px; background: var(--accent-soft); color: var(--accent); font-size: 26px; }
  .ops-email-editor { display: grid; gap: 16px; }
  .ops-email-editor-title { display: flex; align-items: start; justify-content: space-between; gap: 16px; }
  .ops-email-editor-title span:first-child { color: var(--text-muted); font-size: 12px; }
  .ops-email-editor-title h2 { margin: 3px 0 0; font-size: 22px; }
  .ops-email-fields { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
  .ops-email-fields label { display: grid; gap: 6px; color: var(--text-muted); font-size: 12px; font-weight: 700; }
  .ops-email-fields label.wide { grid-column: 1 / -1; }
  .ops-email-fields input, .ops-email-fields textarea { width: 100%; box-sizing: border-box; color: var(--text); }
  .ops-email-fields input[readonly], .ops-email-fields input:disabled, .ops-email-fields textarea:disabled { opacity: .72; background: var(--bg); }
  .ops-email-editor-actions { display: flex; flex-wrap: wrap; gap: 8px; }
  .ops-email-attachments { display: grid; gap: 12px; padding: 14px; border: 1px solid var(--border); border-radius: 11px; background: color-mix(in srgb, var(--panel) 94%, var(--bg)); }
  .ops-email-panel-heading { display: flex; justify-content: space-between; gap: 12px; align-items: start; }
  .ops-email-panel-heading > div { display: grid; gap: 2px; }
  .ops-email-panel-heading small, .ops-email-attachments > small { color: var(--text-muted); }
  .ops-email-requirements, .ops-email-attachment-actions { display: flex; flex-wrap: wrap; gap: 8px; }
  .ops-email-requirements span { padding: 5px 8px; border-radius: 999px; background: var(--bg); color: var(--text-muted); font-size: 11px; }
  .ops-email-requirements span.satisfied { background: #dff5e7; color: #21663c; }
  .ops-email-requirements span.missing { background: #fff1c7; color: #805400; }
  .ops-email-attachment-list { display: grid; border-top: 1px solid var(--border); }
  .ops-email-attachment-list > div { display: grid; grid-template-columns: minmax(0, 1fr) auto auto; align-items: center; gap: 8px; padding: 10px 0; border-bottom: 1px solid var(--border); }
  .ops-email-attachment-list > div > div { display: grid; min-width: 0; }
  .ops-email-attachment-list strong, .ops-email-attachment-list small { overflow-wrap: anywhere; }
  .ops-email-attachment-list small { color: var(--text-muted); }
  .ops-email-upload { position: relative; overflow: hidden; cursor: pointer; }
  .ops-email-upload input { position: absolute; inset: 0; opacity: 0; cursor: pointer; }
  .ops-email-preview-tabs { display: flex; gap: 4px; border-bottom: 1px solid var(--border); }
  .ops-email-preview-tabs button { border: 0; border-bottom: 2px solid transparent; padding: 9px 11px; background: transparent; color: var(--text-muted); cursor: pointer; }
  .ops-email-preview-tabs button.active { border-bottom-color: var(--accent); color: var(--accent); font-weight: 700; }
  .ops-email-previews { display: grid; grid-template-columns: 1fr; gap: 12px; }
  .ops-email-previews section { min-width: 0; border: 1px solid var(--border); border-radius: 11px; overflow: hidden; background: var(--bg); }
  .ops-email-previews section > div { display: grid; gap: 2px; padding: 10px 12px; border-bottom: 1px solid var(--border); }
  .ops-email-previews small { color: var(--text-muted); }
  .ops-email-previews iframe, .ops-email-previews pre { width: 100%; height: 260px; box-sizing: border-box; border: 0; margin: 0; background: white; color: #17212b; }
  .ops-email-previews pre { padding: 18px; overflow: auto; white-space: pre-wrap; font: 13px/1.55 ui-monospace, monospace; }
  .ops-email-meta { color: var(--text-muted); font-size: 11px; }
  .ops-email-mobile-back { display: none; margin-bottom: 10px; }
  @media (max-width: 980px) {
    .ops-email-shell { grid-template-columns: 110px minmax(230px, .75fr) 1.4fr; }
    .ops-email-folders button { grid-template-columns: 24px 1fr; }
    .ops-email-folders button strong { display: none; }
    .ops-email-previews { grid-template-columns: 1fr; }
  }
  @media (max-width: 760px) {
    .ops-email-header { align-items: start; flex-direction: column; gap: 8px; }
    .ops-email-shell { display: grid; grid-template-columns: 82px 1fr; min-height: 600px; }
    .ops-email-folders button { display: flex; flex-direction: column; font-size: 10px; }
    .ops-email-editor-pane { display: none; }
    .ops-email-shell.has-selection .ops-email-folders, .ops-email-shell.has-selection .ops-email-list-pane { display: none; }
    .ops-email-shell.has-selection { display: block; }
    .ops-email-shell.has-selection .ops-email-editor-pane { display: block; }
    .ops-email-mobile-back { display: inline-flex; }
    .ops-email-fields { grid-template-columns: 1fr; }
    .ops-email-fields label.wide { grid-column: auto; }
    .ops-email-attachment-list > div { grid-template-columns: 1fr auto; }
    .ops-email-attachment-list > div > div { grid-column: 1 / -1; }
    .ops-email-preview-tabs { overflow-x: auto; }
  }
`;
