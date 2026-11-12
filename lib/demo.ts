import { blankMessage, type Message } from "./mail-core";

// Fictional RFC-reserved domains only. This transport never calls fetch.
export function createDemoApi() {
  const domains = [
    "northstar.example",
    "studio.example",
    "updates.example",
    "sandbox.example",
  ].map((name, i) => ({
    name,
    zoneId: `demo-${i}`,
    enabled: true,
    kind: "domain",
    status: "active",
    hidden: false,
  }));
  let draft: Message = {
    ...blankMessage,
    prefix: "hello",
    name: "Northstar Studio",
    domain: domains[0].name,
    to: "alex@example.com",
    subject: "A little update from the studio",
    body: "Hi Alex,\n\nThe new collection is ready for a first look. We have kept things simple: thoughtful details, a lighter palette, and a little more room to breathe.\n\nI would love to hear what you think.\n\nWarmly,\nThe Northstar team",
  };
  const messages = [
    {
      id: "demo-welcome",
      data: {
        ...draft,
        to: "jamie@example.com",
        subject: "Welcome to your new workspace",
        body: "Hi Jamie,\n\nA small note to say welcome. Everything you need is now in one place.\n\nTake a look around, make yourself at home, and send something thoughtful.\n\nThe Northstar team",
      },
      status: "delivered",
      result: {},
      created: Date.UTC(2026, 10, 12, 9, 15),
    },
    {
      id: "demo-notes",
      data: {
        ...draft,
        domain: "studio.example",
        to: "team@example.com",
        subject: "Notes for our next chapter",
        body: "Hello team,\n\nHere are the highlights for our next studio session. Bring your ideas and a fresh perspective.\n\nSee you soon.",
      },
      status: "queued",
      result: {},
      created: Date.UTC(2026, 10, 11, 14, 30),
    },
  ];
  return async (path: string, body?: any): Promise<any> => {
    if (path === "session") return { unlocked: true };
    if (path === "domains")
      return { domains, testRecipient: "you@example.com" };
    if (path === "domain-visibility") {
      const domain = domains.find((d) => d.name === body.domain);
      if (domain) domain.hidden = body.hidden;
      return { ok: true };
    }
    if (path === "history") return { messages: [...messages] };
    if (path === "draft") {
      if (body) draft = body.data;
      return { draft: { ...draft } };
    }
    if (path === "send") {
      messages.unshift({
        id: body.id,
        data: body.message,
        status: "delivered",
        result: {},
        created: Date.now(),
      });
      return { status: "delivered", simulated: true };
    }
    if (path === "logout" || path === "login") return { ok: true };
    throw new Error("Unknown demo action.");
  };
}
