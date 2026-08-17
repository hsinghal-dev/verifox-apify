# Changelog

## 0.3.0
- Fully managed: removed the user-facing API key. Verification now runs on a
  Verifox key set by the owner as a secret env var (`VERIFOX_API_KEY`) — users
  paste only emails.
- Monetization: pay-per-event billing — each successfully verified email is
  metered via `Actor.charge('email-verified')`. Failed/unverifiable rows are free.
- Docs updated for the no-key, pay-per-result model.

## 0.2.0
- Reliability: automatic retry with backoff on rate-limits (429), transient 5xx,
  and network errors — for both realtime and bulk paths.
- Run summary written to the key-value store as `OUTPUT` (counts by verdict).
- Cleaner status messages and end-of-run summary.
- World-class README (features, output example, use cases, integrations, FAQ).

## 0.1.0
- Initial release: realtime + bulk verification, auto mode, BYO Verifox API key,
  full-field dataset output with a labelled table view.
