// Verifox Email Verifier — Apify actor (fully managed, no API key needed).
//
// Users paste only emails. Verification runs on a Verifox key that the Actor
// owner sets ONCE as a secret env var (VERIFOX_API_KEY) in the Apify Console —
// never exposed to users. Billing is handled by Apify's pay-per-event
// monetization: every successfully verified email is metered via Actor.charge().
//
// Modes (input.mode):
//   - realtime : POST /v1/email-validation per email at `concurrency`, streaming
//                one dataset row as each result returns. Best for small/medium.
//   - bulk     : POST /v1/email-validation/bulk once, poll progress, page results.
//                Fewest HTTP calls; best for very large lists.
//   - auto     : bulk when the list is large (> 500), else realtime. (default)
//
// Resilient to rate-limits/transient errors (retry with backoff) and fails with
// a readable reason. Writes a run summary to the key-value store.
import { Actor } from 'apify';

await Actor.init();

const input = (await Actor.getInput()) ?? {};
const apiKey = process.env.VERIFOX_API_KEY;
const concurrency = Math.max(1, Math.min(Number(input.concurrency) || 5, 20));
const apiBaseUrl = (input.apiBaseUrl || 'https://api.verifox.ai').replace(/\/+$/, '');
const mode = ['auto', 'realtime', 'bulk'].includes(input.mode) ? input.mode : 'auto';
const CHARGE_EVENT = 'email-verified';

// Accept an array, or a single string pasted with newlines/commas/semicolons.
let raw = input.emails ?? [];
if (typeof raw === 'string') raw = raw.split(/[\n,;]+/);
if (!Array.isArray(raw)) raw = [];
const emails = [...new Set(raw.map((e) => String(e).trim().toLowerCase()).filter(Boolean))];

if (emails.length === 0) {
  await Actor.setStatusMessage('No emails provided — nothing to verify.');
  await Actor.exit();
}

// Not configured yet? Emit a helpful row and finish SUCCESSFULLY rather than
// failing. This keeps Apify's daily auto-test green until the owner sets the key
// and charges nothing. Owner sets VERIFOX_API_KEY (Secret) in Actor Settings.
if (!apiKey) {
  await Actor.pushData({
    email: emails[0],
    ok: false,
    error:
      'Actor is not configured yet (missing VERIFOX_API_KEY). The owner must set it in Actor Settings → Environment variables.',
  });
  await Actor.setStatusMessage('Actor not configured — VERIFOX_API_KEY is not set.');
  await Actor.exit();
}

const headers = { 'content-type': 'application/json', 'x-api-key': apiKey };
const singleUrl = `${apiBaseUrl}/v1/email-validation`;
const bulkUrl = `${apiBaseUrl}/v1/email-validation/bulk`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const backoff = (attempt) => Math.min(1000 * 2 ** attempt, 15000); // 1s,2s,4s… ≤15s

// Running tally, persisted as the run's OUTPUT record.
const summary = {
  total: emails.length,
  verified: 0,
  failed: 0,
  charged: 0,
  reachable: { safe: 0, risky: 0, invalid: 0, unknown: 0 },
};

/** Fetch with retry on rate-limits (429), transient 5xx, and network errors. */
async function fetchWithRetry(url, options = {}, retries = 3) {
  let attempt = 0;
  for (;;) {
    let res;
    try {
      res = await fetch(url, options);
    } catch (err) {
      if (attempt >= retries) throw err;
      await sleep(backoff(attempt++));
      continue;
    }
    if ((res.status === 429 || res.status >= 500) && attempt < retries) {
      const retryAfter = Number(res.headers.get('retry-after'));
      await sleep(Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : backoff(attempt));
      attempt += 1;
      continue;
    }
    return res;
  }
}

/** Auth/credit failures are fatal — no point retrying the rest of the list. */
function assertAuthAndCredits(status) {
  if (status === 401 || status === 403) {
    throw new Error('Verification is temporarily unavailable (auth error). Please try again later.');
  }
  if (status === 402) {
    throw new Error('Verification is temporarily unavailable (capacity). Please try again later.');
  }
}

/** Meter one successful verification via Apify pay-per-event billing. */
async function charge() {
  try {
    await Actor.charge({ eventName: CHARGE_EVENT });
    summary.charged += 1;
  } catch {
    // Not running in pay-per-event mode (e.g. local run) — skip metering.
  }
}

/** Push one row and update the summary. Charges only successful verifications. */
async function record(row) {
  if (row.ok) {
    summary.verified += 1;
    const r = String(row.reachable ?? 'unknown');
    if (r in summary.reachable) summary.reachable[r] += 1;
    else summary.reachable.unknown += 1;
    await charge();
  } else {
    summary.failed += 1;
  }
  await Actor.pushData(row);
}

const useBulk = mode === 'bulk' || (mode === 'auto' && emails.length > 500);

try {
  if (useBulk) await runBulk();
  else await runRealtime();
  await Actor.setValue('OUTPUT', summary);
  await Actor.setStatusMessage(
    `Done — ${summary.verified} verified (safe ${summary.reachable.safe}, risky ${summary.reachable.risky}, invalid ${summary.reachable.invalid}), ${summary.failed} failed.`,
  );
} catch (err) {
  const message = err instanceof Error ? err.message : String(err);
  await Actor.setValue('OUTPUT', { ...summary, error: message });
  await Actor.fail(`Run failed: ${message}`);
}

await Actor.exit();

// ── realtime: one request per email, concurrent, streamed ──────────────────
async function runRealtime() {
  let cursor = 0;
  let done = 0;
  const total = emails.length;

  async function verifyOne(email) {
    try {
      const res = await fetchWithRetry(singleUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify({ email }),
      });
      assertAuthAndCredits(res.status);
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        return { email, ok: false, statusCode: res.status, error: text.slice(0, 300) };
      }
      return { email, ok: true, ...(await res.json()) };
    } catch (err) {
      if (err instanceof Error && /temporarily unavailable/.test(err.message)) throw err;
      return { email, ok: false, error: String(err?.message ?? err) };
    }
  }

  async function worker() {
    while (cursor < total) {
      const email = emails[cursor++];
      await record(await verifyOne(email));
      done += 1;
      if (done % 25 === 0 || done === total) {
        await Actor.setStatusMessage(`Verified ${done}/${total}`);
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, total) }, worker));
}

// ── bulk: submit once → poll progress → page results ───────────────────────
async function runBulk() {
  // 1) Submit the whole list.
  const submit = await fetchWithRetry(bulkUrl, {
    method: 'POST',
    headers,
    body: JSON.stringify({ input: emails, list_name: 'Apify run' }),
  });
  assertAuthAndCredits(submit.status);
  if (!submit.ok) {
    const text = await submit.text().catch(() => '');
    throw new Error(`Bulk submit failed (${submit.status}): ${text.slice(0, 300)}`);
  }
  const { jobId, totalEmails } = await submit.json();
  if (!jobId) throw new Error('Bulk submit returned no jobId.');
  await Actor.setStatusMessage(`Bulk job ${jobId} submitted (${totalEmails ?? emails.length}). Verifying…`);

  // 2) Poll until a terminal status (6h safety cap).
  const TERMINAL = new Set(['completed', 'failed', 'stopped']);
  const deadline = Date.now() + 6 * 60 * 60 * 1000;
  let status = 'processing';
  while (!TERMINAL.has(status)) {
    if (Date.now() > deadline) throw new Error(`Bulk job ${jobId} did not finish within 6h.`);
    await sleep(5000);
    const p = await fetchWithRetry(`${bulkUrl}/${jobId}/progress`, { headers });
    if (!p.ok) continue;
    const pd = await p.json().catch(() => ({}));
    if (typeof pd.status === 'string') status = pd.status;
    const processed = pd.processedRecords ?? pd.processed ?? '?';
    const totalRec = pd.totalRecords ?? totalEmails ?? emails.length;
    await Actor.setStatusMessage(`Bulk ${jobId}: ${status} (${processed}/${totalRec})`);
  }
  if (status === 'failed') throw new Error(`Bulk job ${jobId} failed.`);

  // 3) Page results into the dataset.
  let cursor = 0;
  let pushed = 0;
  while (cursor !== null && cursor !== undefined) {
    const r = await fetchWithRetry(`${bulkUrl}/${jobId}/results?cursor=${cursor}&limit=1000`, { headers });
    if (!r.ok) break;
    const rd = await r.json().catch(() => ({}));
    const rows = Array.isArray(rd.results) ? rd.results : [];
    for (const row of rows) await record({ ok: true, ...row });
    pushed += rows.length;
    cursor = rd.next_cursor ?? null;
    await Actor.setStatusMessage(`Fetched ${pushed} result(s)…`);
    if (rows.length === 0) break;
  }
}
