# Verifox Email Verifier

Bulk-verify email deliverability with **[Verifox](https://verifox.ai)** — right inside your Apify workflows. Feed it a list of emails (or pipe in a dataset from any scraper) and get a clean, per-email verdict: is it valid, reachable, disposable, role-based, free-provider, and how good is it (0–100 score).

> **Bring your own key.** This Actor is **free to run** — verifications go through *your* Verifox account and use *your* credits. Free Verifox signup includes **1,000 credits**.

## What you get per email

| Field | Meaning |
|-------|---------|
| `email` | The address checked |
| `reachable` | `safe` / `risky` / `invalid` / `unknown` — deliverability verdict |
| `isValid` | Passes syntax + MX + SMTP checks |
| `score` | Quality score 0–100 |
| `syntax` | Valid address format |
| `smtp` | SMTP detail object: `hostExists`, `deliverable`, `catchAll`, `fullInbox`, `disabled` |
| `isDisposable` | Throwaway/temp-mail provider |
| `isRole` | Role address (info@, sales@, …) |
| `isFree` | Free provider (gmail, yahoo, …) |
| `hasGravatar` | Address has a Gravatar profile |
| `suggestion` | Typo fix suggestion (e.g. `gmial.com` → `gmail.com`), or `null` |
| `domain` | Domain part of the address |
| `source` | How the result was produced |
| `verifiedAt` | ISO timestamp of the check |
| `ok` / `error` | `false` + reason if a single address couldn't be checked |

Results land in the Actor's **dataset** — export to CSV, JSON, or Excel, or push them straight into your next step.

## Setup (30 seconds)

1. Create a free **Verifox** account at **https://verifox.ai** (free signup includes **1,000 credits**).
2. Open **[https://verifox.ai/dashboard/api](https://verifox.ai/dashboard/api)** and create an API key.
3. Paste it into this Actor's **Verifox API key** field.

Each verification uses **one Verifox credit from your own account**. Top up anytime in the Verifox dashboard.

## Modes

| Mode | How it works | Best for |
|------|--------------|----------|
| **Auto** (default) | Picks per list size — bulk when > 500 emails, else realtime | Most runs |
| **Realtime** | One request per email, run in parallel (`concurrency`), streamed to the dataset as they finish | Small/medium lists, live progress |
| **Bulk** | Submits the whole list to the Verifox bulk API, polls to completion, then collects results | Very large lists (up to 100k), fewest HTTP calls |

## Input

| Field | Required | Description |
|-------|----------|-------------|
| `emails` | ✅ | List of emails (paste, or map a field from another Actor) |
| `apiKey` | ✅ | Your Verifox API key (kept secret) |
| `mode` | — | `auto` (default) · `realtime` · `bulk` |
| `concurrency` | — | Parallel verifications in realtime mode, 1–20 (default 5) |
| `apiBaseUrl` | — | Advanced override; leave default |

## Example uses

- Clean a scraped lead list before importing to your CRM.
- Verify newsletter signups to protect sender reputation.
- Chain after a LinkedIn / directory scraper to validate captured emails.

## Notes

- In realtime mode, invalid/undeliverable input is still returned as a row (`ok: false` + reason) so you never silently lose an address.
- An invalid key (`401`/`403`) or empty balance (`402`) stops the run with a clear message.

---

Powered by [Verifox](https://verifox.ai) — real-time email verification API. Licensed under [MIT](./LICENSE).
