# Verifox Email Verifier ⚡

**Bulk-verify email deliverability with [Verifox](https://verifox.ai) — right inside your Apify workflows.** Drop in a list of emails (or pipe in a dataset from any scraper) and get a precise, per-email verdict: valid, reachable, disposable, role-based, free-provider, catch-all, and a **0–100 quality score**. Export to CSV, JSON, or Excel, or chain it straight into your next step.

> ✅ **No API key. No account. No setup.** Just paste your emails and run. You pay **only for emails that successfully verify** — failed and unverifiable rows are free.

---

## Why Verifox

- **Real SMTP checks**, not just syntax/MX guessing — actual mailbox reachability.
- **Catch-all deep check** — resolves accept-all Gmail/Microsoft domains to a real `safe`/`invalid` verdict instead of leaving them `risky`.
- **Disposable & role detection** so you don't ship to traps or temp-mail.
- **0–100 quality score** to rank and threshold leads at a glance.
- **Fast at scale** — realtime concurrency for small lists, a true bulk pipeline for large ones (up to 100k).
- **Reliable** — automatic retry/backoff on rate-limits and transient errors; nothing silently dropped.

## What you get per email

| Field | Meaning |
|-------|---------|
| `email` | The address checked |
| `reachable` | `safe` · `risky` · `invalid` · `unknown` — deliverability verdict |
| `isValid` | Passes syntax + MX + SMTP |
| `score` | Quality score **0–100** |
| `syntax` | Valid address format |
| `smtp` | SMTP detail: `hostExists`, `deliverable`, `catchAll`, `fullInbox`, `disabled` |
| `isDisposable` | Throwaway / temp-mail provider |
| `isRole` | Role address (`info@`, `sales@`, …) |
| `isFree` | Free provider (gmail, yahoo, …) |
| `hasGravatar` | Address has a Gravatar profile |
| `suggestion` | Typo fix (e.g. `gmial.com` → `gmail.com`), or `null` |
| `domain` · `source` · `verifiedAt` | Domain, result source, ISO timestamp |
| `ok` · `error` | `false` + reason if a single address couldn't be checked |

A **run summary** (counts by verdict) is also written to the key-value store as `OUTPUT`.

## Modes

| Mode | How it works | Best for |
|------|--------------|----------|
| **Auto** (default) | Picks per list size — bulk above 500, else realtime | Most runs |
| **Realtime** | One request per email, parallel (`concurrency`), streamed as they finish | Small/medium lists, live progress |
| **Bulk** | Submits the whole list to the Verifox bulk API, polls to completion, collects results | Large lists (up to 100k), fewest calls |

## Setup (10 seconds)

1. Paste (or map in) your list of emails.
2. Run. That's it — no API key, no account, no configuration.

## Pricing

**Pay per result: $0.002 per successfully verified email.** Emails that fail or can't be verified cost nothing. Apify's usual platform compute applies on top.

## Input

| Field | Required | Description |
|-------|----------|-------------|
| `emails` | ✅ | List of emails (paste, or map a field from another Actor) |
| `mode` | — | `auto` (default) · `realtime` · `bulk` |
| `concurrency` | — | Parallel verifications in realtime mode, 1–20 (default 5) |
| `apiBaseUrl` | — | Advanced override; leave default |

## Example output

```json
{
  "email": "support@stripe.com",
  "reachable": "safe",
  "isValid": true,
  "score": 98,
  "syntax": true,
  "smtp": { "hostExists": true, "deliverable": true, "catchAll": false, "fullInbox": false, "disabled": false },
  "isDisposable": false,
  "isRole": true,
  "isFree": false,
  "hasGravatar": false,
  "suggestion": null,
  "domain": "stripe.com",
  "verifiedAt": "2026-07-21T12:00:00.000Z",
  "ok": true
}
```

## Use cases

- **Clean scraped leads** before importing to your CRM or outreach tool.
- **Protect sender reputation** — drop invalid/disposable/catch-all before a campaign.
- **Chain after any scraper** (LinkedIn, directories, maps) to validate captured emails.
- **Score & segment** leads by the 0–100 quality score.

## Integrate

- **Pipe from another Actor:** map its dataset's email field into this Actor's `emails` input.
- **Automate:** schedule runs, or trigger via the Apify API / webhooks and read the dataset downstream.
- **Export:** CSV / JSON / Excel from the run's dataset, or pull it via the Apify API.

## FAQ

**Do I need a Verifox account or API key?** No. Verification is fully managed — just paste emails and run.
**What does a run cost?** $0.002 per successfully verified email + Apify's usual platform compute. Failed rows are free.
**How big a list can it handle?** Up to 100k in bulk mode.
**What if an address can't be checked?** You still get a row with `ok: false` and the reason — nothing is dropped, and you're not charged for it.

---

Powered by **[Verifox](https://verifox.ai)** — real-time email verification API. Licensed under [MIT](./LICENSE).
