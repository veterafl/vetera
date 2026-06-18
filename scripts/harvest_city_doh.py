#!/usr/bin/env python3
"""
Harvest practice CITY for Florida dentists straight from the OFFICIAL FL DOH
license-verification record, and write a license-number -> city map.

Source: FL DOH MQA "Health Care Providers" license verification, CSV export.
  https://mqa-internet.doh.state.fl.us/MQASearchServices/HealthCareProviders/ExportToCsvLVP
We ask for Board of Dentistry (Board=7), the whole state in one request, and
keep only rows whose profession is "Dentist" (license type DN / prof code 701 —
the same population build_dentists.py ships, oral surgeons included).

Why this beats NPPES: it is the state's own address of record, matched by the
exact license number, with near-total coverage. No name guessing, no CORS, no
browser. Re-run any time to refresh; only its JSON output ships.

Output: data/raw/doh-city.json   { "<digits-of-license>": "City Name", ... }
        data/raw/doh-dentistry.csv (raw export, kept for reproducibility)
"""
import csv, io, json, os, sys, urllib.request, urllib.parse

HERE = os.path.dirname(__file__)
RAW_CSV = os.path.join(HERE, "..", "data", "raw", "doh-dentistry.csv")
OUT = os.path.join(HERE, "..", "data", "raw", "doh-city.json")

EXPORT = ("https://mqa-internet.doh.state.fl.us/MQASearchServices"
          "/HealthCareProviders/ExportToCsvLVP")

# Board of Dentistry, whole state, every status (so retired/deceased are covered).
MODEL = {
    "Id": 0, "Board": "7", "Profession": None, "SpecialtyOrCertification": None,
    "OtherSpecialtyOrCertification": None, "LicenseNumber": None,
    "FirstName": None, "LastName": None, "BusinessName": None, "City": None,
    "County": None, "ZipCode": None, "LicenseStatus": None,
    "IsAuthorizedToOrderCannabis": None,
}


def digits(s):
    """Same key build_dentists.py uses: digits only, leading zeros stripped."""
    return "".join(ch for ch in str(s) if ch.isdigit()).lstrip("0") or "0"


def download():
    url = EXPORT + "?" + urllib.parse.urlencode({"jsonModel": json.dumps(MODEL)})
    req = urllib.request.Request(url, headers={"User-Agent": "vetera-city-harvest/2.0"})
    with urllib.request.urlopen(req, timeout=180) as r:
        return r.read().decode("utf-8", "replace")


def main():
    # Prefer a fresh download; fall back to the saved CSV if offline.
    try:
        text = download()
        os.makedirs(os.path.dirname(RAW_CSV), exist_ok=True)
        with open(RAW_CSV, "w", encoding="utf-8") as f:
            f.write(text)
        src = "live FL DOH export"
    except Exception as e:
        if not os.path.exists(RAW_CSV):
            sys.exit(f"download failed and no cached CSV: {e}")
        text = open(RAW_CSV, encoding="utf-8").read()
        src = f"cached CSV (download failed: {e})"

    rows = list(csv.reader(io.StringIO(text)))
    header = rows[0] if rows else []
    city_map = {}
    dentists = 0
    for row in rows[1:]:
        if len(row) < 5:
            continue
        lic, name, prof, city, status = (c.strip() for c in row[:5])
        if prof != "Dentist":            # skip hygienists, labs, radiographers, etc.
            continue
        dentists += 1
        if not city:
            continue
        city_map[digits(lic)] = city.title()

    with open(OUT, "w", encoding="utf-8") as f:
        json.dump(city_map, f, ensure_ascii=False)

    print(f"source:            {src}")
    print(f"header:            {header}")
    print(f"dentist rows:      {dentists}")
    print(f"licenses w/ city:  {len(city_map)}")
    print(f"output:            {OUT}")


if __name__ == "__main__":
    main()
