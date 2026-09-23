/**
 * HubSpot → Firestore contacts webhook.
 * POST /.netlify/functions/hubspot-contact
 *
 * Env (Netlify UI, never git):
 *   HUBSPOT_CLIENT_SECRET      HubSpot app client secret (signature v3)
 *   HUBSPOT_ACCESS_TOKEN       private app token, single-contact GET only
 *   FIREBASE_WEBHOOK_EMAIL     Firebase Auth email (webhook@breathe-easyhk.com)
 *   FIREBASE_WEBHOOK_PASSWORD  Firebase Auth password
 */

import crypto from 'node:crypto';
import { FIREBASE_CONFIG } from '../../shared/firebase-config.js';
import {
  HUBSPOT_PROPERTY_MAP,
  HUBSPOT_PROPERTY_NAMES,
  mapHubSpotValue,
  mappedFieldsFromHubSpotProperties,
} from '../../shared/contact.js';

const HANDLED = new Set(['contact.creation', 'contact.deletion', 'contact.propertyChange']);
const FIVE_MIN = 5 * 60 * 1000;
const HS_CONTACT = 'https://api.hubapi.com/crm/v3/objects/contacts';
const SIGN_IN_URL = 'https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=';

let cachedAuth = { idToken: '', exp: 0 };

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

function slashVariants(uri) {
  const s = String(uri || '');
  if (!s) return [];
  if (s.endsWith('/')) return [s, s.replace(/\/+$/, '')];
  return [s, s + '/'];
}

function uriCandidates(event) {
  const set = new Set();
  slashVariants(event.rawUrl).forEach((u) => set.add(u));
  const host = header(event, 'host');
  const path = event.path || '/.netlify/functions/hubspot-contact';
  slashVariants('https://' + host + path).forEach((u) => set.add(u));
  return [...set];
}

function equalBuf(a, b) {
  const left = Buffer.from(String(a || ''));
  const right = Buffer.from(String(b || ''));
  if (!left.length || left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
}

function sha256Hex(s) {
  return crypto.createHash('sha256').update(s, 'utf8').digest('hex');
}

export function verifyHubSpotSignature(event, secret, now = Date.now()) {
  if (!secret) return false;
  const timestamp = header(event, 'x-hubspot-request-timestamp');
  if (timestamp) {
    const ts = Number(timestamp);
    if (!Number.isFinite(ts) || Math.abs(now - ts) > FIVE_MIN) return false;
  }
  const body = rawBody(event);
  const method = String(event.httpMethod || 'POST').toUpperCase();
  const v3 = header(event, 'x-hubspot-signature-v3').replace(/ /g, '+');
  const v12 = header(event, 'x-hubspot-signature');
  if (v3) {
    for (const uri of uriCandidates(event)) {
      const signed = method + uri + body + (timestamp || '');
      const expected = crypto.createHmac('sha256', secret).update(signed, 'utf8').digest('base64');
      if (equalBuf(v3, expected)) return true;
    }
  }
  if (v12) {
    const hex = String(v12).toLowerCase();
    if (equalBuf(hex, sha256Hex(secret + body))) return true;
    for (const uri of uriCandidates(event)) {
      if (equalBuf(hex, sha256Hex(secret + method + uri + body + (timestamp || '')))) return true;
      if (equalBuf(hex, sha256Hex(secret + method + uri + body))) return true;
    }
  }
  return false;
}

async function firebaseIdToken() {
  if (cachedAuth.idToken && Date.now() < cachedAuth.exp - 30000) return cachedAuth.idToken;
  const email = process.env.FIREBASE_WEBHOOK_EMAIL;
  const password = process.env.FIREBASE_WEBHOOK_PASSWORD;
  if (!email || !password) throw new Error('FIREBASE_WEBHOOK_EMAIL or FIREBASE_WEBHOOK_PASSWORD is not set');
  const res = await fetch(SIGN_IN_URL + encodeURIComponent(FIREBASE_CONFIG.apiKey), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, returnSecureToken: true }),
  });
  const json = await res.json();
  if (!res.ok || !json.idToken) {
    const msg = json && json.error && json.error.message
      ? String(json.error.message)
      : 'Firebase Auth sign-in failed';
    throw new Error(msg);
  }
  const ttl = Number(json.expiresIn || 3600) * 1000;
  cachedAuth = { idToken: json.idToken, exp: Date.now() + ttl };
  return cachedAuth.idToken;
}

function firestoreUrl(id) {
  const doc = encodeURIComponent(String(id));
  return `https://firestore.googleapis.com/v1/projects/${FIREBASE_CONFIG.projectId}/databases/(default)/documents/contacts/${doc}`;
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

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function firestoreError(method, status) {
  const err = new Error('Firestore ' + method + ' ' + status);
  if (status === 429) err.statusCode = 503;
  return err;
}

async function fsRequest(method, id, payload, mask, opts) {
  const token = await firebaseIdToken();
  const query = [];
  if (mask && mask.length) {
    mask.forEach((f) => query.push('updateMask.fieldPaths=' + encodeURIComponent(f)));
  }
  if (opts && opts.mustExist) query.push('currentDocument.exists=true');
  const url = firestoreUrl(id) + (query.length ? '?' + query.join('&') : '');
  async function once() {
    return fetch(url, {
      method,
      headers: {
        Authorization: 'Bearer ' + token,
        'Content-Type': 'application/json',
      },
      body: payload ? JSON.stringify(payload) : undefined,
    });
  }
  let res = await once();
  if (method === 'PATCH' && res.status === 429) {
    await sleep(1000);
    res = await once();
    if (res.status === 429) throw firestoreError('PATCH', 429);
  }
  if (method === 'DELETE' && res.status === 404) return { missing: true };
  if (opts && opts.mustExist && res.status === 404) return { missing: true };
  if (!res.ok) throw firestoreError(method, res.status);
  if (method === 'DELETE') return { ok: true };
  return res.json();
}

async function mergeContact(id, fields, opts) {
  const data = { hubspot_id: String(id), ...fields };
  const mask = Object.keys(data);
  return fsRequest('PATCH', id, encodeFields(data), mask, opts);
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

export async function handleHubSpotEvents(events) {
  const list = Array.isArray(events) ? events : events ? [events] : [];
  let handled = 0;
  for (const ev of list) {
    const type = ev && ev.subscriptionType;
    if (!HANDLED.has(type)) continue;
    const id = String(ev.objectId || '');
    if (!id) continue;
    if (type === 'contact.creation') {
      await mergeContact(id, {});
      handled += 1;
      continue;
    }
    if (type === 'contact.deletion') {
      await fsRequest('DELETE', id);
      handled += 1;
      continue;
    }
    const hsName = ev.propertyName;
    if (!HUBSPOT_PROPERTY_MAP[hsName]) continue;
    const field = HUBSPOT_PROPERTY_MAP[hsName];
    const value = mapHubSpotValue(hsName, ev.propertyValue);
    const patched = await mergeContact(id, { [field]: value }, { mustExist: true });
    if (patched && patched.missing) {
      const props = await getHubSpotContact(id);
      const fields = props ? mappedFieldsFromHubSpotProperties(props) : {};
      fields[field] = value;
      await mergeContact(id, fields);
    }
    handled += 1;
  }
  return handled;
}

export async function handler(event) {
  if ((event.httpMethod || '').toUpperCase() !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }
  const secret = process.env.HUBSPOT_CLIENT_SECRET;
  if (!verifyHubSpotSignature(event, secret)) {
    return { statusCode: 401, body: 'Unauthorized' };
  }
  let payload;
  try {
    payload = JSON.parse(rawBody(event) || '[]');
  } catch {
    return { statusCode: 400, body: 'Invalid JSON' };
  }
  try {
    const handled = await handleHubSpotEvents(payload);
    return { statusCode: 200, body: JSON.stringify({ ok: true, handled }) };
  } catch (err) {
    const message = String((err && err.message) || 'Error');
    console.error(message);
    const status = err && err.statusCode === 503 ? 503 : 500;
    return {
      statusCode: status,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ok: false, error: message }),
    };
  }
}
