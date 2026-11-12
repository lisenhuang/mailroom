# Private hosting on ChatGPT Sites

This source is a reusable template. `.openai/hosting.json` intentionally has **no project ID**. Never reuse another person's Site identity, secrets, database, or Git history.

1. Use the Sites skill to initialize from this sanitized template. Preserve its `sites()` Vite integration and trusted identity helpers.
2. Create a new **owner-only** Site. Save its returned `project_id` in the deployment checkout's hosting manifest. Do not commit that personal manifest to the public template repository.
3. Retain `"d1": "DB"` and apply the SQL migration in `drizzle/`. Sites packages these migrations with the build.
4. Generate a new random password, salt, hash, and session secret (see `scripts/setup-local.mjs` for compatible PBKDF2 parameters). Store the password in your password manager.
5. Configure the following runtime values with Sites environment tools. Never use client/public environment prefixes.

| Name             | Storage            | Purpose                                              |
| ---------------- | ------------------ | ---------------------------------------------------- |
| `CF_EMAIL_TOKEN` | Secret             | Scoped Cloudflare API token                          |
| `CF_ACCOUNT_ID`  | Server environment | Account owning the domains                           |
| `TEST_RECIPIENT` | Server environment | Verified address permitted in test mode              |
| `LOGIN_SALT`     | Secret             | Hex-encoded, random 16-byte salt                     |
| `LOGIN_HASH`     | Secret             | Hex PBKDF2-SHA256 hash, 100,000 iterations, 32 bytes |
| `SESSION_SECRET` | Secret             | Random 48-byte base64url signing secret              |

6. Run typecheck, tests and build. Use the Sites source helper and **private deployment** operation. Check anonymous access is denied, login works, and domain discovery works. Ask before any test email.

Keep the audience owner-only. The app trusts identity headers injected by Sites, so an independently exposed Worker is not a supported secure deployment. `/demo` is development-only and never calls the email API. Local sign-in is emulated on loopback; it is not a production identity service.

Domain discovery lists domains, not existing mailboxes. Sending prefixes do not create inboxes. Domain onboarding, DNS, reply routing and billing stay in Cloudflare.
