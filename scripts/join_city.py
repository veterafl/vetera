#!/usr/bin/env python3
"""
Join harvested practice city into site/data/dentists.json.

Adds a "c" field (city) to each dentist record by license number. City comes
from the official FL DOH record (data/raw/doh-city.json, built by
harvest_city_doh.py), with NPPES as a fallback and hand-verified overrides on
top. Records with no match are left without a city — the UI omits the city
line, never guesses.

build_dentists.py already does this join inline; this script just re-applies it
to an existing dentists.json without a full rebuild. Same precedence either way.
"""
import json, os

HERE = os.path.dirname(__file__)
DENTISTS = os.path.join(HERE, "..", "site", "data", "dentists.json")
CITY_DOH = os.path.join(HERE, "..", "data", "raw", "doh-city.json")
CITY_NPPES = os.path.join(HERE, "..", "data", "raw", "nppes-city.json")
OVERRIDES = os.path.join(HERE, "city-overrides.json")

def digits(s):
    return "".join(c for c in str(s) if c.isdigit()).lstrip("0") or "0"

def load(path):
    return json.load(open(path)) if os.path.exists(path) else {}

dent = json.load(open(DENTISTS))
doh_city = load(CITY_DOH)
nppes_city = load(CITY_NPPES)

# Manually verified cities from the official FL DOH record win over everything;
# ignore the "_comment" key.
overrides = {k: v for k, v in load(OVERRIDES).items() if not k.startswith("_")}

added = 0
overridden = 0
for r in dent:
    r.pop("c", None)  # idempotent re-run
    key = digits(r["lic"])
    city = overrides.get(key) or doh_city.get(key) or nppes_city.get(key)
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
