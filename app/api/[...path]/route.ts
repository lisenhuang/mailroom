import {
  env,
  sessionValid,
  makeSession,
  sessionCookie,
  checkPassword,
  domainList,
  sendMessage,
} from "@/lib/mail-server";
import { digest, sameOrigin, visibleSendingDomains } from "@/lib/mail-core";
export const dynamic = "force-dynamic";
const json = (
  data: unknown,
  status = 200,
  headers: Record<string, string> = {},
) =>
  Response.json(data, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      ...headers,
    },
  });
async function handle(request: Request) {
  try {
    const owner = request.headers.get("oai-authenticated-user-id");
    if (!owner || !request.headers.get("oai-authenticated-user-email"))
      return json({ error: "Sign in to the private Site first." }, 401);
    const path = new URL(request.url).pathname.replace("/api/", "");
    if (request.method !== "GET" && !sameOrigin(request))
      return json({ error: "Request origin rejected." }, 403);
    if (
      request.method === "POST" &&
      Number(request.headers.get("content-length") || 0) > 150000
    )
      return json({ error: "Request too large." }, 413);
    if (path === "session" && request.method === "GET")
      return json({ unlocked: await sessionValid(request, owner) });
    let body: any;
    async function read() {
      const text = await request.text();
      if (text.length > 150000) throw new Error("Request too large.");
      return JSON.parse(text);
    }
    if (path === "login" && request.method === "POST") {
      body = await read();
      if (typeof body.password !== "string")
        return json({ error: "Enter your password." }, 400);
      const key = await digest(
        owner + ":" + (request.headers.get("cf-connecting-ip") || "owner"),
      );
      const now = Date.now();
      const rate = await env.DB.prepare(
        "INSERT INTO login_attempts(key,count,expires) VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET count=CASE WHEN expires<? THEN 1 ELSE count+1 END, expires=CASE WHEN expires<? THEN excluded.expires ELSE expires END RETURNING count",
      )
        .bind(key, now + 900000, now, now)
        .first<any>();
      if (rate.count > 10)
        return json(
          { error: "Too many attempts. Try again in 15 minutes." },
          429,
        );
      if (!(await checkPassword(body.password)))
        return json({ error: "That password is incorrect. Try again." }, 401);
      await env.DB.prepare("DELETE FROM login_attempts WHERE key=?")
        .bind(key)
        .run();
      return json({ ok: true }, 200, {
        "Set-Cookie": sessionCookie(await makeSession(owner), request),
      });
    }
    if (path === "logout" && request.method === "POST")
      return json({ ok: true }, 200, {
        "Set-Cookie": sessionCookie("", request),
      });
    if (!(await sessionValid(request, owner)))
      return json({ error: "Unlock your mailroom to continue." }, 401);
    if (path === "domains" && request.method === "GET") {
      const priorTests = await env.DB.prepare(
        "SELECT DISTINCT json_extract(data,'$.domain') AS domain FROM sends WHERE owner=? AND status IN ('delivered','queued') AND json_extract(data,'$.testMode')=1",
      )
        .bind(owner)
        .all<{ domain: string }>();
      const tested = new Set(priorTests.results.map((row) => row.domain));

      const [domains, prefs] = await Promise.all([
        domainList(),
        env.DB.prepare(
          "SELECT domain,hidden FROM domain_preferences WHERE owner=?",
        )
          .bind(owner)
          .all<{ domain: string; hidden: number }>(),
      ]);
      const hidden = new Set(
        prefs.results.filter((p) => p.hidden === 1).map((p) => p.domain),
      );
      return json({
        domains: visibleSendingDomains(domains, tested).map((d) => ({
          ...d,
          hidden: hidden.has(d.name),
        })),
        testRecipient: env.TEST_RECIPIENT,
      });
    }
    if (path === "domain-visibility" && request.method === "POST") {
      body = await read();
      if (
        typeof body.domain !== "string" ||
        body.domain.length > 253 ||
        typeof body.hidden !== "boolean"
      )
        return json({ error: "Invalid domain preference." }, 400);
      const domains = await domainList();
      if (!domains.some((d) => d.name === body.domain))
        return json({ error: "Domain not found in this account." }, 400);
      await env.DB.prepare(
        "INSERT INTO domain_preferences(owner,domain,hidden) VALUES(?,?,?) ON CONFLICT(owner,domain) DO UPDATE SET hidden=excluded.hidden",
      )
        .bind(owner, body.domain, body.hidden ? 1 : 0)
        .run();
      return json({ ok: true, hidden: body.hidden });
    }
    if (path === "history" && request.method === "GET") {
      const rows = await env.DB.prepare(
        "SELECT id,data,status,result,created FROM sends WHERE owner=? ORDER BY created DESC LIMIT 100",
      )
        .bind(owner)
        .all<any>();
      return json({
        messages: rows.results.map((r) => ({
          ...r,
          data: JSON.parse(r.data),
          result: JSON.parse(r.result || "{}"),
        })),
      });
    }
    if (path === "draft" && request.method === "GET") {
      const draft = await env.DB.prepare(
        "SELECT data,updated FROM drafts WHERE owner=?",
      )
        .bind(owner)
        .first<any>();
      return json({ draft: draft ? JSON.parse(draft.data) : null });
    }
    if (path === "draft" && request.method === "POST") {
      body = await read();
      if (
        !Number.isSafeInteger(body.updated) ||
        typeof body.data !== "object" ||
        !body.data
      )
        throw new Error("Invalid draft.");
      await env.DB.prepare(
        "INSERT INTO drafts(owner,data,updated) VALUES(?,?,?) ON CONFLICT(owner) DO UPDATE SET data=excluded.data,updated=excluded.updated WHERE excluded.updated>=drafts.updated",
      )
        .bind(owner, JSON.stringify(body.data), body.updated)
        .run();
      return json({ ok: true });
    }
    if (path === "send" && request.method === "POST") {
      body = await read();
      return json(await sendMessage(owner, body.id, body.message));
    }
    return json({ error: "Not found." }, 404);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Something went wrong.";
    return json(
      { error: message.replace(/cfat_[a-zA-Z0-9_-]+/g, "[redacted]") },
      400,
    );
  }
}
export const GET = handle;
export const POST = handle;
