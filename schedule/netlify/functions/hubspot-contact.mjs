/**
 * HubSpot → Firestore contacts webhook.
 * POST /.netlify/functions/hubspot-contact
 *
 * Env (Netlify UI, never git):
 *   HUBSPOT_CLIENT_SECRET     HubSpot app client secret (signature v3)
 *   HUBSPOT_ACCESS_TOKEN      private app token, single-contact GET only
 *   FIREBASE_SERVICE_ACCOUNT  JSON service account (Firebase Admin credentials)
 */

import crypto from 'node:crypto';
import {
  HUBSPOT_PROPERTY_MAP,
  HUBSPOT_PROPERTY_NAMES,
  mapHubSpotValue,
  mappedFieldsFromHubSpotProperties,
} from '../../shared/contact.js';

const HANDLED = new Set(['contact.creation', 'contact.deletion', 'contact.propertyChange']);
const FIVE_MIN = 5 * 60 * 1000;
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const HS_CONTACT = 'https://api.hubapi.com/crm/v3/objects/contacts';

let cachedToken = { access: '', exp: 0 };

function header(event, name) {
  const headers = event.headers || {};
  const want = name.toLowerCase();
  const key = Object.keys(headers).find((k) => k.toLowerCase() === want);
  return key ? headers[key] : '';
}

function rawBody(event) {
  const body = event.body;
  if (body == null) return '';
  if (event.isBase64Encoded) return Buffer.from(body, 'base64').toString('utf8');
  return typeof body === 'string' ? body : JSON.stringify(body);
}

function requestUri(event) {
  if (event.rawUrl) return event.rawUrl;
  const proto = header(event, 'x-forwarded-proto') || 'https';
  const host = header(event, 'host');
  const path = event.path || '/.netlify/functions/hubspot-contact';
  const qs = event.rawQuery ? `?${event.rawQuery}` : '';
  return `${proto}://${host}${path}${qs}`;
}

export function verifyHubSpotSignatureV3(event, secret, now = Date.now()) {
  if (!secret) return false;
  const signature = header(event, 'x-hubspot-signature-v3');
  const timestamp = header(event, 'x-hubspot-request-timestamp');
  if (!signature || !timestamp) return false;
  const ts = Number(timestamp);
  if (!Number.isFinite(ts) || Math.abs(now - ts) > FIVE_MIN) return false;
  const method = String(event.httpMethod || 'POST').toUpperCase();
  const signed = method + requestUri(event) + rawBody(event) + timestamp;
  const expected = crypto.createHmac('sha256', secret).update(signed, 'utf8').digest('base64');
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

function parseServiceAccount() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) throw new Error('FIREBASE_SERVICE_ACCOUNT is not set');
  const sa = JSON.parse(raw);
  if (!sa.project_id || !sa.client_email || !sa.private_key) {
    throw new Error('FIREBASE_SERVICE_ACCOUNT is missing project_id, client_email, or private_key');
  }
  return sa;
}

function signJwt(sa) {
  const now = Math.floor(Date.now() / 1000);
  const headerJson = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url');
  const claim = Buffer.from(JSON.stringify({
    iss: sa.client_email,
    sub: sa.client_email,
    aud: TOKEN_URL,
    iat: now,
    exp: now + 3600,
    scope: 'https://www.googleapis.com/auth/datastore',
  })).toString('base64url');
  const unsigned = `${headerJson}.${claim}`;
  const key = String(sa.private_key).replace(/\\n/g, '\n');
  const sig = crypto.createSign('RSA-SHA256').update(unsigned).sign(key, 'base64url');
  return `${unsigned}.${sig}`;
}

async function accessToken(sa) {
  if (cachedToken.access && Date.now() < cachedToken.exp - 30000) return cachedToken.access;
  const assertion = signJwt(sa);
  const body = new URLSearchParams({
    grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
    assertion,
  });
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  const json = await res.json();
  if (!res.ok || !json.access_token) {
    throw new Error('Firebase token exchange failed');
  }
  cachedToken = {
    access: json.access_token,
    exp: Date.now() + Number(json.expires_in || 3600) * 1000,
  };
  return cachedToken.access;
}

function firestoreUrl(sa, id) {
  const doc = encodeURIComponent(String(id));
  return `https://firestore.googleapis.com/v1/projects/${sa.project_id}/databases/(default)/documents/contacts/${doc}`;
}

function encodeValue(value) {
  if (value == null) return { nullValue: null };
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Number.isInteger(value) ? { integerValue: String(value) } : { doubleValue: value };
  }
  return { stringValue: String(value) };
}

function encodeFields(obj) {
  const fields = {};
  Object.keys(obj).forEach((key) => {
    fields[key] = encodeValue(obj[key]);
  });
  return { fields };
}

async function fsRequest(sa, method, id, payload, mask) {
  const token = await accessToken(sa);
  let url = firestoreUrl(sa, id);
  if (mask && mask.length) {
    url += '?' + mask.map((f) => 'updateMask.fieldPaths=' + encodeURIComponent(f)).join('&');
  }
  const res = await fetch(url, {
    method,
    headers: {
      Authorization: 'Bearer ' + token,
      'Content-Type': 'application/json',
    },
    body: payload ? JSON.stringify(payload) : undefined,
  });
  if ((method === 'GET' || method === 'DELETE') && res.status === 404) return { missing: true };
  if (!res.ok) {
    throw new Error('Firestore ' + method + ' ' + res.status);
  }
  if (method === 'DELETE') return { ok: true };
  return res.json();
}

async function docExists(sa, id) {
  const got = await fsRequest(sa, 'GET', id);
  return !got.missing;
}

async function mergeContact(sa, id, fields) {
  const data = { hubspot_id: String(id), ...fields };
  const mask = Object.keys(data);
  await fsRequest(sa, 'PATCH', id, encodeFields(data), mask);
}

async function getHubSpotContact(id) {
  const token = process.env.HUBSPOT_ACCESS_TOKEN;
  if (!token) throw new Error('HUBSPOT_ACCESS_TOKEN is not set');
  const props = HUBSPOT_PROPERTY_NAMES.join(',');
  const url = `${HS_CONTACT}/${encodeURIComponent(id)}?properties=${encodeURIComponent(props)}`;
  const res = await fetch(url, { headers: { Authorization: 'Bearer ' + token } });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error('HubSpot GET ' + res.status);
  const json = await res.json();
  return json.properties || {};
}

export async function handleHubSpotEvents(events, sa) {
  const list = Array.isArray(events) ? events : events ? [events] : [];
  let handled = 0;
  for (const ev of list) {
    const type = ev && ev.subscriptionType;
    if (!HANDLED.has(type)) continue;
    const id = String(ev.objectId || '');
    if (!id) continue;
    if (type === 'contact.creation') {
      await mergeContact(sa, id, {});
      handled += 1;
      continue;
    }
    if (type === 'contact.deletion') {
      await fsRequest(sa, 'DELETE', id);
      handled += 1;
      continue;
    }
    const hsName = ev.propertyName;
    if (!HUBSPOT_PROPERTY_MAP[hsName]) continue;
    const exists = await docExists(sa, id);
    if (!exists) {
      const props = await getHubSpotContact(id);
      if (!props) continue;
      await mergeContact(sa, id, mappedFieldsFromHubSpotProperties(props));
      handled += 1;
      continue;
    }
    const field = HUBSPOT_PROPERTY_MAP[hsName];
    await mergeContact(sa, id, { [field]: mapHubSpotValue(hsName, ev.propertyValue) });
    handled += 1;
  }
  return handled;
}

export async function handler(event) {
  if ((event.httpMethod || '').toUpperCase() !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }
  const secret = process.env.HUBSPOT_CLIENT_SECRET;
  if (!verifyHubSpotSignatureV3(event, secret)) {
    return { statusCode: 401, body: 'Unauthorized' };
  }
  let payload;
  try {
    payload = JSON.parse(rawBody(event) || '[]');
  } catch {
    return { statusCode: 400, body: 'Invalid JSON' };
  }
  try {
    const sa = parseServiceAccount();
    const handled = await handleHubSpotEvents(payload, sa);
    return { statusCode: 200, body: JSON.stringify({ ok: true, handled }) };
  } catch (err) {
    console.error('hubspot-contact', err && err.message);
    return { statusCode: 500, body: 'Error' };
  }
}
