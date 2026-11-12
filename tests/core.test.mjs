import test from "node:test";
import assert from "node:assert/strict";
import {
  blankMessage,
  validateMessage,
  sameOrigin,
  escapeHtml,
  recipients,
  maskDomain,
  visibleSendingDomains,
} from "../lib/mail-core.ts";
const valid = {
  ...blankMessage,
  domain: "example.com",
  to: "owner@example.com",
  subject: "Hello",
  body: "A private message.",
};
test("valid sender prefixes and multiple recipients are supported", () => {
  assert.equal(
    validateMessage({
      ...valid,
      prefix: "support+team",
      to: "one@example.com; two@example.com",
    }).prefix,
    "support+team",
  );
  assert.deepEqual(recipients("one@example.com; two@example.com"), [
    "one@example.com",
    "two@example.com",
  ]);
});
test("rejects header injection and malformed sender identities", () => {
  for (const prefix of [
    "a\r\nBcc:x@x.com",
    ".name",
    "name.",
    "two..dots",
    "name@evil",
  ])
    assert.throws(() => validateMessage({ ...valid, prefix }));
  assert.throws(() =>
    validateMessage({
      ...valid,
      subject: "Subject\r\nBcc: somebody@example.com",
    }),
  );
});
test("rejects invalid and excessive recipients and empty message", () => {
  assert.throws(() => validateMessage({ ...valid, to: "not-an-email" }));
  assert.throws(() =>
    validateMessage({
      ...valid,
      to: Array.from({ length: 21 }, (_, i) => `a${i}@example.com`).join(","),
    }),
  );
  assert.throws(() => validateMessage({ ...valid, body: " " }));
});
test("HTML is escaped before sending", () => {
  assert.equal(
    escapeHtml("<script>\"&'</script>"),
    "&lt;script&gt;&quot;&amp;&#39;&lt;/script&gt;",
  );
});
test("mutations only accept the exact same Origin", () => {
  assert.equal(
    sameOrigin(
      new Request("https://mail.example.com/api/send", {
        headers: { Origin: "https://mail.example.com" },
      }),
    ),
    true,
  );
  for (const origin of [
    "https://evil.example.com",
    "null",
    "https://mail.example.com.evil.com",
  ])
    assert.equal(
      sameOrigin(
        new Request("https://mail.example.com/api/send", {
          headers: { Origin: origin },
        }),
      ),
      false,
    );
  assert.equal(
    sameOrigin(new Request("https://mail.example.com/api/send")),
    false,
  );
});

test("domain masking preserves suffix and exact prefix length", () => {
  assert.equal(maskDomain("northstar.example"), "*********.example");
  assert.equal(maskDomain("sub.example.com"), "***********.com");
  assert.equal(maskDomain("abc"), "***");
});

test("successful test domains remain visible while unrelated or inaccessible zones stay excluded", () => {
  const rows = visibleSendingDomains(
    [
      { name: "configured.example", enabled: true },
      { name: "tested.example", enabled: false },
      { name: "unused.example", enabled: false },
    ],
    new Set(["tested.example", "inaccessible.example"]),
  );
  assert.deepEqual(
    rows.map((x) => [x.name, x.testOnly]),
    [
      ["configured.example", false],
      ["tested.example", true],
    ],
  );
});

test("routing domains are included before any send history exists", () => {
  assert.deepEqual(
    visibleSendingDomains(
      [
        { name: "routing.example", enabled: false, routingEnabled: true },
        { name: "unused.example", enabled: false, routingEnabled: false },
      ],
      new Set(),
    ).map((d) => d.name),
    ["routing.example"],
  );
});
