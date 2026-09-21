#!/usr/bin/env python3
"""Score 2026 Firestore jobs into dashboard data.json + weeks.json.

Reads project breathe-easy-performance / collection jobs (existing ops
Firebase path). Writes dashboard-shaped JSON. Unsure jobs go to
scripts/exceptions.json (ops only, not published).

Auth (first match):
  --jobs PATH              local JSON dump (list or {documents: ...})
  FIRESTORE_ID_TOKEN       Bearer ID token
  FIREBASE_REFRESH_TOKEN   exchanged with the public web API key

Do not put a service account in this repo.
"""

from __future__ import annotations

import argparse
import json
import os
import re
import ssl
import subprocess
import sys
import urllib.error
import urllib.parse
import urllib.request
from collections import defaultdict
from datetime import date, datetime, timedelta
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PROJECT = "breathe-easy-performance"
COLLECTION = "jobs"
TECH_ORDER = ["Matthew", "Tiago", "Nick", "Alun", "Iggi"]
SKIP_LEADS = {"josh"}
UNIT_TYPES = ["S", "W", "B", "C", "UC", "TV", "OU", "SwG", "EF", "PAU"]
WEIGHTS = {
    "S": 1.0,
    "W": 0.85,
    "B": 1.3,
    "C": 1.8,
    "UC": 1.5,
    "TV": 1.4,
    "OU": 1.4,
    "SwG": 1.3,
    "EF": 1.0,
    "PAU": 1.0,
}
ALIASES = {
    "S": "S",
    "W": "W",
    "B": "B",
    "C": "C",
    "UC": "UC",
    "TV": "TV",
    "OU": "OU",
    "SWG": "SwG",
    "SW": "SwG",
    "EF": "EF",
    "PAU": "PAU",
    "OUTDOOR": "OU",
    "OUTDOORS": "OU",
}
TOKEN_RE = re.compile(r"(\d+(?:\.\d+)?)\s*([A-Za-z]+)")
HAS_UNIT_RE = re.compile(
    r"\d+(?:\.\d+)?\s*(?:SwG|SWG|UC|TV|OU|PAU|EF|BEP|OUTDOORS?|[SWBC])\b",
    re.I,
)
NOISE_WORDS = {
    "HALF", "PRICE", "CLEAN", "CLEANED", "CREDIT", "REFUND", "SAVE", "SAVED",
    "TOTAL", "FULL", "HOUR", "HOURS", "PM", "AM", "AS", "AND", "NEED", "ACS",
    "BEDROOM", "BEDROOMS", "TODAY", "DID", "ONLY", "FILTER", "FILTERS", "FAN",
    "FANS", "COIL", "KITCHEN", "MASTER", "LIVING", "ROOM", "ROOMS", "CANNOT",
    "CANT", "ACCESS", "FOR", "THE", "WITH", "FROM", "WILL", "COME", "BACK",
    "AFTER", "MR", "WONG", "FIXED", "BROKEN", "IS", "IN", "OF", "TO", "A",
    "PLUS", "ALL", "THERE", "TAKE", "OUT", "UNIT", "UNITS", "PER", "OFF",
    "RESCHEDULE", "RESCHEDULED", "RETURN", "RETURNS", "VISIT", "FREE",
    "INFLUENCER", "COLLAB", "DAY", "FINISHED", "G", "F", "OTHER", "BOTH",
    "DINING", "HELPER", "POOR", "INSTALLATION", "SEE", "NICK", "CHAT",
    "SUPER", "HEAVY", "PPL", "PEOPLE", "KIDS", "BABY", "TOILET", "SPACE",
    "ENOUGH", "NOT", "NO", "SO", "DIDNT", "DIDN", "REPAIR", "NEXT", "BY",
    "ON", "AT", "INTO", "TWO", "ACCOUNTS", "DIVIDED", "WINE", "CHILLERS",
    "CHILLER", "THERMAL", "AUG", "MAY", "JUN", "JUL", "SEP", "OCT", "NOV",
    "DEC", "JAN", "FEB", "MAR", "APR", "ADDRESSES", "BRAND", "NEW",
    "GRILLS", "GRILL", "REACH", "HE", "DEDUCT", "DEDCUT", "SMASH",
}
EQUIPMENT_UNKNOWN = {
    "VENTILATOR", "VENTILATIOR", "DEHUMIDIFIER", "FS", "PH", "LEAK",
    "LEAKING", "INTERVIEW", "FILMING", "BATHROOM", "TECHNICIAN",
}
LEAD_MAP = {n.lower(): n for n in TECH_ORDER}
LEAD_MAP["josh"] = "Josh"
LEAD_MAP["jut"] = "Josh"
PAREN_S_RE = re.compile(r"\(\s*S\s*\)", re.I)

POINTS_TABLE = [
    {"type": "S", "points": 1, "note": "Split — baseline"},
    {"type": "W", "points": 0.85, "note": "Window — lower density"},
    {"type": "B", "points": 1.3, "note": "Built-in"},
    {"type": "C", "points": 1.8, "note": "Cassette"},
    {"type": "UC", "points": 1.5, "note": "Under-ceiling"},
    {"type": "TV", "points": 1.4, "note": "TV-unit"},
    {"type": "OU", "points": 1.4, "note": "Outdoor unit"},
    {"type": "SwG", "points": 1.3, "note": "Split with grill"},
    {"type": "EF", "points": 1, "note": "Exhaust fan"},
    {"type": "PAU", "points": 1, "note": "PAU"},
    {"type": "R", "points": 0, "note": "Return visit — tracked, 0 points"},
]
RULES = {
    "unitAttribution": "team_lead only (helpers never credited)",
    "BEP": "never counted (free add-on)",
    "halfClean": "0.5 unit of that type",
    "halfPrice": "not a half-clean — full unit",
    "arrow": "score the last segment that still has unit tokens (what was cleaned)",
    "B": "built-in",
    "C": "cassette",
}
WEEK_COLS = [
    "week", "weekLabel", "workday", "totalUnits", "returns", "points",
    "pointsDay", "unitsDay", "S", "W", "B", "C", "UC", "TV", "OU", "SwG",
    "EF", "PAU",
]


def r1(n):
    return round(float(n) + 1e-12, 1)


def r2(n):
    return round(float(n) + 1e-12, 2)


def empty_units():
    return {k: 0.0 for k in UNIT_TYPES}


def monday_of(iso):
    y, m, d = [int(x) for x in iso.split("-")]
    dt = date(y, m, d)
    return (dt - timedelta(days=dt.weekday())).isoformat()


def week_label(monday_iso):
    dt = date.fromisoformat(monday_iso)
    return f"{dt.day:02d} {dt.strftime('%b')}"


def week_range(start_monday, end_monday):
    cur = date.fromisoformat(start_monday)
    end = date.fromisoformat(end_monday)
    out = []
    while cur <= end:
        out.append(cur.isoformat())
        cur += timedelta(days=7)
    return out


def is_crew(job):
    source = str(job.get("source") or "").strip()
    jid = str(job.get("job_id") or "").strip()
    return source == "team-day-crew" or jid.startswith("crew-")


def units_dict_counts(job):
    units = job.get("units")
    if not isinstance(units, dict):
        return None
    counts = empty_units()
    for k, v in units.items():
        typ = canonical_type(str(k))
        if typ and typ != "BEP":
            try:
                add_unit(counts, typ, float(v or 0))
            except (TypeError, ValueError):
                continue
    return counts if any(counts.values()) else None


def is_empty_acs(job):
    acs = job.get("acs")
    return acs is None or str(acs).strip() == ""


def is_return(job):
    if job.get("is_return") is True:
        return True
    if str(job.get("job_type") or "").strip().lower() == "return":
        return True
    return is_empty_acs(job) and units_dict_counts(job) is None


def job_date(job):
    raw = str(job.get("date") or "").strip()
    if re.match(r"^\d{4}-\d{2}-\d{2}$", raw):
        return raw
    return ""


def firestore_value(v):
    if not isinstance(v, dict):
        return v
    if "stringValue" in v:
        return v["stringValue"]
    if "integerValue" in v:
        return int(v["integerValue"])
    if "doubleValue" in v:
        return float(v["doubleValue"])
    if "booleanValue" in v:
        return v["booleanValue"]
    if "nullValue" in v:
        return None
    if "timestampValue" in v:
        return v["timestampValue"]
    if "arrayValue" in v:
        return [firestore_value(x) for x in (v["arrayValue"].get("values") or [])]
    if "mapValue" in v:
        fields = v["mapValue"].get("fields") or {}
        return {k: firestore_value(val) for k, val in fields.items()}
    return v


def docs_to_jobs(payload):
    if isinstance(payload, list):
        return payload
    if isinstance(payload, dict) and isinstance(payload.get("jobs"), list):
        return payload["jobs"]
    docs = []
    if isinstance(payload, dict) and "documents" in payload:
        docs = payload["documents"] or []
    jobs = []
    for doc in docs:
        if not isinstance(doc, dict):
            continue
        fields = doc.get("fields") or {}
        job = {k: firestore_value(val) for k, val in fields.items()}
        job["job_id"] = job.get("job_id") or str(doc.get("name") or "").split("/")[-1]
        jobs.append(job)
    return jobs


def load_api_key():
    text = (ROOT / "shared" / "firebase-config.js").read_text()
    m = re.search(r"apiKey:\s*'([^']+)'", text)
    if not m:
        raise SystemExit("Could not read Firebase API key from shared/firebase-config.js")
    return m.group(1)


def http_json(url, method="GET", data=None, headers=None, timeout=60):
    headers = dict(headers or {})
    body = None
    if data is not None:
        if isinstance(data, (dict, list)):
            body = json.dumps(data).encode()
            headers.setdefault("Content-Type", "application/json")
        elif isinstance(data, str):
            body = data.encode()
        else:
            body = data
    ctx = ssl.create_default_context()
    req = urllib.request.Request(url, data=body, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, context=ctx, timeout=timeout) as resp:
            raw = resp.read()
            code = resp.status
    except urllib.error.URLError:
        cmd = ["curl", "-sS", "-X", method, url, "-o", "-", "-w", "\n%{http_code}"]
        for k, v in headers.items():
            cmd[5:5] = ["-H", f"{k}: {v}"]
        if body is not None:
            cmd.extend(["--data-binary", body.decode() if isinstance(body, bytes) else body])
        proc = subprocess.run(cmd, capture_output=True, text=True, timeout=timeout)
        if proc.returncode != 0:
            raise RuntimeError(proc.stderr.strip() or "curl failed")
        text = proc.stdout
        nl = text.rfind("\n")
        raw = text[:nl].encode()
        code = int(text[nl + 1 :])
    if code >= 400:
        raise RuntimeError(f"HTTP {code}: {raw[:400]!r}")
    return json.loads(raw.decode() if raw else "null")


def exchange_refresh_token(refresh_token):
    key = load_api_key()
    url = f"https://securetoken.googleapis.com/v1/token?key={key}"
    body = urllib.parse.urlencode(
        {"grant_type": "refresh_token", "refresh_token": refresh_token}
    )
    payload = http_json(
        url,
        method="POST",
        data=body,
        headers={"Content-Type": "application/x-www-form-urlencoded"},
    )
    token = payload.get("id_token") or payload.get("access_token")
    if not token:
        raise RuntimeError("Refresh did not return an ID token")
    return token


def fetch_firestore_jobs(id_token):
    base = (
        f"https://firestore.googleapis.com/v1/projects/{PROJECT}"
        f"/databases/(default)/documents/{COLLECTION}"
    )
    docs = []
    page_token = None
    while True:
        url = base + "?pageSize=300"
        if page_token:
            url += "&pageToken=" + urllib.parse.quote(page_token)
        payload = http_json(url, headers={"Authorization": f"Bearer {id_token}"})
        if payload.get("error"):
            raise RuntimeError(payload["error"])
        docs.extend(payload.get("documents") or [])
        page_token = payload.get("nextPageToken")
        if not page_token:
            break
    return docs_to_jobs({"documents": docs})


def canonical_type(token):
    t = token.upper()
    if t == "BEP":
        return "BEP"
    return ALIASES.get(t)


def has_unit_tokens(text):
    return bool(HAS_UNIT_RE.search(text or ""))


def last_unit_segment(acs):
    s = str(acs or "").replace("\u00a0", " ").strip()
    if not s:
        return ""
    s = re.sub(r"=\s*>", "=>", s)
    parts = re.split(r"\s*=>\s*|\s*>\s*", s)
    parts = [p.strip() for p in parts if p.strip()]
    if not parts:
        return s
    for part in reversed(parts):
        if has_unit_tokens(part) or re.search(r"half\s*clean", part, re.I):
            return part
    return parts[-1]


def strip_half_price(text):
    s = re.sub(r"\([^)]*half\s*price[^)]*\)", " ", text, flags=re.I)
    s = re.sub(r"half\s*prices?", " ", s, flags=re.I)
    return s


def add_unit(counts, typ, n):
    if typ == "BEP" or typ is None:
        return
    counts[typ] = counts.get(typ, 0.0) + float(n)


def implied_type(acs):
    found = []
    for _n, tok in TOKEN_RE.findall(acs or ""):
        typ = canonical_type(tok)
        if typ and typ != "BEP" and typ not in found:
            found.append(typ)
    return found[0] if len(found) == 1 else None


def _half_token(n, typ):
    return f" {float(n) * 0.5}{typ} "


def rewrite_half_clean(segment, original):
    """Rewrite clear half-clean phrases to decimal counts. leftover → unsure."""
    s = segment
    s = re.sub(r"\([^)]*need return[^)]*\)", " ", s, flags=re.I)
    s = re.sub(r"need return for \d+(?:\.\d+)?\s*[A-Za-z]+", " ", s, flags=re.I)

    unclean_re = re.compile(
        r"(\d+(?:\.\d+)?)\s*([A-Za-z]+)\s*(?:cannot be cleaned|can'?t clean|no access|didn'?t clean|didnt clean)",
        re.I,
    )
    m = unclean_re.search(s)
    while m:
        typ = canonical_type(m.group(2))
        n = float(m.group(1))
        prefix, suffix = s[: m.start()], s[m.end() :]
        # "+ 1B no access" is its own zero group. "(1B cannot..." restates a parent count.
        preceded_by_plus = bool(re.search(r"\+\s*$", prefix))
        if typ and typ != "BEP" and not preceded_by_plus:
            def reduce(mm, typ=typ, n=n):
                if canonical_type(mm.group(2)) != typ:
                    return mm.group(0)
                left = float(mm.group(1)) - n
                return f" {left}{typ} " if left > 0 else " "
            prefix, _k = re.subn(
                r"(\d+(?:\.\d+)?)\s*([A-Za-z]+)",
                reduce,
                prefix,
                count=1,
                flags=re.I,
            )
        s = prefix + " " + suffix
        m = unclean_re.search(s)
    s = re.sub(r"\(\s*,\s*", "(", s)

    def half_n_type(m):
        typ = canonical_type(m.group(2))
        if not typ or typ == "BEP":
            return m.group(0)
        return _half_token(m.group(1), typ)

    def split_n_m(m):
        typ = canonical_type(m.group(2))
        if not typ or typ == "BEP":
            return m.group(0)
        n, half_n = float(m.group(1)), float(m.group(3))
        return f" {max(n - half_n, 0.0)}{typ} {half_n * 0.5}{typ} "

    # N TYPE (M half clean) — 7S (5 half clean) / 7B (3 half clean)
    s = re.sub(
        r"(\d+(?:\.\d+)?)\s*([A-Za-z]+)\s*\(\s*(\d+(?:\.\d+)?)\s*half\s*clean(?:ed)?[^)]*\)?",
        split_n_m,
        s,
        flags=re.I,
    )
    # restating paren: (N TYPE half clean) converts N of TYPE already listed
    def restate_half(m):
        typ = canonical_type(m.group(2))
        if not typ or typ == "BEP":
            return m.group(0)
        n = float(m.group(1))
        pattern = rf"(\d+(?:\.\d+)?)\s*{re.escape(typ)}\b"

        def drop(mm):
            left = float(mm.group(1)) - n
            if left <= 0:
                return _half_token(n, typ)
            return f" {left}{typ} " + _half_token(n, typ)

        replaced, k = re.subn(pattern, drop, s[: m.start()] + s[m.end() :], count=1, flags=re.I)
        if k:
            return None, replaced
        return _half_token(n, typ), None

    out = []
    idx = 0
    for m in re.finditer(
        r"\(\s*(\d+(?:\.\d+)?)\s*([A-Za-z]+)\s+half\s*clean(?:ed)?[^)]*\)",
        s,
        flags=re.I,
    ):
        token, replaced = restate_half(m)
        if replaced is not None:
            s = replaced
            out = []
            idx = 0
            break
        out.append((m.start(), m.end(), token))
    else:
        if out:
            pieces = []
            last = 0
            for a, b, token in out:
                pieces.append(s[last:a])
                pieces.append(token)
                last = b
            pieces.append(s[last:])
            s = "".join(pieces)

    # N TYPE(half clean) / N TYPE (half clean ...) / N TYPE (Half)
    s = re.sub(
        r"(\d+(?:\.\d+)?)\s*([A-Za-z]+)\s*\(\s*half\s*(?:clean(?:ed)?)?[^)]*\)",
        half_n_type,
        s,
        flags=re.I,
    )
    s = re.sub(
        r"(\d+(?:\.\d+)?)\s*([A-Za-z]+)\(?\s*half\s*clean(?:ed)?\b[^)]*\)?",
        half_n_type,
        s,
        flags=re.I,
    )
    # "2B can only half clean" restates earlier 2B
    m = re.search(
        r"(\d+(?:\.\d+)?)\s*([A-Za-z]+)\s+can only half clean",
        s,
        flags=re.I,
    )
    if m:
        typ = canonical_type(m.group(2))
        n = float(m.group(1))
        if typ and typ != "BEP":
            prefix = s[: m.start()]
            suffix = s[m.end() :]

            def drop(mm):
                left = float(mm.group(1)) - n
                if left <= 0:
                    return _half_token(n, typ)
                return f" {left}{typ} " + _half_token(n, typ)

            prefix2, k = re.subn(
                rf"(\d+(?:\.\d+)?)\s*{re.escape(typ)}\b",
                drop,
                prefix,
                count=1,
                flags=re.I,
            )
            s = (prefix2 if k else prefix + _half_token(n, typ)) + suffix

    def full_plus_half(m):
        typ = implied_type(original) or implied_type(segment)
        if not typ:
            return m.group(0)
        return f" {float(m.group(1)) + float(m.group(2)) * 0.5}{typ} "

    s = re.sub(
        r"(\d+(?:\.\d+)?)\s*full(?:\s*clean)?s?\s*\+?\s*(\d+(?:\.\d+)?)\s*half\s*clean",
        full_plus_half,
        s,
        flags=re.I,
    )
    s = re.sub(
        r"(\d+(?:\.\d+)?)\s*full\s+(\d+(?:\.\d+)?)\s*half\s*clean",
        full_plus_half,
        s,
        flags=re.I,
    )

    # "both half clean" → every listed type at 0.5
    if re.search(r"both\s+half\s*clean", s, re.I):
        def halve_all(m):
            typ = canonical_type(m.group(2))
            if not typ or typ == "BEP":
                return m.group(0)
            return _half_token(m.group(1), typ)
        s = re.sub(r"(\d+(?:\.\d+)?)\s*([A-Za-z]+)", halve_all, s)
        s = re.sub(r"both\s+half\s*clean(?:ed)?", " ", s, flags=re.I)

    leftover = bool(re.search(r"half\s*clean", s, re.I))
    if leftover:
        m3 = re.search(r"(\d+(?:\.\d+)?)\s*half\s*clean(?:ed)?", s, re.I)
        typ = implied_type(original)
        if m3 and typ:
            n = float(m3.group(1))
            s = re.sub(
                r"(\d+(?:\.\d+)?)\s*half\s*clean(?:ed)?",
                _half_token(n, typ),
                s,
                count=1,
                flags=re.I,
            )
            def drop_full(mm):
                if canonical_type(mm.group(2)) != typ:
                    return mm.group(0)
                left = float(mm.group(1)) - n
                if left <= 0:
                    return " "
                return f" {left}{typ} "
            s = re.sub(rf"(\d+(?:\.\d+)?)\s*({typ})\b", drop_full, s, count=1, flags=re.I)

    leftover = bool(re.search(r"half\s*clean", s, re.I))
    return s, not leftover


def parse_plain_units(text):
    counts = empty_units()
    unknown = []
    for num, tok in TOKEN_RE.findall(text):
        typ = canonical_type(tok)
        if typ == "BEP":
            continue
        if typ:
            add_unit(counts, typ, float(num))
            continue
        word = tok.upper()
        if word in NOISE_WORDS or word in {"FULL", "HALF"} or word in EQUIPMENT_UNKNOWN:
            continue
        unknown.append(f"{num}{tok}")
    return counts, unknown


def is_team_meeting(acs):
    return bool(re.search(r"team\s*meeting", acs or "", re.I))


def is_leak_note(acs):
    return bool(re.search(r"\bleak(?:ing)?\b", acs or "", re.I))


def is_refund_note(acs):
    return bool(re.search(r"\brefunds?\b", acs or "", re.I))


def is_call_note(acs):
    return bool(re.search(r"\bcall\b", acs or "", re.I))


def parse_acs(acs):
    """Return (counts, sure, reason). sure=False → exception, not scored.

    reason "zero_skip" = 0 pts, not a workday (team meeting).
    reason "zero_day" = 0 pts, workday (leak / refund / call notes).
    """
    raw = str(acs or "").replace("\u00a0", " ").strip()
    if not raw:
        return empty_units(), True, "empty_return"
    if is_team_meeting(raw):
        return empty_units(), True, "zero_skip"
    if is_leak_note(raw):
        return empty_units(), True, "zero_day"
    if is_refund_note(raw) and not has_unit_tokens(raw) and not PAREN_S_RE.search(raw):
        return empty_units(), True, "zero_day"
    if is_call_note(raw) and not has_unit_tokens(raw) and not PAREN_S_RE.search(raw):
        return empty_units(), True, "zero_day"
    if re.fullmatch(
        r"(PH|INTERVIEW|FILMING|TECHNICIAN INTERVIEW)",
        raw,
        re.I,
    ):
        return empty_units(), False, f"non-unit ACS: {raw}"

    segment = last_unit_segment(raw)
    segment = strip_half_price(segment)
    rewritten, half_sure = rewrite_half_clean(segment, raw)
    if re.search(r"half\s*clean", segment, re.I) and not half_sure:
        return empty_units(), False, "ambiguous half-clean"

    counts, unknown = parse_plain_units(rewritten)
    if not any(counts.values()) and (PAREN_S_RE.search(raw) or PAREN_S_RE.search(rewritten)):
        add_unit(counts, "S", 1)
    if not any(counts.values()):
        if unknown:
            return empty_units(), False, f"unparsed ACS: {raw}"
        return empty_units(), False, "no countable units"
    return counts, True, ""


def units_from_job(job):
    dict_counts = units_dict_counts(job)
    if is_empty_acs(job):
        if dict_counts:
            return dict_counts, True, ""
        return empty_units(), True, "empty_return"
    return parse_acs(job.get("acs"))


def points_for(counts):
    return sum(WEIGHTS[k] * float(counts.get(k) or 0) for k in UNIT_TYPES)


def total_units(counts):
    return sum(float(counts.get(k) or 0) for k in UNIT_TYPES)


def trend_for(rows):
    active = [r for r in rows if r[2]]
    if len(active) < 6:
        return "Stable"
    last = active[-4:]
    prev = active[-8:-4]

    def pace(chunk):
        days = sum(r[2] for r in chunk)
        pts = sum(r[5] for r in chunk)
        return pts / days if days else 0.0

    a, b = pace(last), pace(prev)
    if a > b * 1.05:
        return "Improving"
    if a < b * 0.95:
        return "Declining"
    return "Stable"


def zero_row(week):
    return [week, week_label(week), 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]


def week_row(week, days, units, returns, points, type_counts):
    workday = len(days)
    if workday == 0 and units == 0 and returns == 0:
        return zero_row(week)
    pd = r2(points / workday) if workday else 0
    ud = r2(units / workday) if workday else 0
    row = [
        week,
        week_label(week),
        workday,
        r1(units),
        int(returns),
        r2(points),
        pd,
        ud,
    ]
    for k in UNIT_TYPES:
        val = type_counts.get(k) or 0.0
        row.append(r1(val) if val else 0)
    return row


def tech_record(name, rows, job_count):
    total_points = r2(sum(r[5] for r in rows))
    total_units = r1(sum(r[3] if isinstance(r[3], (int, float)) else 0 for r in rows))
    total_days = int(sum(r[2] for r in rows))
    total_returns = int(sum(r[4] for r in rows))
    unit_totals = {k: 0.0 for k in UNIT_TYPES}
    for r in rows:
        for i, k in enumerate(UNIT_TYPES):
            unit_totals[k] += float(r[8 + i] or 0)
    unit_totals = {k: r1(v) for k, v in unit_totals.items()}
    unit_totals["R"] = total_returns
    points_day = r2(total_points / total_days) if total_days else 0.0
    units_day = r2(total_units / total_days) if total_days else 0.0
    weeks_active = sum(1 for r in rows if r[2])
    return {
        "name": name,
        "totalPoints": total_points,
        "totalUnits": total_units,
        "totalDays": total_days,
        "totalReturns": total_returns,
        "totalReturnPoints": 0.0,
        "pointsDay": points_day,
        "unitsDay": units_day,
        "ownAvgPointsDay": points_day,
        "trend": trend_for(rows),
        "weeksActive": weeks_active,
        "unitTotals": unit_totals,
        "_jobs": job_count,
    }


def score_jobs(jobs, today):
    exceptions = []
    per_tech_week = {
        n: defaultdict(lambda: {
            "days": set(),
            "units": 0.0,
            "returns": 0,
            "points": 0.0,
            "types": empty_units(),
            "jobs": 0,
        })
        for n in TECH_ORDER
    }
    job_counts = {n: 0 for n in TECH_ORDER}

    for job in jobs:
        if job.get("deleted") is True or job.get("deleted") == "true":
            continue
        if is_crew(job):
            continue
        d = job_date(job)
        if not d.startswith("2026"):
            continue
        if d > today:
            continue
        lead_raw = str(job.get("team_lead") or "").strip()
        lead = LEAD_MAP.get(lead_raw.lower())
        if lead is None:
            exceptions.append({
                "job_id": job.get("job_id"),
                "date": d,
                "team_lead": lead_raw,
                "acs": job.get("acs"),
                "job_type": job.get("job_type"),
                "reason": "unknown team_lead",
            })
            continue
        if lead.lower() in SKIP_LEADS:
            continue
        if lead not in TECH_ORDER:
            continue

        if is_return(job):
            bucket = per_tech_week[lead][monday_of(d)]
            bucket["returns"] += 1
            bucket["days"].add(d)
            bucket["jobs"] += 1
            job_counts[lead] += 1
            continue

        counts, sure, reason = units_from_job(job)
        if reason == "empty_return":
            bucket = per_tech_week[lead][monday_of(d)]
            bucket["returns"] += 1
            bucket["days"].add(d)
            bucket["jobs"] += 1
            job_counts[lead] += 1
            continue
        if reason == "zero_skip":
            continue
        if reason == "zero_day":
            bucket = per_tech_week[lead][monday_of(d)]
            bucket["days"].add(d)
            bucket["jobs"] += 1
            job_counts[lead] += 1
            continue
        if not sure:
            exceptions.append({
                "job_id": job.get("job_id"),
                "date": d,
                "team_lead": lead,
                "acs": job.get("acs"),
                "job_type": job.get("job_type"),
                "reason": reason,
            })
            continue

        pts = points_for(counts)
        units = total_units(counts)
        bucket = per_tech_week[lead][monday_of(d)]
        bucket["points"] += pts
        bucket["units"] += units
        bucket["days"].add(d)
        bucket["jobs"] += 1
        job_counts[lead] += 1
        for k in UNIT_TYPES:
            bucket["types"][k] += counts.get(k) or 0.0

    start = "2026-01-05"
    last_job_monday = start
    for name in TECH_ORDER:
        if per_tech_week[name]:
            last_job_monday = max(last_job_monday, max(per_tech_week[name]))
    end = max(monday_of(today), last_job_monday)
    weeks = week_range(start, end)

    weeks_out = {"_cols": WEEK_COLS}
    technicians = {}
    for name in TECH_ORDER:
        rows = []
        for week in weeks:
            b = per_tech_week[name].get(week)
            if not b:
                rows.append(zero_row(week))
                continue
            rows.append(week_row(
                week, b["days"], b["units"], b["returns"], b["points"], b["types"]
            ))
        weeks_out[name] = rows
        technicians[name] = tech_record(name, rows, job_counts[name])

    ranking = sorted(
        ({k: v for k, v in technicians[n].items() if k != "_jobs"} for n in TECH_ORDER),
        key=lambda t: (-t["pointsDay"], -t["totalPoints"], t["name"]),
    )
    team_points = r2(sum(technicians[n]["totalPoints"] for n in TECH_ORDER))
    team_units = r1(sum(technicians[n]["totalUnits"] for n in TECH_ORDER))
    team_days = int(sum(technicians[n]["totalDays"] for n in TECH_ORDER))
    team_returns = int(sum(technicians[n]["totalReturns"] for n in TECH_ORDER))
    data = {
        "generated": today,
        "source": (
            "Firestore breathe-easy-performance/jobs 2026; "
            "half-clean=0.5; half-price ignored; arrow=actual cleaned; "
            "BEP=0; returns=0 pts; team_lead only"
        ),
        "cutoff": f"earned through {today}",
        "pointsTable": POINTS_TABLE,
        "rules": RULES,
        "team": {
            "totalPoints": team_points,
            "totalUnits": team_units,
            "totalDays": team_days,
            "totalReturns": team_returns,
            "avgPointsDay": r1(team_points / team_days) if team_days else 0.0,
        },
        "weeks": weeks,
        "weekLabels": [week_label(w) for w in weeks],
        "returnPointsWeight": 0,
        "ranking": ranking,
        "technicians": {
            n: {k: v for k, v in technicians[n].items() if k != "_jobs"}
            for n in TECH_ORDER
        },
    }
    return data, weeks_out, exceptions, job_counts


def load_jobs(args):
    if args.jobs:
        payload = json.loads(Path(args.jobs).read_text())
        return docs_to_jobs(payload)
    token = os.environ.get("FIRESTORE_ID_TOKEN") or args.id_token
    refresh = os.environ.get("FIREBASE_REFRESH_TOKEN") or args.refresh_token
    if not token and refresh:
        token = exchange_refresh_token(refresh)
    if not token:
        raise SystemExit(
            "No jobs source. Pass --jobs, FIRESTORE_ID_TOKEN, or FIREBASE_REFRESH_TOKEN."
        )
    return fetch_firestore_jobs(token)


def main(argv=None):
    p = argparse.ArgumentParser(description="Score 2026 Firestore jobs for the dashboard")
    p.add_argument("--jobs", help="Local jobs JSON instead of live Firestore")
    p.add_argument("--id-token", dest="id_token", help="Firebase ID token")
    p.add_argument("--refresh-token", dest="refresh_token", help="Firebase refresh token")
    p.add_argument(
        "--out-dir",
        default=str(ROOT / "scripts" / "out"),
        help="Directory for data.json and weeks.json",
    )
    p.add_argument(
        "--exceptions",
        default=str(ROOT / "scripts" / "exceptions.json"),
        help="Ops-only exceptions path",
    )
    p.add_argument("--today", default=date.today().isoformat())
    args = p.parse_args(argv)

    jobs = load_jobs(args)
    data, weeks, exceptions, job_counts = score_jobs(jobs, args.today)

    out_dir = Path(args.out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    data_path = out_dir / "data.json"
    weeks_path = out_dir / "weeks.json"
    data_path.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n")
    weeks_path.write_text(json.dumps(weeks, separators=(",", ":"), ensure_ascii=False) + "\n")

    exc_path = Path(args.exceptions)
    exc_path.parent.mkdir(parents=True, exist_ok=True)
    exc_doc = {
        "generated": args.today,
        "count": len(exceptions),
        "jobs": exceptions,
    }
    exc_path.write_text(json.dumps(exc_doc, indent=2) + "\n")

    print(f"jobs_in={len(jobs)}")
    print(f"exceptions={len(exceptions)}")
    print(f"wrote {data_path}")
    print(f"wrote {weeks_path}")
    print(f"wrote {exc_path}")
    print("tech\tpoints\tpts/day\tjobs\tunits\tdays\treturns")
    for name in TECH_ORDER:
        t = data["technicians"][name]
        print(
            f"{name}\t{t['totalPoints']}\t{t['pointsDay']}\t{job_counts[name]}\t"
            f"{t['totalUnits']}\t{t['totalDays']}\t{t['totalReturns']}"
        )
    team = data["team"]
    print(
        f"TEAM\t{team['totalPoints']}\t{team['avgPointsDay']}\t"
        f"{sum(job_counts.values())}\t{team['totalUnits']}\t"
        f"{team['totalDays']}\t{team['totalReturns']}"
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
