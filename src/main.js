// Verifox Email Verifier — Apify actor (bring-your-own Verifox API key).
// Reads a list of emails, verifies each via the Verifox API using the caller's
// own API key (their credits), and writes one result row per email to the
// default dataset. No shared key, no cost to Verifox — pure funnel/distribution.
import { Actor } from 'apify';

await Actor.init();

const input = (await Actor.getInput()) ?? {};
const apiKey = input.apiKey;
const concurrency = Math.max(1, Math.min(Number(input.concurrency) || 5, 20));
const apiBaseUrl = (input.apiBaseUrl || 'https://api.verifox.ai').replace(/\/+$/, '');

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

const endpoint = `${apiBaseUrl}/v1/email-validation`;

async function verifyOne(email) {
  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': apiKey },
      body: JSON.stringify({ email }),
    });

    if (res.status === 401 || res.status === 403) {
      throw new Error('Verifox rejected the API key (401/403). Check the key is valid and active.');
    }
    if (res.status === 402) {
      throw new Error('Out of Verifox credits (402). Top up in the Verifox dashboard.');
    }
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      return { email, ok: false, statusCode: res.status, error: text.slice(0, 300) };
    }
    const data = await res.json();
    return { email, ok: true, ...data };
  } catch (err) {
    // Auth/credit errors are fatal — surface and stop the run.
    if (err instanceof Error && /API key|credits/.test(err.message)) throw err;
    return { email, ok: false, error: String(err?.message ?? err) };
  }
}

let cursor = 0;
let done = 0;
const total = emails.length;

async function worker() {
  while (cursor < total) {
    const email = emails[cursor++];
    const result = await verifyOne(email);
    await Actor.pushData(result);
    done += 1;
    if (done % 25 === 0 || done === total) {
      await Actor.setStatusMessage(`Verified ${done}/${total}`);
    }
  }
}

await Promise.all(Array.from({ length: Math.min(concurrency, total) }, worker));

await Actor.setStatusMessage(`Done — verified ${done} email(s).`);
await Actor.exit();
