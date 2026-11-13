# WebMCP browser tools

Open Mailroom in a browser with WebMCP support, sign in and unlock the workspace. Tools register through `document.modelContext` (with a `navigator.modelContext` compatibility fallback) while the page is open. Unsupported browsers keep the regular interface.

| Tool                     | Action                                                           |
| ------------------------ | ---------------------------------------------------------------- |
| `mailroom_list_domains`  | List available senders, masked names and recipient restrictions. |
| `mailroom_get_draft`     | Read the current draft, respecting domain masking.               |
| `mailroom_prepare_draft` | Replace and save a complete draft, then show the composer.       |
| `mailroom_review_draft`  | Open the draft for user review; no email is sent.                |

To prepare a draft, pass a `domainRef` returned by the domain list, plus `to`, `subject` and `body`. Optional fields are `prefix`, `name`, `cc`, `bcc`, and `testMode`. References are opaque and scoped to the current page session. Never substitute a masked display name for an actual sender.

Routing-only senders automatically use test mode, restricted to the configured verified recipient. Inputs use the same message validation as the UI. Each call rechecks the authenticated session through the protected API. Tools disappear when the workspace locks or the component unmounts. No credentials or direct-send tool are exposed; final sending remains the review dialog's **Send message** action.

Example request to your browser assistant:

> List my available senders, prepare a draft from the one I select, and show it for review. Do not send it.

The development-only `/demo` route supports the same tools with fictional data and simulated storage. Tests cover validation, session checks, masking and registration cleanup. Browser verification exercises discovery, draft preparation, readback, review, invalid references, and removal on leaving the workspace.

[WebMCP specification and implementation guidance](https://github.com/webmachinelearning/webmcp)
