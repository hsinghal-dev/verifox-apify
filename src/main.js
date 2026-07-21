// Verifox Email Verifier — Apify actor (bring-your-own Verifox API key).
//
// Two paths, selected by `mode`:
//   - realtime: POST /v1/email-validation per email at `concurrency`, streaming
//     one dataset row as each result comes back. Best for small/medium lists.
//   - bulk: POST /v1/email-validation/bulk once, poll progress, then page the
//     results into the dataset. Fewer HTTP calls; best for very large lists.
//   - auto (default): bulk when the list is large (> 500), else realtime.
//
// Either way it runs on the CALLER'S Verifox credits (their API key) — no
// shared key, no cost to Verifox.
import { Actor } from 'apify';

await Actor.init();

const input = (await Actor.getInput()) ?? {};
const apiKey = input.apiKey;
const concurrency = Math.max(1, Math.min(Number(input.concurrency) || 5, 20));
const apiBaseUrl = (input.apiBaseUrl || 'https://api.verifox.ai').replace(/\/+$/, '');
const mode = ['auto', 'realtime', 'bulk'].includes(input.mode) ? input.mode : 'auto';

if (!apiKey) {
  throw new Error(
    'Missing "Verifox API key". Create one in the Verifox dashboard (Settings → API keys) at https://verifox.ai.',
  );
}

// Accept an array, or a single string pasted with newlines/commas/semicolons.
let raw = input.emails ?? [];
if (typeof raw === 'string') raw = raw.split(/[\n,;]+/);
if (!Array.isArray(raw)) raw = [];
const emails = [
  ...new Set(raw.map((e) => String(e).trim().toLowerCase()).filter(Boolean)),
];

if (emails.length === 0) {
  await Actor.setStatusMessage('No emails provided — nothing to verify.');
  await Actor.exit();
}

const headers = { 'content-type': 'application/json', 'x-api-key': apiKey };
const singleUrl = `${apiBaseUrl}/v1/email-validation`;
const bulkUrl = `${apiBaseUrl}/v1/email-validation/bulk`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Turn common Verifox HTTP failures into clear, fatal errors. */
function assertAuthAndCredits(status) {
  if (status === 401 || status === 403) {
    throw new Error('Verifox rejected the API key (401/403). Check the key is valid and active.');
  }
  if (status === 402) {
    throw new Error('Out of Verifox credits (402). Top up in the Verifox dashboard.');
  }
}

const useBulk = mode === 'bulk' || (mode === 'auto' && emails.length > 500);

if (useBulk) {
  await runBulk();
} else {
  await runRealtime();
}

await Actor.exit();

// ── realtime: one request per email, concurrent, streamed ──────────────────
async function runRealtime() {
  let cursor = 0;
  let done = 0;
  const total = emails.length;

  async function verifyOne(email) {
    try {
      const res = await fetch(singleUrl, {
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
      if (err instanceof Error && /API key|credits/.test(err.message)) throw err;
      return { email, ok: false, error: String(err?.message ?? err) };
    }
  }

  async function worker() {
    while (cursor < total) {
      const email = emails[cursor++];
      await Actor.pushData(await verifyOne(email));
      done += 1;
      if (done % 25 === 0 || done === total) {
        await Actor.setStatusMessage(`Verified ${done}/${total}`);
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, total) }, worker));
  await Actor.setStatusMessage(`Done — verified ${done} email(s).`);
}

// ── bulk: submit once → poll progress → page results ───────────────────────
async function runBulk() {
  // 1) Submit the whole list.
  const submit = await fetch(bulkUrl, {
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

  // 2) Poll until a terminal status (cap the wait as a safety net).
  const TERMINAL = new Set(['completed', 'failed', 'stopped']);
  const deadline = Date.now() + 6 * 60 * 60 * 1000; // 6h hard cap
  let status = 'processing';
  while (!TERMINAL.has(status)) {
    if (Date.now() > deadline) throw new Error(`Bulk job ${jobId} did not finish within 6h.`);
    await sleep(5000);
    const p = await fetch(`${bulkUrl}/${jobId}/progress`, { headers });
    if (!p.ok) continue; // transient — keep polling
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
    const r = await fetch(`${bulkUrl}/${jobId}/results?cursor=${cursor}&limit=1000`, { headers });
    if (!r.ok) break;
    const rd = await r.json().catch(() => ({}));
    const rows = Array.isArray(rd.results) ? rd.results : [];
    for (const row of rows) await Actor.pushData({ ok: true, ...row });
    pushed += rows.length;
    cursor = rd.next_cursor ?? null;
    await Actor.setStatusMessage(`Fetched ${pushed} result(s)…`);
    if (rows.length === 0) break;
  }
  await Actor.setStatusMessage(`Done — ${pushed} result(s) from bulk job ${jobId}.`);
}
