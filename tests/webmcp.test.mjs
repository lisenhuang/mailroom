import test from "node:test";
import assert from "node:assert/strict";
import {
  createMailroomTools,
  registerMailroomTools,
} from "../lib/mailroom-webmcp.ts";
import { blankMessage } from "../lib/mail-core.ts";
function fixture() {
  const state = {
    unlocked: true,
    ready: true,
    busy: false,
    domains: [
      { name: "hidden.example", enabled: true, hidden: true },
      { name: "routing.example", enabled: false },
    ],
    draft: {
      ...blankMessage,
      domain: "hidden.example",
      to: "you@example.com",
      subject: "Hello",
      body: "See hidden.example",
    },
    testRecipient: "you@example.com",
  };
  let saves = 0,
    reviews = 0,
    session = true;
  const actions = {
    state: () => state,
    checkSession: async () => session,
    saveDraft: async (message) => {
      saves++;
      state.draft = message;
    },
    showReview: (message) => {
      reviews++;
      state.review = message;
    },
  };
  const tools = createMailroomTools(actions);
  const call = (name, input = {}) =>
    tools.find((t) => t.name === name).execute(input);
  return {
    state,
    actions,
    tools,
    call,
    get saves() {
      return saves;
    },
    get reviews() {
      return reviews;
    },
    expire: () => {
      session = false;
    },
  };
}
test("domain tools mask names and draft text, exposing only opaque sender references", async () => {
  const f = fixture();
  const result = await f.call("mailroom_list_domains");
  assert.equal(result.domains[0].name, "******.example");
  assert.match(result.domains[0].domainRef, /^domain-/);
  assert.equal(JSON.stringify(result).includes("hidden.example"), false);
  const draft = await f.call("mailroom_get_draft");
  assert.equal(draft.body, "See ******.example");
  assert.equal(JSON.stringify(draft).includes("hidden.example"), false);
});
test("tools reject locked or expired sessions and unknown fields before changing drafts", async () => {
  const f = fixture();
  await assert.rejects(
    f.call("mailroom_list_domains", { password: "ignored" }),
    /Unknown input/,
  );
  f.state.unlocked = false;
  await assert.rejects(f.call("mailroom_get_draft"), /Unlock/);
  f.state.unlocked = true;
  f.expire();
  await assert.rejects(f.call("mailroom_get_draft"), /expired/);
  assert.equal(f.saves, 0);
});
test("preparing a routing-only draft validates recipients and saves without sending", async () => {
  const f = fixture();
  const { domains } = await f.call("mailroom_list_domains");
  const input = {
    domainRef: domains[1].domainRef,
    to: "elsewhere@example.com",
    subject: "Hello",
    body: "A message",
  };
  await assert.rejects(
    f.call("mailroom_prepare_draft", input),
    /verified recipient/,
  );
  assert.equal(f.saves, 0);
  const result = await f.call("mailroom_prepare_draft", {
    ...input,
    to: "you@example.com",
  });
  assert.equal(result.saved, true);
  assert.equal(result.sent, false);
  assert.equal(f.state.draft.testMode, true);
  assert.equal(f.state.draft.domain, "routing.example");
  assert.equal(f.saves, 1);
  assert.equal("domainRef" in f.state.draft, false);
  await f.call("mailroom_review_draft");
  assert.equal(f.reviews, 1);
  assert.equal(
    f.tools.some((t) => t.name === "mailroom_send"),
    false,
  );
});
test("invalid references and header injection never reach persistence", async () => {
  const f = fixture();
  const { domains } = await f.call("mailroom_list_domains");
  await assert.rejects(
    f.call("mailroom_prepare_draft", {
      domainRef: "unknown",
      to: "you@example.com",
      subject: "Hi",
      body: "Message",
    }),
    /Unknown domainRef/,
  );
  await assert.rejects(
    f.call("mailroom_prepare_draft", {
      domainRef: domains[0].domainRef,
      to: "you@example.com",
      subject: "Hi\r\nBcc:evil@example.com",
      body: "Message",
    }),
  );
  assert.equal(f.saves, 0);
});
test("registration is abortable and unsupported registries leave the UI intact", () => {
  const f = fixture(),
    signals = [];
  const dispose = registerMailroomTools(
    {
      registerTool(_tool, options) {
        signals.push(options.signal);
      },
    },
    f.actions,
  );
  assert.equal(signals.length, 4);
  dispose();
  assert.ok(signals.every((s) => s.aborted));
  assert.doesNotThrow(() =>
    registerMailroomTools(
      {
        registerTool() {
          throw new Error("unsupported");
        },
      },
      f.actions,
    )(),
  );
});
