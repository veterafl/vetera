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

        disciplined = admin_c or emerg or final_o or (status in DISCIPLINE_STATUSES)

        rec = {
            "f": first,
            "l": last,
            "n": middle,           # middle name
            "lic": parts[2].strip(),
            "a": 1 if active_now else 0,
            "s": label,
            "e": exp,
            "d": 1 if disciplined else 0,
        }
        records.append(rec)

# Sort by last name then first for stable output
records.sort(key=lambda r: (r["l"], r["f"]))

os.makedirs(os.path.dirname(OUT), exist_ok=True)
with open(OUT, "w", encoding="utf-8") as f:
    json.dump(records, f, separators=(",", ":"), ensure_ascii=False)

active = sum(1 for r in records if r["a"])
disc = sum(1 for r in records if r["d"])
size_mb = os.path.getsize(OUT) / 1_000_000
print(f"dentists parsed:      {seen}")
print(f"records written:      {len(records)}")
print(f"  active & good:      {active}")
print(f"  flagged discipline: {disc}")
print(f"output:               {OUT}  ({size_mb:.1f} MB)")
