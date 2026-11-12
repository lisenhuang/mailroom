export type Message = {
  prefix: string;
  domain: string;
  name: string;
  to: string;
  cc: string;
  bcc: string;
  subject: string;
  body: string;
  testMode: boolean;
};
export const blankMessage: Message = {
  prefix: "hello",
  domain: "",
  name: "",
  to: "",
  cc: "",
  bcc: "",
  subject: "",
  body: "",
  testMode: false,
};
export function recipients(value: string) {
  return value
    .split(/[;,\n]/)
    .map((x) => x.trim())
    .filter(Boolean);
}
export function validateMessage(value: unknown): Message {
  if (!value || typeof value !== "object")
    throw new Error("Enter your message details.");
  const m = value as Message;
  for (const k of [
    "prefix",
    "domain",
    "name",
    "to",
    "cc",
    "bcc",
    "subject",
    "body",
  ] as const)
    if (typeof m[k] !== "string") throw new Error("Invalid message details.");
  if (
    !/^[a-zA-Z0-9!#$%&'*+/=?^_`{|}~.-]{1,64}$/.test(m.prefix) ||
    m.prefix.startsWith(".") ||
    m.prefix.endsWith(".") ||
    m.prefix.includes("..")
  )
    throw new Error("Enter a valid sender prefix.");
  if (!/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(m.domain))
    throw new Error("Choose a valid domain.");
  const all = [...recipients(m.to), ...recipients(m.cc), ...recipients(m.bcc)];
  if (!recipients(m.to).length)
    throw new Error("Add at least one To recipient.");
  if (all.length > 20)
    throw new Error("Use at most 20 recipients per message.");
  if (
    all.some(
      (x) =>
        x.length > 254 || !/^[^\s@<>,;]+@[^\s@<>,;]+\.[^\s@<>,;]+$/.test(x),
    )
  )
    throw new Error("Check the recipient email addresses.");
  if (!m.subject.trim() || m.subject.length > 200 || /[\r\n]/.test(m.subject))
    throw new Error("Enter a subject of up to 200 characters.");
  if (!m.body.trim() || m.body.length > 50000)
    throw new Error("Enter a message of up to 50,000 characters.");
  if (m.name.length > 100 || /[\r\n]/.test(m.name))
    throw new Error("Check the sender name.");
  return {
    ...m,
    domain: m.domain.toLowerCase(),
    testMode: m.testMode === true,
  };
}
export const escapeHtml = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
export async function digest(value: string) {
  return Array.from(
    new Uint8Array(
      await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)),
    ),
  )
    .map((x) => x.toString(16).padStart(2, "0"))
    .join("");
}
export function sameOrigin(request: Request) {
  return request.headers.get("origin") === new URL(request.url).origin;
}

// Cosmetic domain masking. Never use this value in an API request or email address.
export function maskDomain(domain: string): string {
  const dot = domain.lastIndexOf(".");
  return dot < 0
    ? "*".repeat(domain.length)
    : "*".repeat(dot) + domain.slice(dot);
}

// Keep successfully used test domains visible without admitting every DNS zone.
export function visibleSendingDomains<
  T extends { name: string; enabled: boolean; routingEnabled?: boolean },
>(domains: T[], tested: Set<string>) {
  return domains
    .filter((d) => d.enabled || d.routingEnabled || tested.has(d.name))
    .map((d) => ({ ...d, testOnly: !d.enabled }));
}
