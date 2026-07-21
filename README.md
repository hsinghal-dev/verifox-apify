# Verifox Email Verifier

Bulk-verify email deliverability with **[Verifox](https://verifox.ai)** — right inside your Apify workflows. Feed it a list of emails (or pipe in a dataset from any scraper) and get a clean, per-email verdict: is it valid, reachable, disposable, role-based, free-provider, and how good is it (0–100 score).

## What you get per email

| Field | Meaning |
|-------|---------|
| `email` | The address checked |
| `reachable` | `yes` / `no` / `unknown` — SMTP deliverability |
| `isValid` | Passes syntax + MX + SMTP checks |
| `syntax` | Valid address format |
| `smtp` | SMTP mailbox check detail |
| `isDisposable` | Throwaway/temp-mail provider |
| `isRole` | Role address (info@, sales@, …) |
| `isFree` | Free provider (gmail, yahoo, …) |
| `score` | Quality score 0–100 |

Results land in the Actor's **dataset** — export to CSV, JSON, or Excel, or push them straight into your next step.

## Setup (30 seconds)

1. Create a free **Verifox** account at **https://verifox.ai** (free signup includes **1,000 credits**).
2. In the dashboard go to **Settings → API keys** and copy your key.
3. Paste it into this Actor's **Verifox API key** field.

Each verification uses **one Verifox credit from your own account** — this Actor is free to run; you only pay for what you verify, at Verifox's rates. Top up anytime in the Verifox dashboard.

## Input

| Field | Required | Description |
|-------|----------|-------------|
| `emails` | ✅ | List of emails (paste, or map a field from another Actor) |
| `apiKey` | ✅ | Your Verifox API key (kept secret) |
| `concurrency` | — | Parallel verifications, 1–20 (default 5) |
| `apiBaseUrl` | — | Advanced override; leave default |

## Example use

- Clean a scraped lead list before importing to your CRM.
- Verify newsletter signups to protect sender reputation.
- Chain after a LinkedIn / directory scraper to validate captured emails.

## Notes

- Invalid/undeliverable input is still returned as a row (`ok: false` + reason) so you never silently lose an address.
- An invalid key (401/403) or empty balance (402) stops the run with a clear message.

---

Powered by [Verifox](https://verifox.ai) — real-time email verification API.
