import { randomBytes, pbkdf2Sync } from "node:crypto";
import { writeFileSync, existsSync } from "node:fs";
if (existsSync(".dev.vars") || existsSync(".mailroom-password")) {
  console.error(
    "Local credentials already exist. Setup will not overwrite them.",
  );
  process.exit(1);
}
const password = randomBytes(24).toString("base64url");
const salt = randomBytes(16).toString("hex");
const hash = pbkdf2Sync(
  password,
  Buffer.from(salt, "hex"),
  100000,
  32,
  "sha256",
).toString("hex");
const config = {
  CF_ACCOUNT_ID: "",
  CF_EMAIL_TOKEN: "",
  TEST_RECIPIENT: "",
  LOGIN_SALT: salt,
  LOGIN_HASH: hash,
  SESSION_SECRET: randomBytes(48).toString("base64url"),
};
writeFileSync(
  ".dev.vars",
  Object.entries(config)
    .map(([k, v]) => k + "=" + JSON.stringify(v))
    .join("\n") + "\n",
  { mode: 0o600, flag: "wx" },
);
writeFileSync(".mailroom-password", password + "\n", {
  mode: 0o600,
  flag: "wx",
});
console.log("Created .dev.vars and .mailroom-password (owner-readable only).");
console.log(
  "Add your Cloudflare account ID, token and verified test recipient to .dev.vars.",
);
console.log(
  "Save the generated password in your password manager, then run npm run db:migrate.",
);
