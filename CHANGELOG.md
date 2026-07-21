# Changelog

## 0.1.0
- Initial release.
- Realtime verification (one request per email, configurable concurrency).
- Bulk verification via the Verifox bulk API (submit → poll → paginate).
- `auto` mode picks realtime vs bulk by list size.
- Bring-your-own Verifox API key; runs on the caller's credits.
- Dataset output view with labelled columns.
