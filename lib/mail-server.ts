import { env as rawEnv } from "cloudflare:workers";
import {
  digest,
  validateMessage,
  recipients,
  escapeHtml,
  type Message,
} from "./mail-core";
export type MailEnv = {
  DB: D1Database;
  CF_EMAIL_TOKEN: string;
  CF_ACCOUNT_ID: string;
  LOGIN_HASH: string;
  LOGIN_SALT: string;
  SESSION_SECRET: string;
  TEST_RECIPIENT: string;
};
export const env = rawEnv as unknown as MailEnv;
const enc = new TextEncoder();
export const cookieName = "mailroom_session";
const b64 = (a: Uint8Array) =>
  btoa(String.fromCharCode(...a))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
const un64 = (s: string) =>
  Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/")), (c) =>
    c.charCodeAt(0),
  );
async function signKey() {
  return crypto.subtle.importKey(
    "raw",
    enc.encode(env.SESSION_SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}
export async function makeSession(owner: string) {
  const payload = b64(
    enc.encode(
      JSON.stringify({
        owner,
        exp: Date.now() + 8 * 3600_000,
        nonce: crypto.randomUUID(),
      }),
    ),
  );
  return (
    payload +
    "." +
    b64(
      new Uint8Array(
        await crypto.subtle.sign("HMAC", await signKey(), enc.encode(payload)),
      ),
    )
  );
}
export async function sessionValid(request: Request, owner: string) {
  try {
    const token = request.headers
      .get("cookie")
      ?.split(";")
      .map((x) => x.trim())
      .find((x) => x.startsWith(cookieName + "="))
      ?.slice(cookieName.length + 1);
    if (!token) return false;
    const [payload, sig, ...extra] = token.split(".");
    if (extra.length || !sig) return false;
    if (
      !(await crypto.subtle.verify(
        "HMAC",
        await signKey(),
        un64(sig),
        enc.encode(payload),
      ))
    )
      return false;
    const data = JSON.parse(new TextDecoder().decode(un64(payload)));
    return data.owner === owner && data.exp > Date.now();
  } catch {
    return false;
  }
}
export function sessionCookie(value: string, request: Request) {
  return `${cookieName}=${value}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${value ? 28800 : 0}${new URL(request.url).protocol === "https:" ? "; Secure" : ""}`;
}
export async function checkPassword(password: string) {
  if (password.length > 200) return false;
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bytes = new Uint8Array(
    env.LOGIN_SALT.match(/../g)!.map((x) => parseInt(x, 16)),
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: bytes, iterations: 100000, hash: "SHA-256" },
    key,
    256,
  );
  const hash = Array.from(new Uint8Array(bits))
    .map((x) => x.toString(16).padStart(2, "0"))
    .join("");
  let mismatch = hash.length ^ env.LOGIN_HASH.length;
  for (let i = 0; i < hash.length; i++)
    mismatch |= hash.charCodeAt(i) ^ (env.LOGIN_HASH.charCodeAt(i) || 0);
  return mismatch === 0;
}
export async function cloudflare(path: string, body?: unknown) {
  const r = await fetch("https://api.cloudflare.com/client/v4/" + path, {
    method: body ? "POST" : "GET",
    headers: {
      Authorization: `Bearer ${env.CF_EMAIL_TOKEN}`,
      "Content-Type": "application/json",
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
    signal: AbortSignal.timeout(25000),
  });
  let d;
  try {
    d = (await r.json()) as any;
  } catch {
    throw new Error("Cloudflare returned an unexpected response.");
  }
  if (!r.ok || !d.success)
    throw new Error(
      (
        d.errors?.[0]?.message || "Cloudflare could not complete this request."
      ).slice(0, 240),
    );
  return d;
}
async function listAll(path: string) {
  let items: any[] = [];
  for (let page = 1; page <= 100; page++) {
    const d = await cloudflare(
      path + (path.includes("?") ? "&" : "?") + `per_page=50&page=${page}`,
    );
    if (!Array.isArray(d.result)) throw new Error("Unexpected domain list.");
    items.push(...d.result);
    if (
      !d.result_info ||
      page >=
        (d.result_info.total_pages ||
          Math.ceil(d.result_info.total_count / 50)) ||
      d.result.length < 50
    )
      return items;
  }
  throw new Error("Domain list is too large.");
}
export async function domainList() {
  const [zones, sending] = await Promise.all([
    listAll(`zones?account.id=${env.CF_ACCOUNT_ID}`),
    listAll(`accounts/${env.CF_ACCOUNT_ID}/email/sending/zones`),
  ]);
  const ready = new Set(
    sending.filter((x) => x.enabled === true).map((x) => x.name),
  );
  const known = new Set(zones.map((x) => x.name));
  const rows = zones.map((z) => ({
    name: z.name,
    zoneId: z.id,
    enabled: ready.has(z.name),
    kind: "domain",
    status: z.status,
  }));
  for (let i = 0; i < sending.length; i += 5) {
    await Promise.all(
      sending.slice(i, i + 5).map(async (z) => {
        const zone = zones.find((x) => x.name === z.name);
        if (!zone) return;
        const d = await cloudflare(`zones/${zone.id}/email/sending/subdomains`);
        for (const s of d.result || []) {
          if (!known.has(s.name) && !s.name.startsWith("*.")) {
            rows.push({
              name: s.name,
              zoneId: zone.id,
              enabled: !!s.enabled,
              kind: "subdomain",
              status: s.enabled ? "active" : "disabled",
            });
            known.add(s.name);
          }
        }
      }),
    );
  }
  return rows.sort(
    (a, b) =>
      Number(b.enabled) - Number(a.enabled) || a.name.localeCompare(b.name),
  );
}
export async function sendMessage(owner: string, key: string, input: unknown) {
  const m = validateMessage(input);
  if (!/^[0-9a-f-]{36}$/i.test(key))
    throw new Error("Missing send request identifier.");
  const fingerprint = await digest(JSON.stringify(m));
  const existing = await env.DB.prepare(
    "SELECT owner,fingerprint,status,result FROM sends WHERE id=?",
  )
    .bind(key)
    .first<any>();
  if (existing) {
    if (existing.owner !== owner || existing.fingerprint !== fingerprint)
      throw new Error("This send request was already used.");
    return {
      status: existing.status,
      ...JSON.parse(existing.result || "{}"),
      duplicate: true,
    };
  }
  const domains = await domainList();
  const domain = domains.find((d) => d.name === m.domain);
  if (!domain)
    throw new Error("This domain is not in your Cloudflare account.");
  if (m.testMode) {
    const all = [
      ...recipients(m.to),
      ...recipients(m.cc),
      ...recipients(m.bcc),
    ];
    if (all.some((x) => x.toLowerCase() !== env.TEST_RECIPIENT.toLowerCase()))
      throw new Error("Test mode only sends to your configured test address.");
  } else if (!domain.enabled)
    throw new Error(
      "Onboard this domain in Cloudflare Email Sending, or use test mode for your verified address.",
    );
  const result = await env.DB.prepare(
    "INSERT OR IGNORE INTO sends(id,owner,fingerprint,data,status,created) VALUES(?,?,?,?,'sending',?)",
  )
    .bind(key, owner, fingerprint, JSON.stringify(m), Date.now())
    .run();
  if (!result.meta.changes) return { status: "sending", duplicate: true };
  try {
    const response = await cloudflare(
      `accounts/${env.CF_ACCOUNT_ID}/email/sending/send`,
      {
        from: { address: `${m.prefix}@${m.domain}`, name: m.name || m.prefix },
        to: recipients(m.to),
        ...(m.cc ? { cc: recipients(m.cc) } : {}),
        ...(m.bcc ? { bcc: recipients(m.bcc) } : {}),
        subject: m.subject,
        text: m.body,
        html:
          '<div style="font-family:Arial,sans-serif;white-space:pre-wrap">' +
          escapeHtml(m.body) +
          "</div>",
      },
    );
    const r = response.result;
    const status =
      r.permanent_bounces?.length || r.suppressed_recipients?.length
        ? "partial"
        : r.queued?.length
          ? "queued"
          : "delivered";
    await env.DB.prepare("UPDATE sends SET status=?,result=? WHERE id=?")
      .bind(status, JSON.stringify(r), key)
      .run();
    return { status, ...r };
  } catch {
    const result = {
      message:
        "Delivery could not be confirmed. Check Cloudflare activity before sending again.",
    };
    await env.DB.prepare(
      "UPDATE sends SET status='unconfirmed',result=? WHERE id=?",
    )
      .bind(JSON.stringify(result), key)
      .run();
    return { status: "unconfirmed", ...result };
  }
}
