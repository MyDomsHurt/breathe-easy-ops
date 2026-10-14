/**
 * POST /.netlify/functions/van-discord
 * Reads DISCORD_VAN_WEBHOOK from Netlify env (never git) and posts content.
 */

function json(status, body) {
  return {
    statusCode: status,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  };
}

function rawBody(event) {
  const body = event && event.body;
  if (body == null) return '';
  if (event.isBase64Encoded) return Buffer.from(body, 'base64').toString('utf8');
  return typeof body === 'string' ? body : JSON.stringify(body);
}

export function readVanContent(raw) {
  const s = String(raw == null ? '' : raw);
  if (!s.trim()) return '';
  try {
    const parsed = JSON.parse(s);
    if (parsed && parsed.content != null) return String(parsed.content);
    if (parsed && parsed.text != null) return String(parsed.text);
  } catch (err) {}
  return s;
}

export async function handler(event) {
  if ((event && event.httpMethod) === 'OPTIONS') {
    return { statusCode: 204 };
  }
  if ((event && event.httpMethod) !== 'POST') {
    return json(405, { ok: false, error: 'POST only' });
  }
  const webhook = process.env.DISCORD_VAN_WEBHOOK;
  if (!webhook) return json(500, { ok: false, error: 'DISCORD_VAN_WEBHOOK not set' });
  let content = readVanContent(rawBody(event)).trim();
  if (!content) return json(400, { ok: false, error: 'content required' });
  if (content.length > 2000) content = content.slice(0, 2000);
  const res = await fetch(webhook, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content }),
  });
  if (!res.ok) return json(502, { ok: false, error: 'Discord post failed' });
  return json(200, { ok: true });
}
