#!/usr/bin/env python3
"""Turn the band's public Google Calendar into data/shows.json for the website.

Run by .github/workflows/calendar-sync.yml every 30 minutes. Needs: icalendar, recurring-ical-events.

How events are read
- Only events in the next LOOKAHEAD_DAYS days are kept (plus shows that started in the last 4 hours).
- An event is hidden from the website if its title or description contains "private", "rehearsal",
  "[hide]" or "[internal]". To hide any other event, put [hide] in its title.
- Title patterns like "Bedlam at Flock", "Bedlam duo at Barrel House" and "Bedlam Duo @Club Atmos" give the
  venue and the line-up. A title starting with "Bedlam" and no "duo" or "trio" is shown as "Full band".
- Every show gets a "City, ST". In order, the city comes from: data/venues.json (hand-edited, always wins),
  the event's own location, the same venue on any other calendar event (past ones too), and finally an
  OpenStreetMap (Nominatim) lookup, which is saved into data/venues.json as "verified": false so a person can
  check it. Venues the script still cannot place are listed in the job log ("UNKNOWN VENUES").
- data/venues.json entries: {"name", "aliases": [other spellings], "city": "St. Louis, MO", "address", "website",
  "verified"}. Set "verified": true once a lookup has been checked. To correct a city, edit it there.
- A details link (http or https only) is taken from the event's URL field, or the first web link in its description.
"""
import json
import re
import sys
import time
import urllib.parse
import urllib.request
from collections import Counter
from datetime import date, datetime, timedelta
from zoneinfo import ZoneInfo

import icalendar
import recurring_ical_events

ICS_URL = "https://calendar.google.com/calendar/ical/bedlambros%40gmail.com/public/basic.ics"
OUT = "data/shows.json"
VENUES = "data/venues.json"
NOMINATIM = "https://nominatim.openstreetmap.org/search"
GEO_VIEWBOX = "-91.3,38.2,-89.7,39.2"   # St. Louis area (west,south,east,north); lookups never leave it
GEO_MAX_PER_RUN = 5                      # be gentle with the free service
LOOKUP_UNKNOWN = True                    # look up venues that nothing else can place
SHOW_UNVERIFIED = True                   # show a looked-up city before a person has checked it (log still flags it)
HISTORY_DAYS = 5 * 365                   # how far back the calendar is read to learn venue cities
TZ = ZoneInfo("America/Chicago")
LOOKAHEAD_DAYS = 120   # how far ahead shows are listed (about four months); change this number to show more or fewer
GRACE = timedelta(hours=4)
HIDE = re.compile(r"private|rehears|\[hide\]|\[internal\]", re.I)
TITLE = re.compile(r"^\s*(?:the\s+)?bedlam(?:\s+brothers)?\s*(duo|trio|acoustic|full\s+band)?\s*(?:at|@)\s*(.+?)\s*$", re.I)
STATE = re.compile(r"^[A-Z]{2}(?:\s+\d{5})?$")


def fetch():
    req = urllib.request.Request(ICS_URL, headers={"User-Agent": "bedlam-site-calendar-sync"})
    with urllib.request.urlopen(req, timeout=60) as r:
        return r.read()


def clean(s):
    return re.sub(r"\s+", " ", str(s or "")).strip()


def city_from_location(loc):
    """Find 'City, ST' in a Google-style address. Returns (venue_name_or_None, city_or_empty)."""
    lines = [clean(x) for x in re.split(r"[\r\n]+", str(loc or "")) if clean(x)]
    if not lines:
        return None, ""
    venue = lines[0] if not re.match(r"^\d", lines[0]) else None
    city = ""
    for line in reversed(lines):
        parts = [clean(p) for p in line.split(",") if clean(p)]
        parts = [p for p in parts if p.lower() not in ("united states", "usa", "us")]
        if len(parts) >= 2 and STATE.match(parts[-1]):
            city = f"{parts[-2]}, {parts[-1][:2]}"
            break
    city = re.sub(r"\bSaint\b", "St.", city)
    if venue and re.search(r",\s*[A-Z]{2}\b", venue):
        venue = None  # the first line was really an address
    return venue, city


def tidy_city(city):
    """One format for every city: 'St. Louis, MO' (never 'Saint Louis' or 'St Louis'; state in capitals)."""
    m = re.match(r"^\s*(.+?)\s*,\s*([A-Za-z]{2})\s*$", str(city or ""))
    if not m:
        return clean(city)
    name = re.sub(r"\bSaint\b|\bSt\b\.?", "St.", m.group(1), flags=re.I)
    return f"{clean(name)}, {m.group(2).upper()}"


def address_from_location(loc, venue):
    """Street address part of a Google-style location ('' when it is only a place name)."""
    lines = [clean(x) for x in re.split(r"[\r\n]+", str(loc or "")) if clean(x)]
    if lines and not re.match(r"^\d", lines[0]):
        lines = lines[1:]
    parts = [p for l in lines for p in [clean(x) for x in l.split(",")] if p]
    parts = [p for p in parts if p.lower() not in ("united states", "usa", "us")]
    if not parts or not re.match(r"^\d", parts[0]):
        return ""
    return re.sub(r"\bSaint\b", "St.", ", ".join(parts))


def norm(name):
    """Loose key for matching venue names typed in different ways ('Das Bevo- nick' and 'Das Bevo' match)."""
    s = str(name or "").lower().replace("’", "'")
    s = re.sub(r"\(.*?\)", " ", s)
    s = re.sub(r"^\s*bedlam(\s+(brothers|bros\.?))?(\s+(duo|trio|acoustic|full\s+band))?(\s+live\s+music)?\s*(at\b|@|[-–—:])?\s*", "", s)
    s = re.split(r"\s*[-–—]\s*", s)[0]
    s = re.sub(r"^the\s+", "", s)
    return re.sub(r"\s+", " ", re.sub(r"[^a-z0-9' ]+", " ", s)).strip()


def load_venues():
    try:
        with open(VENUES, encoding="utf-8") as f:
            return json.load(f)
    except (OSError, ValueError):
        return {"venues": []}


def save_venues(data):
    with open(VENUES, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=1)
        f.write("\n")


def venue_index(data):
    """norm(name or alias) -> venue entry, from data/venues.json."""
    idx = {}
    for v in data.get("venues", []):
        for n in [v.get("name")] + list(v.get("aliases") or []):
            if norm(n):
                idx.setdefault(norm(n), v)
    return idx


def learn_from_calendar(events):
    """norm(venue) -> (city, address): the most common answer among all events that have a location."""
    cities, addrs = {}, {}
    for ev in events:
        title = clean(ev.get("SUMMARY"))
        if not title or HIDE.search(title) or HIDE.search(str(ev.get("DESCRIPTION") or "")):
            continue
        loc_venue, city = city_from_location(ev.get("LOCATION"))
        if not city:
            continue
        addr = address_from_location(ev.get("LOCATION"), loc_venue)
        for name in (loc_venue, venue_and_lineup(title)[0]):
            k = norm(name)
            if k:
                cities.setdefault(k, Counter())[tidy_city(city)] += 1
                if addr:
                    addrs.setdefault(k, Counter())[addr] += 1
    best = lambda c: c.most_common(1)[0][0] if c else ""
    return {k: (best(c), best(addrs.get(k))) for k, c in cities.items()}


def from_calendar(key, learned):
    """City and address already known for this venue name on other events ('' if none, or if they disagree)."""
    if key in learned:
        return learned[key]
    near = {v for k, v in learned.items() if k.startswith(key + " ") or key.startswith(k + " ")} if key else set()
    cities = {c for c, _ in near}
    return next(iter(near)) if len(cities) == 1 else ("", "")


def geocode(name):
    """Ask OpenStreetMap about a venue. Returns {"city", "address"} only for a clear match inside the St. Louis area."""
    params = {"format": "jsonv2", "addressdetails": 1, "limit": 5, "countrycodes": "us", "q": name,
              "viewbox": GEO_VIEWBOX, "bounded": 1}
    req = urllib.request.Request(NOMINATIM + "?" + urllib.parse.urlencode(params),
                                 headers={"User-Agent": "bedlam-site-calendar-sync (bedlambros@gmail.com)"})
    with urllib.request.urlopen(req, timeout=30) as r:
        results = json.load(r)
    want = norm(name)
    for res in results:
        got = norm(res.get("name"))
        a = res.get("address") or {}
        town = a.get("city") or a.get("town") or a.get("village") or a.get("hamlet")
        state = str(a.get("ISO3166-2-lvl4") or "")[-2:]
        if want and got and (want == got or want in got or got in want) and town and len(state) == 2:
            street = " ".join(x for x in (a.get("house_number"), a.get("road")) if x)
            addr = ", ".join(x for x in (street, town, (state + " " + a.get("postcode", "")).strip()) if x)
            return {"city": tidy_city(f"{town}, {state}"), "address": addr}
    return None


def venue_and_lineup(title):
    m = TITLE.match(title)
    if m:
        lineup = (m.group(1) or "").strip().lower()
        lineup = {"duo": "Duo", "trio": "Trio", "acoustic": "Acoustic"}.get(lineup, "Full band")
        return clean(m.group(2)), lineup
    lineup = ""
    if re.match(r"^\s*(the\s+)?bedlam", title, re.I):
        lineup = "Trio" if re.search(r"\btrio\b", title, re.I) else "Duo" if re.search(r"\bduo\b", title, re.I) else "Full band"
    return clean(title), lineup


SMALL = {"of", "at", "the", "and", "&", "in", "on", "for"}


def nice(name):
    """Tidy a venue typed in a hurry: drop the word 'gig', capitalise plain lowercase words."""
    words = [w for w in clean(name).split(" ") if w and w.lower() != "gig"]
    out = []
    for i, w in enumerate(words):
        out.append(w[0].upper() + w[1:] if w[0].islower() and (i == 0 or w.lower() not in SMALL) else w)
    return " ".join(out)


def first_url(text):
    m = re.search(r"https?://[^\s<>\"']+", str(text or ""))
    return m.group(0).rstrip(".,)") if m else ""


def main():
    cal = icalendar.Calendar.from_ical(fetch())
    now = datetime.now(TZ)
    all_events = recurring_ical_events.of(cal).between(now - timedelta(days=HISTORY_DAYS), now + timedelta(days=LOOKAHEAD_DAYS))
    learned = learn_from_calendar(all_events)
    venues_data = load_venues()
    known = venue_index(venues_data)
    venues_changed, lookups = False, 0
    unknown, unchecked = set(), set()
    events = recurring_ical_events.of(cal).between(now - GRACE, now + timedelta(days=LOOKAHEAD_DAYS))
    shows, seen = [], set()
    for ev in events:
        title = clean(ev.get("SUMMARY"))
        desc = str(ev.get("DESCRIPTION") or "")
        if not title or str(ev.get("STATUS") or "").upper() == "CANCELLED":
            continue
        if HIDE.search(title) or HIDE.search(desc):
            continue
        raw = ev.decoded("DTSTART")
        if isinstance(raw, datetime):
            start, all_day = raw.astimezone(TZ), False
        elif isinstance(raw, date):
            start, all_day = datetime(raw.year, raw.month, raw.day, tzinfo=TZ), True
        else:
            continue
        if start + (timedelta(days=1) if all_day else GRACE) < now:
            continue
        loc_venue, city = city_from_location(ev.get("LOCATION"))
        title_venue, lineup = venue_and_lineup(title)
        venue = nice(loc_venue or title_venue)
        address = address_from_location(ev.get("LOCATION"), loc_venue)
        website = ""
        city = tidy_city(city)
        key = norm(venue)
        entry = known.get(key) or known.get(norm(title_venue))
        if entry is None:
            # not in data/venues.json: fall back on the event's own location, then on other events at this venue
            if not city or not address:
                c2, a2 = from_calendar(key, learned)
                city, address = city or c2, address or a2
            if not city and LOOKUP_UNKNOWN and lookups < GEO_MAX_PER_RUN and key:
                lookups += 1
                try:
                    found = geocode(venue)
                except Exception as exc:
                    found = None
                    print(f"lookup failed for {venue}: {exc}", file=sys.stderr)
                    lookups = GEO_MAX_PER_RUN   # service unavailable: stop asking this run, try again next time
                else:
                    time.sleep(1.1)   # Nominatim allows one request per second
                    entry = {"name": venue, "aliases": [], "city": (found or {}).get("city", ""),
                             "address": (found or {}).get("address", ""), "website": "", "verified": False,
                             "note": "found by OpenStreetMap lookup, please check" if found else "lookup found nothing, please fill in"}
                    venues_data.setdefault("venues", []).append(entry)
                    known[key] = entry
                    venues_changed = True
        if entry is not None:   # data/venues.json (or a fresh lookup) has the last word
            if entry.get("city"):
                city = tidy_city(entry["city"]) if (entry.get("verified") or SHOW_UNVERIFIED) else ""
            address = entry.get("address") or address
            website = entry.get("website") or ""
            if not entry.get("verified"):
                unchecked.add(f"{entry['name']} -> {entry.get('city') or '(no city)'}")
        if not city:
            unknown.add(venue)
        url = clean(ev.get("URL"))
        if not re.match(r"^https?://", url, re.I):
            url = first_url(desc)
        dedupe = (start.isoformat(), venue.lower())
        if dedupe in seen:
            continue
        seen.add(dedupe)
        shows.append({"start": start.isoformat(), "allDay": all_day, "venue": venue, "city": city,
                      "address": address, "website": website, "lineup": lineup, "url": url, "title": title})
    shows.sort(key=lambda s: s["start"])
    if venues_changed:
        save_venues(venues_data)
        print(f"saved {lookups} new venue lookup(s) to {VENUES}")
    for name in sorted(unchecked):
        print("NEEDS A CHECK (in data/venues.json, verified is false):", name)
    if unknown:
        print("UNKNOWN VENUES (add them to data/venues.json):", "; ".join(sorted(unknown)))
    try:  # leave the file alone when nothing changed, so the repo does not fill with empty updates
        with open(OUT, encoding="utf-8") as f:
            if json.load(f).get("shows") == shows:
                print("show dates unchanged")
                return
    except (OSError, ValueError):
        pass
    out = {"updated": now.isoformat(timespec="seconds"), "timezone": "America/Chicago", "shows": shows}
    with open(OUT, "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, indent=1)
        f.write("\n")
    print(f"wrote {len(shows)} shows to {OUT}")


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:  # leave the previous data/shows.json untouched
        print("calendar sync failed:", exc, file=sys.stderr)
        sys.exit(1)
