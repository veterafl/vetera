#!/usr/bin/env python3
"""
Join harvested practice city into site/data/dentists.json.

Reads the license -> city map from data/raw/nppes-city.json (built by
harvest_city.py) and adds a "c" field (city) to each dentist record whose
license number matches. Records with no match are left without a city — the
UI simply omits the city line, never guesses.

Run AFTER build_dentists.py (which would otherwise drop the city on rebuild).
"""
import json, os

HERE = os.path.dirname(__file__)
DENTISTS = os.path.join(HERE, "..", "site", "data", "dentists.json")
CITY = os.path.join(HERE, "..", "data", "raw", "nppes-city.json")
OVERRIDES = os.path.join(HERE, "city-overrides.json")

def digits(s):
    return "".join(c for c in str(s) if c.isdigit()).lstrip("0") or "0"

dent = json.load(open(DENTISTS))
city_map = json.load(open(CITY))

# Manually verified cities from the official FL DOH record win over NPPES and
# fill NPPES gaps. Keys are license digits; ignore the "_comment" key.
overrides = {k: v for k, v in json.load(open(OVERRIDES)).items() if not k.startswith("_")}

added = 0
overridden = 0
for r in dent:
    r.pop("c", None)  # idempotent re-run
    key = digits(r["lic"])
    city = overrides.get(key) or city_map.get(key)
    if overrides.get(key):
        overridden += 1
    if city:
        r["c"] = city
        added += 1

json.dump(dent, open(DENTISTS, "w"), separators=(",", ":"), ensure_ascii=False)

active = [r for r in dent if r["a"] == 1]
active_with = sum(1 for r in active if r.get("c"))
print(f"records:            {len(dent)}")
print(f"with city:          {added} ({100*added//len(dent)}%)")
print(f"active with city:   {active_with}/{len(active)} ({100*active_with//len(active)}%)")
print(f"manual overrides:   {overridden}")
