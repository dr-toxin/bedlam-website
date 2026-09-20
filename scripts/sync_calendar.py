#!/usr/bin/env python3
"""Turn the band's public Google Calendar into data/shows.json for the website.

Run by .github/workflows/calendar-sync.yml every 30 minutes. Needs: icalendar, recurring-ical-events.

How events are read
- Only events in the next LOOKAHEAD_DAYS days are kept (plus shows that started in the last 4 hours).
- An event is hidden from the website if its title or description contains "private", "rehearsal",
  "[hide]" or "[internal]". To hide any other event, put [hide] in its title.
- Title patterns like "Bedlam at Flock", "Bedlam duo at Barrel House" and "Bedlam Duo @Club Atmos" give the
  venue and the line-up. A title starting with "Bedlam" and no "duo" or "trio" is shown as "Full band".
- If the event has a location, its venue name and "City, ST" are used for the city.
- A details link (http or https only) is taken from the event's URL field, or the first web link in its description.
"""
import json
import re
import sys
import urllib.request
from datetime import date, datetime, timedelta
from zoneinfo import ZoneInfo

import icalendar
import recurring_ical_events

ICS_URL = "https://calendar.google.com/calendar/ical/bedlambros%40gmail.com/public/basic.ics"
OUT = "data/shows.json"
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
        url = clean(ev.get("URL"))
        if not re.match(r"^https?://", url, re.I):
            url = first_url(desc)
        key = (start.isoformat(), venue.lower())
        if key in seen:
            continue
        seen.add(key)
        shows.append({"start": start.isoformat(), "allDay": all_day, "venue": venue, "city": city,
                      "lineup": lineup, "url": url, "title": title})
    shows.sort(key=lambda s: s["start"])
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
