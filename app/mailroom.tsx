"use client";
import { useMailroomWebMcp } from "@/hooks/use-mailroom-webmcp";
import { validateReview } from "@/lib/mailroom-webmcp";
import ThemePicker from "./theme-picker";
import { useEffect, useRef, useState } from "react";
import { createDemoApi } from "@/lib/demo";
import {
  Mail,
  Globe2,
  Send,
  FileText,
  ShieldCheck,
  Search,
  RefreshCw,
  ChevronDown,
  Plus,
  LockKeyhole,
  LogOut,
  X,
  Check,
  ArrowUpRight,
  AlertCircle,
  PanelLeft,
  Eye,
  EyeOff,
  Trash2,
  CheckCircle2,
  Loader2,
  Info,
} from "lucide-react";
import {
  blankMessage,
  validateMessage,
  recipients,
  maskDomain,
  type Message,
} from "@/lib/mail-core";
type Domain = {
  name: string;
  zoneId: string;
  enabled: boolean;
  kind: string;
  status: string;
  testOnly?: boolean;
  hidden?: boolean;
};
type Sent = {
  id: string;
  data: Message;
  status: string;
  result: any;
  created: number;
};
const cfLink =
  "https://dash.cloudflare.com/?to=/:account/email-service/sending";
const shortDate = (n: number) =>
  new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(n);
function Mark() {
  return (
    <div className="brand-mark">
      <Mail size={23} />
    </div>
  );
}
export default function Mailroom({ demo = false }: { demo?: boolean }) {
  const [demoApi] = useState(() => (demo ? createDemoApi() : null));
  const [checking, setChecking] = useState(true),
    [unlocked, setUnlocked] = useState(false),
    [password, setPassword] = useState(""),
    [showPassword, setShowPassword] = useState(false),
    [loginBusy, setLoginBusy] = useState(false),
    [loginError, setLoginError] = useState("");
  const [domains, setDomains] = useState<Domain[]>([]),
    [history, setHistory] = useState<Sent[]>([]),
    [draft, setDraft] = useState<Message>({ ...blankMessage }),
    [ready, setReady] = useState(false),
    [loading, setLoading] = useState(false),
    [query, setQuery] = useState(""),
    [view, setView] = useState<"compose" | "sent" | "domains">("compose"),
    [selected, setSelected] = useState<Sent | null>(null),
    [error, setError] = useState(""),
    [toast, setToast] = useState(""),
    [saveState, setSaveState] = useState(""),
    [advanced, setAdvanced] = useState(false),
    [mobileNav, setMobileNav] = useState(false),
    [sending, setSending] = useState(false),
    [testRecipient, setTestRecipient] = useState(""),
    [review, setReview] = useState<Message | null>(null),
    [info, setInfo] = useState(false),
    [discard, setDiscard] = useState(false);
  const [domainMenu, setDomainMenu] = useState<{
      name: string;
      x: number;
      y: number;
    } | null>(null),
    [visibilityBusy, setVisibilityBusy] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  function displayDomain(name: string) {
    return domains.find((d) => d.name === name)?.hidden
      ? maskDomain(name)
      : name;
  }
  function displayText(text: string) {
    return domains
      .filter((d) => d.hidden)
      .sort((a, b) => b.name.length - a.name.length)
      .reduce((value, d) => value.split(d.name).join(maskDomain(d.name)), text);
  }
  function openDomainMenu(e: React.MouseEvent, name: string) {
    e.preventDefault();
    const bounds = e.currentTarget.getBoundingClientRect();
    setDomainMenu({
      name,
      x: Math.min(e.clientX || bounds.left, window.innerWidth - 210),
      y: Math.min(e.clientY || bounds.bottom, window.innerHeight - 100),
    });
  }
  async function toggleDomain() {
    if (!domainMenu || visibilityBusy) return;
    const name = domainMenu.name;
    const hidden = !domains.find((d) => d.name === name)?.hidden;
    setVisibilityBusy(true);
    try {
      await api("domain-visibility", { domain: name, hidden });
      setDomains((rows) =>
        rows.map((d) => (d.name === name ? { ...d, hidden } : d)),
      );
      setDomainMenu(null);
      setToast(
        hidden
          ? "Domain hidden. Preference saved."
          : "Domain shown. Preference saved.",
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setVisibilityBusy(false);
    }
  }
  useEffect(() => {
    if (!domainMenu) return;
    menuRef.current?.querySelector<HTMLButtonElement>("button")?.focus();
    const close = (e: PointerEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setDomainMenu(null);
    };
    const escape = (e: KeyboardEvent) => {
      if (e.key === "Escape") setDomainMenu(null);
    };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", escape);
    };
  }, [domainMenu]);
  const dialog = useRef<HTMLDialogElement>(null),
    infoDialog = useRef<HTMLDialogElement>(null),
    discardDialog = useRef<HTMLDialogElement>(null),
    passRef = useRef<HTMLInputElement>(null),
    searchRef = useRef<HTMLInputElement>(null),
    sendKey = useRef<string | null>(null),
    draftSave = useRef(0),
    editorRef = useRef<HTMLTextAreaElement>(null);
  function clearPrivate() {
    setUnlocked(false);
    setReady(false);
    setDomains([]);
    setHistory([]);
    setSelected(null);
    setDraft({ ...blankMessage });
    setReview(null);
    setDomainMenu(null);
    dialog.current?.close();
  }
  async function api(path: string, body?: unknown) {
    if (demoApi) return demoApi(path, body);
    const response = await fetch("/api/" + path, {
      ...(body !== undefined
        ? {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          }
        : {}),
      cache: "no-store",
    });
    const data: any = await response.json();
    if (!response.ok) {
      if (response.status === 401 && path !== "login") clearPrivate();
      throw new Error(data.error || "Something went wrong. Please try again.");
    }
    return data;
  }
  async function refresh(loadDraft = false) {
    setLoading(true);
    setError("");
    try {
      const [d, h, dr] = await Promise.all([
        api("domains"),
        api("history"),
        loadDraft ? api("draft") : Promise.resolve(null),
      ]);
      setDomains(d.domains);
      setDraft((current) =>
        d.domains.some((x: Domain) => x.name === current.domain)
          ? current
          : { ...current, domain: d.domains[0]?.name || "" },
      );
      setTestRecipient(d.testRecipient);
      setHistory(h.messages);
      if (loadDraft) {
        setDraft({
          ...blankMessage,
          ...dr?.draft,
          domain: d.domains.some((x: Domain) => x.name === dr?.draft?.domain)
            ? dr.draft.domain
            : d.domains[0]?.name || "",
        });
        setReady(true);
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    api("session")
      .then((d) => {
        setUnlocked(d.unlocked);
        if (d.unlocked) refresh(true);
      })
      .catch((e) => setLoginError(e.message))
      .finally(() => setChecking(false));
  }, []);
  useEffect(() => {
    if (!ready || !unlocked) return;
    setSaveState("Saving draft…");
    const seq = ++draftSave.current;
    const t = setTimeout(() => {
      api("draft", { data: draft, updated: Date.now() })
        .then(() => {
          if (seq === draftSave.current) setSaveState("Draft saved");
        })
        .catch(() => {
          if (seq === draftSave.current) setSaveState("Draft not saved");
        });
    }, 700);
    return () => clearTimeout(t);
  }, [draft, ready, unlocked]);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 6500);
    return () => clearTimeout(t);
  }, [toast]);
  useEffect(() => {
    if (review) dialog.current?.showModal();
    else dialog.current?.close();
  }, [review]);
  useEffect(() => {
    if (info) infoDialog.current?.showModal();
    else infoDialog.current?.close();
  }, [info]);
  useEffect(() => {
    if (discard) discardDialog.current?.showModal();
    else discardDialog.current?.close();
  }, [discard]);
  useEffect(() => {
    const listener = (e: KeyboardEvent) => {
      if (unlocked && (e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        searchRef.current?.focus();
      }
      if (e.key === "Escape") setMobileNav(false);
    };
    window.addEventListener("keydown", listener);
    return () => window.removeEventListener("keydown", listener);
  }, [unlocked]);
  async function login(e: React.FormEvent) {
    e.preventDefault();
    setLoginBusy(true);
    setLoginError("");
    try {
      await api("login", { password });
      setPassword("");
      setUnlocked(true);
      await refresh(true);
    } catch (e) {
      setLoginError((e as Error).message);
      passRef.current?.focus();
    } finally {
      setLoginBusy(false);
    }
  }
  async function lock() {
    if (demo) {
      setToast("Demo mode has no account or password.");
      return;
    }
    try {
      await api("logout", {});
      clearPrivate();
    } catch (e) {
      setError((e as Error).message);
    }
  }
  function update(key: keyof Message, value: string | boolean) {
    setDraft((d) => ({ ...d, [key]: value }));
    sendKey.current = null;
    setError("");
  }
  function newMessage() {
    setView("compose");
    setMobileNav(false);
    setSelected(null);
    setTimeout(() => editorRef.current?.focus(), 100);
  }
  function openReview() {
    try {
      setReview({ ...validateReview(draft, domains, testRecipient) });
      setError("");
    } catch (e) {
      setError((e as Error).message);
    }
  }
  async function send() {
    if (!review || sending) return;
    setSending(true);
    sendKey.current ||= crypto.randomUUID();
    try {
      const r = await api("send", { id: sendKey.current, message: review });
      if (["delivered", "queued"].includes(r.status)) {
        setToast(
          demo
            ? "Demo only. No email was sent."
            : r.status === "delivered"
              ? "Email delivered to the recipient’s mail server."
              : "Email accepted and queued for delivery.",
        );
        setReview(null);
        setDraft((d) => ({
          ...blankMessage,
          prefix: d.prefix,
          domain: d.domain,
          name: d.name,
        }));
        sendKey.current = null;
        await refresh();
      } else {
        setReview(null);
        setError(
          r.message ||
            "Check Recent sends for delivery details before sending again.",
        );
        await refresh();
      }
    } catch (e) {
      setReview(null);
      setError((e as Error).message);
    } finally {
      setSending(false);
    }
  }
  useMailroomWebMcp(unlocked && ready, {
    state: () => ({
      unlocked,
      ready,
      busy: sending || !!review,
      domains,
      draft,
      testRecipient,
    }),
    async checkSession() {
      const session = await api("session");
      if (!session.unlocked) clearPrivate();
      return session.unlocked;
    },
    async saveDraft(message) {
      await api("draft", { data: message, updated: Date.now() });
      setReview(null);
      setDraft(message);
      sendKey.current = null;
      setError("");
      setQuery("");
      newMessage();
    },
    showReview(message) {
      setError("");
      setReview({ ...message });
      setView("compose");
      setQuery("");
      setMobileNav(false);
    },
  });
  const enabled = domains.filter((d) => d.enabled).length,
    active = domains.find((d) => d.name === draft.domain),
    filteredDomains = domains.filter((d) =>
      d.name.toLowerCase().includes(query.toLowerCase()),
    ),
    filteredHistory = history.filter((h) =>
      (h.data.subject + " " + h.data.to + " " + h.data.domain)
        .toLowerCase()
        .includes(query.toLowerCase()),
    );
  const canReview =
    !!draft.to.trim() &&
    !!draft.subject.trim() &&
    !!draft.body.trim() &&
    ready &&
    !sending;
  if (checking)
    return (
      <main className="boot">
        <Mark />
        <Loader2 className="spin" />
        <span>Opening your mailroom</span>
      </main>
    );
  if (!unlocked)
    return (
      <main className="login-page">
        <div className="login-brand">
          <Mark />
          <span>Mailroom</span>
          <span className="private-pill">
            <LockKeyhole size={12} /> Private workspace
          </span>
          <ThemePicker />
        </div>
        <div className="login-grid">
          <section className="login-story">
            <div className="eyebrow">YOUR DOMAINS. YOUR WORKSPACE.</div>
            <h1>
              A quieter place
              <br />
              to send your mail.
            </h1>
            <p>
              All your domains, one thoughtful workspace.
              <br />
              Made for the messages that matter.
            </p>
            <div className="login-illustration" aria-hidden="true">
              <div className="mini-top">
                <span />
                <span />
                <span />
                <i />
              </div>
              <div className="mini-body">
                <div className="mini-nav">
                  <b />
                  <i />
                  <i />
                  <i />
                </div>
                <div className="mini-list">
                  <span />
                  <span />
                  <span />
                </div>
                <div className="mini-compose">
                  <div className="mini-envelope">
                    <Mail size={32} />
                  </div>
                  <i />
                  <i />
                  <i />
                  <b />
                </div>
              </div>
              <span className="illustration-tag">
                <ShieldCheck size={16} /> Only you have access
              </span>
            </div>
          </section>
          <section className="login-card">
            <div className="lock-emblem">
              <LockKeyhole size={25} />
            </div>
            <h2>Welcome to your mailroom</h2>
            <p>Enter your password to unlock your workspace.</p>
            <form onSubmit={login}>
              <label htmlFor="password">Workspace password</label>
              <div className="password-input">
                <input
                  id="password"
                  ref={passRef}
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoFocus
                />
                <button
                  type="button"
                  title={showPassword ? "Hide password" : "Show password"}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              {loginError && (
                <div className="form-error" role="alert">
                  {loginError}
                </div>
              )}
              <button
                className="primary login-submit"
                disabled={loginBusy || !password}
              >
                {loginBusy ? (
                  <Loader2 size={17} className="spin" />
                ) : (
                  <LockKeyhole size={16} />
                )}{" "}
                {loginBusy ? "Unlocking…" : "Unlock workspace"}
              </button>
            </form>
            <div className="login-note">
              <ShieldCheck size={16} />
              <span>Owner-only access. No public sharing.</span>
            </div>
            <p className="vault-hint">
              Keep your workspace password
              <br />
              in your password manager.
            </p>
          </section>
        </div>
        <footer>
          Private Mailroom{" "}
          <span>Designed for focus. Built around your privacy.</span>
        </footer>
      </main>
    );
  return (
    <div className="app-shell">
      <header className="app-header">
        <button
          className="mobile-toggle icon-button"
          onClick={() => setMobileNav(!mobileNav)}
          aria-label="Toggle navigation"
        >
          <PanelLeft size={21} />
        </button>
        <div className="wordmark">
          <Mark />
          <span>Mailroom</span>
        </div>
        <div className="global-search">
          <Search size={18} />
          <input
            aria-label="Search domains or recent sends"
            ref={searchRef}
            placeholder={
              view === "sent" ? "Search recent sends" : "Search your domains"
            }
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {query ? (
            <button onClick={() => setQuery("")} aria-label="Clear search">
              <X size={15} />
            </button>
          ) : (
            <kbd>⌘ K</kbd>
          )}
        </div>
        <div className="header-end">
          <ThemePicker />
          <span className="private-label">
            <LockKeyhole size={13} />{" "}
            {demo ? "Demo · no mail sent" : "Only you"}
          </span>
          <button
            className="header-help"
            onClick={() => setInfo(true)}
            aria-label="About your workspace"
          >
            <Info size={19} />
          </button>
          <button
            className="avatar"
            title="Lock workspace"
            aria-label="Lock workspace"
            onClick={lock}
          >
            ME
          </button>
        </div>
      </header>
      <div className="workspace">
        <aside className="app-rail">
          <button
            className={view !== "domains" ? "rail-active" : ""}
            onClick={() => {
              setView("compose");
              setQuery("");
            }}
            title="Mail"
            aria-label="Mail"
          >
            <Mail size={22} />
          </button>
          <button
            className={view === "domains" ? "rail-active" : ""}
            onClick={() => {
              setView("domains");
              setQuery("");
            }}
            title="Domains"
            aria-label="Domains"
          >
            <Globe2 size={22} />
          </button>
          <div className="rail-bottom">
            <button
              onClick={() => setInfo(true)}
              title="Privacy and help"
              aria-label="Privacy and help"
            >
              <ShieldCheck size={21} />
            </button>
          </div>
        </aside>
        <aside className={"folders " + (mobileNav ? "open" : "")}>
          <button className="primary compose-button" onClick={newMessage}>
            <Plus size={20} /> New message
          </button>
          <div className="nav-section-label">WORKSPACE</div>
          <nav>
            <button
              className={view === "compose" ? "nav-active" : ""}
              onClick={() => {
                newMessage();
                setQuery("");
              }}
            >
              <FileText size={18} />
              <span>Draft</span>
              <span className="count">
                {draft.body || draft.subject ? 1 : 0}
              </span>
            </button>
            <button
              className={view === "sent" ? "nav-active" : ""}
              onClick={() => {
                setView("sent");
                setQuery("");
                setMobileNav(false);
              }}
            >
              <Send size={18} />
              <span>Recent sends</span>
              <span className="count">{history.length}</span>
            </button>
            <button
              className={view === "domains" ? "nav-active" : ""}
              onClick={() => {
                setView("domains");
                setQuery("");
                setMobileNav(false);
              }}
            >
              <Globe2 size={18} />
              <span>Domains</span>
              <span className="count">{domains.length}</span>
            </button>
          </nav>
          <div className="nav-divider" />
          <div className="nav-section-label">FAVOURITES</div>
          {domains[0] && (
            <button
              onContextMenu={(e) => openDomainMenu(e, domains[0].name)}
              className="favourite"
              onClick={() => {
                update("domain", domains[0].name);
                newMessage();
              }}
            >
              <span className="domain-dot" />
              {displayDomain(domains[0].name)}
            </button>
          )}
          <div className="folder-bottom">
            <div className="secure-note">
              <ShieldCheck size={19} />
              <div>
                <strong>Your private workspace</strong>
                <small>Protected by sign-in + password</small>
              </div>
            </div>
            <button className="lock-button" onClick={lock}>
              <LogOut size={16} /> Lock workspace
            </button>
          </div>
        </aside>
        <main className="mail-main">
          <div className="ribbon">
            <div className="ribbon-tabs">
              <span className="active">Home</span>
              <button onClick={() => setInfo(true)}>Help</button>
            </div>
            <div className="ribbon-actions">
              <button
                onClick={() => refresh()}
                disabled={loading}
                className="ribbon-button"
              >
                <RefreshCw size={16} className={loading ? "spin" : ""} /> Sync
              </button>
              <span className="ribbon-separator" />
              <button
                onClick={() => {
                  setView("domains");
                  setQuery("");
                }}
                className="ribbon-button"
              >
                <Globe2 size={16} /> Manage domains
              </button>
              {draft.domain && (
                <button
                  className="ribbon-button"
                  onClick={(e) => openDomainMenu(e, draft.domain)}
                  aria-label="Domain visibility"
                >
                  <EyeOff size={16} /> Domain privacy
                </button>
              )}
              <div className="ribbon-status">
                <span className="green-dot" />
                {demo ? "Fictional data" : "Private connection"}
              </div>
            </div>
          </div>
          {error && (
            <div className="error-banner" role="alert">
              <AlertCircle size={17} />
              <span>{error}</span>
              <button onClick={() => setError("")} aria-label="Dismiss error">
                <X size={16} />
              </button>
            </div>
          )}
          <div className="pane-layout">
            <section
              className={"item-pane " + (view === "sent" ? "history-pane" : "")}
            >
              <div className="pane-heading">
                <h2>{view === "sent" ? "Recent sends" : "Your domains"}</h2>
                <span>{view === "sent" ? history.length : domains.length}</span>
              </div>
              <div className="list-tabs">
                <span className="active">
                  {view === "sent" ? "All messages" : "Sending domains"}
                </span>
                <small>
                  {view === "sent"
                    ? "Last 100"
                    : `${enabled} general · ${domains.length - enabled} test`}
                </small>
              </div>
              {loading && !domains.length ? (
                <div className="list-loading">
                  <Loader2 className="spin" size={20} /> Loading workspace…
                </div>
              ) : view === "sent" ? (
                <div className="item-list">
                  {filteredHistory.length ? (
                    filteredHistory.map((h) => (
                      <button
                        className={
                          "message-row " +
                          (selected?.id === h.id ? "selected" : "")
                        }
                        key={h.id}
                        onClick={() => setSelected(h)}
                      >
                        <div className="message-row-top">
                          <strong>{displayText(h.data.to)}</strong>
                          <small>
                            {new Date(h.created).toLocaleDateString(undefined, {
                              month: "short",
                              day: "numeric",
                            })}
                          </small>
                        </div>
                        <b>{h.data.subject}</b>
                        <p>{displayText(h.data.body)}</p>
                        <span
                          className={
                            "status-text " +
                            (["delivered", "queued"].includes(h.status)
                              ? "success"
                              : "warning")
                          }
                        >
                          {h.status === "delivered"
                            ? "Delivered to mail server"
                            : h.status === "queued"
                              ? "Queued"
                              : h.status === "sending"
                                ? "Processing"
                                : h.status === "partial"
                                  ? "Check delivery details"
                                  : "Delivery unconfirmed"}
                        </span>
                      </button>
                    ))
                  ) : (
                    <div className="list-empty">
                      <Send size={27} />
                      <strong>
                        {query ? "No matching messages" : "A fresh start"}
                      </strong>
                      <p>
                        {query
                          ? "Try a different search."
                          : "Messages you send here will appear here."}
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="item-list">
                  {filteredDomains.map((d) => (
                    <button
                      key={d.name}
                      className={
                        "domain-row " +
                        (draft.domain === d.name ? "selected" : "")
                      }
                      onContextMenu={(e) => openDomainMenu(e, d.name)}
                      onKeyDown={(e) => {
                        if (
                          e.key === "ContextMenu" ||
                          (e.shiftKey && e.key === "F10")
                        ) {
                          e.preventDefault();
                          const b = e.currentTarget.getBoundingClientRect();
                          setDomainMenu({
                            name: d.name,
                            x: Math.min(b.right, window.innerWidth - 210),
                            y: Math.min(b.top, window.innerHeight - 100),
                          });
                        }
                      }}
                      title="Right-click to hide or show this domain"
                      onClick={() => update("domain", d.name)}
                    >
                      <div
                        className={
                          "domain-avatar " + (d.enabled ? "ready-avatar" : "")
                        }
                      >
                        {d.hidden ? "*" : d.name.slice(0, 1).toUpperCase()}
                      </div>
                      <div className="domain-row-content">
                        <strong>{displayDomain(d.name)}</strong>
                        <span>
                          {d.enabled
                            ? "Ready to send"
                            : "Verified recipient only"}
                        </span>
                      </div>
                      {d.enabled ? (
                        <CheckCircle2 size={15} className="success" />
                      ) : (
                        <span className="status-dot" />
                      )}
                    </button>
                  ))}
                  {!filteredDomains.length && !loading && (
                    <div className="list-empty">
                      <Search size={26} />
                      <strong>No sending domains</strong>
                      <p>
                        {query
                          ? "Try another domain name."
                          : "Onboard a domain in Cloudflare Email Sending, then sync."}
                      </p>
                    </div>
                  )}
                </div>
              )}
              <div className="list-footer">
                <ShieldCheck size={13} /> Visible only to you
              </div>
            </section>
            <section className="detail-pane">
              {view === "compose" ? (
                <>
                  <div className="detail-heading">
                    <div>
                      <div className="eyebrow">COMPOSE</div>
                      <h1>New message</h1>
                    </div>
                    <span
                      className={
                        "draft-state " +
                        (saveState === "Draft not saved" ? "warning" : "")
                      }
                    >
                      <Check size={14} />
                      {saveState || "Your draft"}
                    </span>
                  </div>
                  <div className="compose-content">
                    <div className="sender-row">
                      <label htmlFor="prefix">From</label>
                      <div className="sender-input">
                        <input
                          id="prefix"
                          aria-label="Sender prefix"
                          value={draft.prefix}
                          onChange={(e) => update("prefix", e.target.value)}
                          maxLength={64}
                        />
                        <span>@</span>
                        <select
                          aria-label="Sender domain"
                          value={draft.domain}
                          onChange={(e) => update("domain", e.target.value)}
                        >
                          {!domains.some((d) => d.name === draft.domain) && (
                            <option value={draft.domain}>
                              {displayDomain(draft.domain)}
                            </option>
                          )}
                          {domains.map((d) => (
                            <option key={d.name} value={d.name}>
                              {displayDomain(d.name)}
                            </option>
                          ))}
                        </select>
                      </div>
                      <button
                        className="text-button"
                        onClick={() => setAdvanced(!advanced)}
                        aria-expanded={advanced}
                      >
                        Options <ChevronDown size={13} />
                      </button>
                    </div>
                    {advanced && (
                      <>
                        <div className="field-row">
                          <label htmlFor="sender-name">Name</label>
                          <input
                            id="sender-name"
                            placeholder="Sender display name"
                            value={draft.name}
                            onChange={(e) => update("name", e.target.value)}
                            maxLength={100}
                          />
                        </div>
                        <div className="field-row">
                          <label htmlFor="cc">Cc</label>
                          <input
                            id="cc"
                            placeholder="Copy recipients"
                            value={draft.cc}
                            onChange={(e) => update("cc", e.target.value)}
                          />
                        </div>
                        <div className="field-row">
                          <label htmlFor="bcc">Bcc</label>
                          <input
                            id="bcc"
                            placeholder="Hidden recipients"
                            value={draft.bcc}
                            onChange={(e) => update("bcc", e.target.value)}
                          />
                        </div>
                      </>
                    )}
                    <div className="field-row">
                      <label htmlFor="to">To</label>
                      <input
                        id="to"
                        placeholder="Add recipients, separated by commas"
                        value={draft.to}
                        onChange={(e) => update("to", e.target.value)}
                        autoComplete="off"
                      />
                    </div>
                    <div className="field-row subject-row">
                      <label htmlFor="subject">Subject</label>
                      <input
                        id="subject"
                        placeholder="Add a subject"
                        value={draft.subject}
                        onChange={(e) => update("subject", e.target.value)}
                        maxLength={200}
                      />
                    </div>
                    {draft.domain && !active?.enabled && (
                      <div className="setup-notice">
                        <Info size={16} />
                        <div>
                          <strong>
                            {draft.testMode
                              ? "Test mode is on"
                              : "Verified-recipient sending is available"}
                          </strong>
                          <span>
                            {draft.testMode
                              ? `Only ${testRecipient || "your test address"} can receive this message.`
                              : "Use test mode for your verified address. Onboard in Cloudflare to send to other recipients."}
                          </span>
                        </div>
                        <button
                          className="text-button"
                          onClick={() => {
                            const on = !draft.testMode;
                            setDraft((d) => ({
                              ...d,
                              testMode: on,
                              ...(on
                                ? { to: testRecipient, cc: "", bcc: "" }
                                : {}),
                            }));
                            sendKey.current = null;
                          }}
                        >
                          {draft.testMode ? "Turn off" : "Use test mode"}
                        </button>
                      </div>
                    )}
                    {!domains.length && (
                      <div className="setup-notice">
                        <Info size={16} />
                        <div>
                          <strong>No sending domains enabled</strong>
                          <span>
                            Onboard a domain in Cloudflare Email Sending, then
                            sync.
                          </span>
                        </div>
                        <a
                          className="text-button"
                          href={cfLink}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Open Cloudflare
                        </a>
                      </div>
                    )}
                    <textarea
                      ref={editorRef}
                      className="message-editor"
                      aria-label="Message body"
                      placeholder="Write your message here…"
                      value={draft.body}
                      onChange={(e) => update("body", e.target.value)}
                      maxLength={50000}
                    />
                    <div className="editor-caption">
                      <span>Plain text · clean, consistent formatting</span>
                      <span>{draft.body.length.toLocaleString()} / 50,000</span>
                    </div>
                  </div>
                  <div className="compose-footer">
                    <button
                      className="primary send-button"
                      onClick={openReview}
                      disabled={!canReview}
                    >
                      <Send size={17} /> Review & send
                    </button>
                    <span className="review-hint">
                      You’ll review before sending.
                    </span>
                    <button
                      className="icon-button discard-button"
                      onClick={() => setDiscard(true)}
                      title="Discard draft"
                      aria-label="Discard draft"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </>
              ) : view === "domains" ? (
                <div className="domain-detail">
                  <div className="detail-heading">
                    <div>
                      <div className="eyebrow">DOMAIN DETAILS</div>
                      <h1>{displayDomain(draft.domain)}</h1>
                    </div>
                    <Globe2 size={28} />
                  </div>
                  <div className="domain-detail-body">
                    <span
                      className={
                        "status-badge " + (active?.enabled ? "good" : "amber")
                      }
                    >
                      {active?.enabled ? (
                        <CheckCircle2 size={15} />
                      ) : (
                        <AlertCircle size={15} />
                      )}{" "}
                      {active?.enabled
                        ? "Ready to send"
                        : "Verified recipient only"}
                    </span>
                    <h2>
                      {active?.enabled
                        ? "Make it your own."
                        : "Your next step, made simple."}
                    </h2>
                    <p>
                      {active?.enabled
                        ? "Choose a sender prefix and write your message. Your domain is enabled for sending."
                        : "This domain supports verified-recipient sending. Use test mode for your verified address; complete Cloudflare onboarding to send to other recipients."}
                    </p>
                    <div className="domain-facts">
                      <div>
                        <span>Domain</span>
                        <strong>{displayDomain(draft.domain)}</strong>
                      </div>
                      <div>
                        <span>Sender addresses</span>
                        <strong>Any valid prefix</strong>
                      </div>
                      <div>
                        <span>Incoming mail</span>
                        <strong>Configured separately</strong>
                      </div>
                    </div>
                    <div className="domain-examples">
                      <span>YOUR SENDER COULD BE</span>
                      <div>
                        <code>hello@{displayDomain(draft.domain)}</code>
                        <code>support@{displayDomain(draft.domain)}</code>
                      </div>
                    </div>
                    <div className="domain-actions">
                      <button className="primary" onClick={newMessage}>
                        <Plus size={17} /> Write a message
                      </button>
                      <a
                        className="secondary"
                        href={cfLink}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Open Cloudflare <ArrowUpRight size={16} />
                      </a>
                    </div>
                    <p className="footnote">
                      Sending to arbitrary recipients requires Workers Paid. New
                      sending domains must be onboarded before they appear as
                      ready.
                    </p>
                  </div>
                </div>
              ) : selected ? (
                <>
                  <div className="detail-heading">
                    <div>
                      <div className="eyebrow">RECENT SEND</div>
                      <h1>{selected.data.subject}</h1>
                    </div>
                    <span className="status-badge">{selected.status}</span>
                  </div>
                  <div className="sent-detail">
                    <div className="sender-profile">
                      <div className="domain-avatar ready-avatar">
                        {selected.data.name.slice(0, 1) || "M"}
                      </div>
                      <div>
                        <strong>
                          {selected.data.name || selected.data.prefix}
                        </strong>
                        <span>
                          {selected.data.prefix}@
                          {displayDomain(selected.data.domain)}
                        </span>
                      </div>
                      <time>{shortDate(selected.created)}</time>
                    </div>
                    <dl>
                      <dt>To</dt>
                      <dd>{selected.data.to}</dd>
                      {selected.data.cc && (
                        <>
                          <dt>Cc</dt>
                          <dd>{selected.data.cc}</dd>
                        </>
                      )}
                      {selected.data.bcc && (
                        <>
                          <dt>Bcc</dt>
                          <dd>{selected.data.bcc}</dd>
                        </>
                      )}
                    </dl>
                    <div className="sent-body">
                      {displayText(selected.data.body)}
                    </div>
                    <div className="delivery-details">
                      <ShieldCheck size={17} />
                      <div>
                        <strong>
                          {selected.status === "delivered"
                            ? "Accepted by the recipient’s mail server"
                            : selected.status === "queued"
                              ? "Queued for delivery"
                              : "Review delivery status"}
                        </strong>
                        <p>
                          {selected.status === "delivered"
                            ? "Inbox placement depends on the recipient’s mail provider."
                            : selected.result.message ||
                              "Check Cloudflare activity for the latest delivery information."}
                        </p>
                        {selected.result.permanent_bounces?.length > 0 && (
                          <p>
                            Bounced:{" "}
                            {selected.result.permanent_bounces.join(", ")}
                          </p>
                        )}
                        {selected.result.suppressed_recipients?.length > 0 && (
                          <p>
                            Suppressed:{" "}
                            {selected.result.suppressed_recipients.join(", ")}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                <div className="reading-empty">
                  <div className="empty-art">
                    <Mail size={40} />
                    <span>
                      <Check size={17} />
                    </span>
                  </div>
                  <h2>Your messages, in one place.</h2>
                  <p>
                    Select a recent send to see its message
                    <br />
                    and delivery result.
                  </p>
                  <button className="secondary" onClick={newMessage}>
                    <Plus size={16} /> Write a message
                  </button>
                </div>
              )}
            </section>
          </div>
        </main>
      </div>
      {domainMenu && (
        <div
          ref={menuRef}
          className="domain-menu"
          role="menu"
          aria-label="Domain visibility"
          style={{ left: domainMenu.x, top: domainMenu.y }}
        >
          <span>DOMAIN VISIBILITY</span>
          <button
            role="menuitem"
            disabled={visibilityBusy}
            onClick={toggleDomain}
          >
            {domains.find((d) => d.name === domainMenu.name)?.hidden ? (
              <Eye size={16} />
            ) : (
              <EyeOff size={16} />
            )}{" "}
            {visibilityBusy
              ? "Saving…"
              : domains.find((d) => d.name === domainMenu.name)?.hidden
                ? "Show domain"
                : "Hide domain"}
          </button>
          <small>Saved to your account</small>
        </div>
      )}
      {toast && (
        <div className="toast" role="status">
          <CheckCircle2 size={20} />
          {toast}
          <button
            onClick={() => setToast("")}
            aria-label="Dismiss notification"
          >
            <X size={16} />
          </button>
        </div>
      )}
      <dialog
        ref={dialog}
        className="modal review-modal"
        onCancel={(e) => {
          if (sending) e.preventDefault();
          else setReview(null);
        }}
      >
        <div className="modal-heading">
          <div>
            <span className="eyebrow">ONE LAST LOOK</span>
            <h2>Ready to send?</h2>
          </div>
          <button
            className="icon-button"
            aria-label="Close review"
            onClick={() => setReview(null)}
            disabled={sending}
          >
            <X size={20} />
          </button>
        </div>
        {review && (
          <>
            <div className="review-details">
              <dl>
                <dt>From</dt>
                <dd>
                  {review.name} &lt;{review.prefix}@
                  {displayDomain(review.domain)}&gt;
                </dd>
                <dt>To</dt>
                <dd>{review.to}</dd>
                {review.cc && (
                  <>
                    <dt>Cc</dt>
                    <dd>{review.cc}</dd>
                  </>
                )}
                {review.bcc && (
                  <>
                    <dt>Bcc</dt>
                    <dd>{review.bcc}</dd>
                  </>
                )}
              </dl>
              <h3>{review.subject}</h3>
              <div className="review-body">{displayText(review.body)}</div>
            </div>
            <div className="modal-footer">
              <button
                className="secondary"
                onClick={() => setReview(null)}
                disabled={sending}
              >
                Back to editing
              </button>
              <button className="primary" onClick={send} disabled={sending}>
                {sending ? (
                  <Loader2 size={16} className="spin" />
                ) : (
                  <Send size={16} />
                )}{" "}
                {sending
                  ? "Sending…"
                  : `Send message${recipients(review.to).length > 1 ? " · " + recipients(review.to).length + " recipients" : ""}`}
              </button>
            </div>
          </>
        )}
      </dialog>
      <dialog
        ref={infoDialog}
        className="modal info-modal"
        onCancel={() => setInfo(false)}
      >
        <div className="modal-heading">
          <h2>Your private mailroom</h2>
          <button
            className="icon-button"
            aria-label="Close help"
            onClick={() => setInfo(false)}
          >
            <X size={20} />
          </button>
        </div>
        <div className="help-content">
          <ShieldCheck size={32} />
          <h3>Private by design</h3>
          <p>
            This workspace is restricted to your signed-in account and protected
            by an additional password. Your Cloudflare token stays on the
            server.
          </p>
          <h3>Sending, without an inbox</h3>
          <p>
            Browse your domains and send from any valid prefix. Incoming
            messages and replies are handled by your domain’s existing email
            routing.
          </p>
          <h3>Ready means onboarded</h3>
          <p>
            Domains marked “Setup needed” must be enabled in Cloudflare before
            sending to arbitrary recipients. Test mode is limited to{" "}
            {testRecipient}.
          </p>
          <h3>Drafts and recent sends</h3>
          <p>
            Your draft and the latest 100 send records are stored privately in
            this workspace. Sessions lock after eight hours.
          </p>
          <a href={cfLink} target="_blank" rel="noreferrer">
            Manage Cloudflare Email Sending <ArrowUpRight size={14} />
          </a>
        </div>
      </dialog>
      <dialog
        ref={discardDialog}
        className="modal small-modal"
        onCancel={() => setDiscard(false)}
      >
        <div className="modal-heading">
          <h2>Discard this draft?</h2>
        </div>
        <p className="modal-copy">
          The recipients, subject, and message will be cleared.
        </p>
        <div className="modal-footer">
          <button className="secondary" onClick={() => setDiscard(false)}>
            Keep editing
          </button>
          <button
            className="primary danger"
            onClick={() => {
              setDraft((d) => ({
                ...blankMessage,
                prefix: d.prefix,
                domain: d.domain,
                name: d.name,
              }));
              sendKey.current = null;
              setDiscard(false);
            }}
          >
            Discard draft
          </button>
        </div>
      </dialog>
    </div>
  );
}
