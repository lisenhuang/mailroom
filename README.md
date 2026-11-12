<div align="center">

# ✉️ Mailroom

**Your domains. One quiet workspace.**

An Outlook-inspired email composer for Cloudflare, built to stay private.

[Local setup](#-run-locally) · [ChatGPT Sites](#-run-on-chatgpt-sites) · [MIT license](LICENSE)

</div>

![Mailroom in light mode, showing fictional domains and a draft](docs/images/compose-light.jpg)

| ✉️ Compose                                     | 🌐 Domains                                              | 🌗 Appearance                                  | 🔒 Private                               |
| ---------------------------------------------- | ------------------------------------------------------- | ---------------------------------------------- | ---------------------------------------- |
| Autosaved draft, Cc/Bcc, review before sending | Choose sender prefixes; hide domains with a right-click | System by default, with Light and Dark choices | Password unlock, server-side credentials |

**Dark mode · recent sends**

![Mailroom in dark mode, showing fictional send history](docs/images/history-dark.jpg)

Right-click a domain → **Hide / Show**. Masking is cosmetic (`northstar.example` → `*********.example`); the preference is saved in your backend.

_All screenshots use fictional data. This is a sender, not an inbox._

## 🚀 Run locally

Requires **Node.js 22.13+** and npm.

```sh
git clone https://github.com/lisenhuang/mailroom.git
cd mailroom
npm ci
npm run dev
```

Open **http://localhost:5173/demo**. No account or key needed; demo sends are simulated. The demo route is disabled in production builds.

**Connect your Cloudflare account:**

```sh
npm run setup
# Edit .dev.vars: CF_ACCOUNT_ID, CF_EMAIL_TOKEN, TEST_RECIPIENT
npm run db:migrate
npm run dev
```

Open **http://localhost:5173**, use the local sign-in, then unlock with the password in `.mailroom-password`. Save it in your password manager. Restart the server after changing `.dev.vars`.

Domains enabled for Email Sending appear alongside enabled Email Routing domains that can send to verified recipients. Successful test-mode history is retained as a fallback. Both must remain accessible to your token. Test-only domains are labeled **Verified recipient only**.

### 🔑 Cloudflare key

1. In Cloudflare, open **Manage Account → API Tokens → Create Token**. Choose a custom token and name it `Mailroom`. See the [official token guide](https://developers.cloudflare.com/fundamentals/api/get-started/create-token/).
2. Add these permissions and scope them to your sending account and domains. Zone Settings Read lets Mailroom check whether Email Routing is enabled:

   | Scope   | Permission    | Access       |
   | ------- | ------------- | ------------ |
   | Account | Email Sending | Edit / Write |
   | Zone    | Zone          | Read         |
   | Zone    | Zone Settings | Read         |

   Select all zones in that account to discover all its sending domains, or select specific zones to limit access.

3. Create the token and save its secret in your password manager. Cloudflare shows it once. Use this scoped API token rather than your Global API Key.
4. Run `npm run setup`, then fill in the generated **`.dev.vars`**:

   ```dotenv
   CF_ACCOUNT_ID="your_cloudflare_account_id"
   CF_EMAIL_TOKEN="your_scoped_api_token"
   TEST_RECIPIENT="you@example.com"
   ```

   Copy your Account ID from the Cloudflare dashboard. Leave the generated login/session values intact. On ChatGPT Sites, configure these as server environment values instead; see [Sites setup](docs/SITES.md).

5. [Onboard your domain in Email Sending](https://developers.cloudflare.com/email-service/get-started/send-emails/) and complete its DNS authentication. Verify your test recipient in Cloudflare, restart Mailroom, then **Sync**. An empty list means no accessible domain is enabled or has routing enabled or successful test-mode history in this workspace.

Keep `.dev.vars` private and untracked. Test mode is restricted to the configured verified address; Cloudflare plan limits still apply.

## 🤖 Run on ChatGPT Sites

With **Sites available in ChatGPT/Codex**, paste:

```text
Create my own private Mailroom from https://github.com/lisenhuang/mailroom.
Use the Sites skill and this repo's docs/SITES.md. Create a NEW owner-only
Site with D1 binding DB. Keep System / Light / Dark themes. Generate a
strong password and configure server-side secrets securely. Ask for my
Cloudflare account ID, scoped token and verified test address through a
secure setup flow. Never put credentials in chat, source or browser code.
Apply migrations, test access controls, then deploy privately. Show me a
draft before sending any real email. Never make my workspace public.
```

Sites adds owner ChatGPT sign-in before the password screen. See [hosting notes and secret names](docs/SITES.md).

## Small print

Local development binds to loopback. Production requires **owner-only Sites hosting**; do not expose the raw Worker directly. Secrets, databases, and generated passwords are gitignored. Only theme preference is stored in browser local storage.

```text
Browser → private sign-in + password → server → Cloudflare Email API
                                      └──────→ D1 drafts & send history
```

`npm test` · `npm run typecheck` · `npm run build`

React + Vinext · Cloudflare Workers + D1 · [MIT](LICENSE) · [Third-party notices](NOTICE.md)
