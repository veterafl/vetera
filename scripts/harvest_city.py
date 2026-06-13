#!/usr/bin/env python3
"""
Harvest practice CITY for Florida dentists from the public NPPES (NPI) registry
and write a license-number -> city map. Joined later into dentists.json.

Why NPPES: the FL DOH License Status file has no address. NPPES is the free,
public national provider registry; it returns practice city + the state license
number, so we can match the EXACT dentist (not just by name).

Strategy: one query per unique surname (last_name + state=FL), keep only records
whose taxonomy is dental, key by the digits of the state license number.

No browser/CORS involved — this runs offline and only its JSON output ships.
Politeness: small delay + retry; safe to re-run (resumes from the output map).
"""
import json, os, time, urllib.request, urllib.parse, urllib.error

HERE = os.path.dirname(__file__)
DENTISTS = os.path.join(HERE, "..", "site", "data", "dentists.json")
OUT = os.path.join(HERE, "..", "data", "raw", "nppes-city.json")
PROGRESS = os.path.join(HERE, "..", "data", "raw", "nppes-progress.json")

API = "https://npiregistry.cms.hhs.gov/api/"
DELAY = 0.18          # ~5-6 req/sec, polite to a public gov API
PAGE = 200

def digits(s):
    return "".join(ch for ch in str(s) if ch.isdigit()).lstrip("0") or "0"

def is_dental(tax):
    code = (tax.get("code") or "")
    desc = (tax.get("desc") or "").upper()
    return code.startswith("1223") or "DENT" in desc or "ORAL" in desc

def fetch(last_name):
    params = urllib.parse.urlencode({
        "version": "2.1", "last_name": last_name, "state": "FL",
        "limit": PAGE, "skip": 0,
    })
    req = urllib.request.Request(API + "?" + params,
                                 headers={"User-Agent": "vetera-city-harvest/1.0"})
    for attempt in range(4):
        try:
            with urllib.request.urlopen(req, timeout=30) as r:
                return json.load(r)
        except (urllib.error.URLError, TimeoutError, ValueError) as e:
            if attempt == 3:
                raise
            time.sleep(1.5 * (attempt + 1))
    return {"results": []}

def main():
    dent = json.load(open(DENTISTS))
    surnames = sorted({r["l"].strip().upper() for r in dent if r["l"].strip()})

    city_map = {}
    done = set()
    if os.path.exists(OUT):
        city_map = json.load(open(OUT))
    if os.path.exists(PROGRESS):
        done = set(json.load(open(PROGRESS)).get("done", []))

    total = len(surnames)
    for i, sur in enumerate(surnames, 1):
        if sur in done:
            continue
        try:
            data = fetch(sur)
        except Exception as e:
            # leave for a re-run; don't mark done
            print(f"[{i}/{total}] {sur}: ERROR {e}", flush=True)
            time.sleep(2)
            continue
        for res in data.get("results", []):
            taxes = res.get("taxonomies", [])
            if not any(is_dental(t) for t in taxes):
                continue
            lic = ""
            for t in taxes:
                if t.get("license") and is_dental(t):
                    lic = t["license"]; break
            if not lic:
                continue
            loc = None
            for a in res.get("addresses", []):
                if a.get("address_purpose") == "LOCATION":
                    loc = a; break
            loc = loc or (res.get("addresses") or [None])[0]
            if not loc or not loc.get("city"):
                continue
            key = digits(lic)
            city = loc["city"].strip().title()
            city_map[key] = city
        done.add(sur)

        if i % 100 == 0 or i == total:
            json.dump(city_map, open(OUT, "w"), ensure_ascii=False)
            json.dump({"done": sorted(done), "i": i, "total": total},
                      open(PROGRESS, "w"))
            print(f"[{i}/{total}] surnames done, {len(city_map)} licenses mapped",
                  flush=True)
        time.sleep(DELAY)

    json.dump(city_map, open(OUT, "w"), ensure_ascii=False)
    json.dump({"done": sorted(done), "i": total, "total": total},
              open(PROGRESS, "w"))
    print(f"DONE: {len(city_map)} licenses mapped -> {OUT}", flush=True)

if __name__ == "__main__":
    main()
