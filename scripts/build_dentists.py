#!/usr/bin/env python3
"""
Build site/data/dentists.json from the FL DOH License Status download.

Source: data/raw/dbdumps/ce_broker/lic_status.dat  (pipe-delimited, all FL professions)
We keep only Dentists: Profession Code 701, Rank DN  (includes oral surgeons).

Output is plain-language and minimal: only what a patient needs to know —
is this dentist licensed and active right now, and has the state ever taken
action against them. No raw codes, no jargon.
"""
import json
import os

SRC = os.path.join(os.path.dirname(__file__), "..", "data", "raw", "dbdumps", "ce_broker", "lic_status.dat")
OUT = os.path.join(os.path.dirname(__file__), "..", "site", "data", "dentists.json")
# license -> city, straight from the official FL DOH record, and ONLY for
# dentists FL DOH files under a Florida county (scripts/harvest_city_doh.py) —
# so appending ", FL" in the UI is always correct. We deliberately do NOT fall
# back to NPPES: that is an unverified practice address and would reintroduce
# out-of-state cities wrongly labelled ", FL". Correctness over coverage.
CITY_DOH = os.path.join(os.path.dirname(__file__), "..", "data", "raw", "doh-city.json")
CITY_OVERRIDES = os.path.join(os.path.dirname(__file__), "city-overrides.json")
# FL DOH's "city" is free text: typos ("Maimi"), abbreviations ("Ft Lauderdale",
# "Jax"), out-of-state mailing cities that survive the county filter ("Brooklyn"),
# and junk ("*** Confidential ***"). city-normalize.json maps every DOH city
# string we've seen to its official FL place name — or to null, meaning the
# string is not a Florida city and the record ships with no city at all.
CITY_NORMALIZE = os.path.join(os.path.dirname(__file__), "city-normalize.json")


def lic_key(s):
    """Match harvest_city.py's key: digits only, leading zeros stripped."""
    return "".join(ch for ch in str(s) if ch.isdigit()).lstrip("0") or "0"


def load_map(path):
    if os.path.exists(path):
        with open(path, encoding="utf-8") as cf:
            return json.load(cf)
    return {}

doh_city = load_map(CITY_DOH)
overrides = {k: v for k, v in load_map(CITY_OVERRIDES).items() if not k.startswith("_")}
normalize = {k: v for k, v in load_map(CITY_NORMALIZE).items() if not k.startswith("_")}

# Field order per LicenseStatusMetaData.pdf
# 0 ProfCode 1 Rank 2 LicNum 3 ActivityStatus 4 Status 5 OrigDate 6 ExpDate
# 7 StatusEffDate 8 First 9 Middle 10 Last 11 AdminComplaints 12 EmergSuspension
# 13 FinalOrders 14 MultiState

# Map raw status -> (is_active_now, plain label)
STATUS_MAP = {
    "Clear":            (True,  "Licensed and in good standing"),
    "Probation":        (True,  "Licensed, but on probation"),
    "Conditional":      (True,  "Licensed with conditions"),
    "Obligations":      (True,  "Licensed, has outstanding obligations"),
    "Military Active":  (True,  "Licensed (military active status)"),
    "Retired":          (False, "Retired"),
    "Deceased":         (False, "Deceased"),
    "Delinquent":       (False, "License lapsed (delinquent)"),
    "Null And Void":    (False, "License no longer valid"),
    "Vol Relinquish":   (False, "Voluntarily gave up license"),
    "Disc Relinquish":  (False, "Gave up license during a state action"),
    "Revoked":          (False, "License revoked by the state"),
    "Suspended":        (False, "License suspended by the state"),
    "Denied - Rnewal":  (False, "Renewal denied"),
    "Expired Appl":     (False, "Application expired"),
    "Denied":           (False, "Denied"),
}

# Statuses that themselves mean the state acted against the dentist
DISCIPLINE_STATUSES = {"Revoked", "Suspended", "Probation", "Disc Relinquish"}

records = []
seen = 0
unreviewed = {}   # doh city strings not in city-normalize.json (new since last review)
with open(SRC, "r", encoding="latin-1") as f:
    for line in f:
        parts = line.rstrip("\n").split("|")
        if len(parts) < 15:
            continue
        prof, rank = parts[0].strip(), parts[1].strip()
        if prof != "701" or rank != "DN":
            continue
        seen += 1
        activity = parts[3].strip()
        status = parts[4].strip()
        exp = parts[6].strip()
        first = parts[8].strip().title()
        middle = parts[9].strip().title()
        last = parts[10].strip().title()
        admin_c = parts[11].strip().upper() == "Y"
        emerg = parts[12].strip().upper() == "Y"
        final_o = parts[13].strip().upper() == "Y"

        is_active, label = STATUS_MAP.get(status, (False, status or "Status unknown"))
        # "Active" activity AND a good standing label => truly active now
        active_now = is_active and (activity.upper() == "ACTIVE" or status == "Clear")

        # Grade the state's history so the site can word it fairly:
        #   2 = a real state action (final order, emergency suspension, or a
        #       current disciplinary status like revoked/suspended/probation)
        #   1 = an administrative complaint only (may be pending OR dismissed —
        #       not a finding of wrongdoing, so we say it softly)
        #   0 = nothing on record
        if final_o or emerg or (status in DISCIPLINE_STATUSES):
            disc = 2
        elif admin_c:
            disc = 1
        else:
            disc = 0

        rec = {
            "f": first,
            "l": last,
            "n": middle,           # middle name
            "lic": parts[2].strip(),
            "a": 1 if active_now else 0,
            "s": label,
            "e": exp,
            "d": disc,
        }
        key = lic_key(parts[2].strip())
        # manual hand-corrections win, then the official FL DOH (FL-county) record
        city = overrides.get(key)
        if not city:
            city = doh_city.get(key)
            if city is not None:
                if city in normalize:
                    city = normalize[city]   # canonical FL name, or None to drop
                elif normalize:
                    # never ship a string no one has reviewed — drop it and warn
                    unreviewed[city] = unreviewed.get(city, 0) + 1
                    city = None
        if city:
            rec["c"] = city           # city of record (omitted when unknown)
        records.append(rec)

# Sort by last name then first for stable output
records.sort(key=lambda r: (r["l"], r["f"]))

os.makedirs(os.path.dirname(OUT), exist_ok=True)
with open(OUT, "w", encoding="utf-8") as f:
    json.dump(records, f, separators=(",", ":"), ensure_ascii=False)

active = sum(1 for r in records if r["a"])
disc = sum(1 for r in records if r["d"])
with_city = sum(1 for r in records if r.get("c"))
size_mb = os.path.getsize(OUT) / 1_000_000
print(f"dentists parsed:      {seen}")
print(f"records written:      {len(records)}")
print(f"  active & good:      {active}")
print(f"  flagged discipline: {disc}")
print(f"  with practice city: {with_city}")
print(f"output:               {OUT}  ({size_mb:.1f} MB)")
if unreviewed:
    top = sorted(unreviewed.items(), key=lambda kv: -kv[1])[:10]
    print(f"WARNING: {len(unreviewed)} city strings are NOT in city-normalize.json — their "
          f"records shipped WITHOUT a city. Review and add them (a fresh harvest likely "
          f"introduced new strings): {top}")
