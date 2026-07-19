#!/usr/bin/env python3
"""
Harvest practice CITY for Florida dentists straight from the OFFICIAL FL DOH
license-verification record, and write a license-number -> city map.

Source: FL DOH MQA "Health Care Providers" license verification, CSV export.
  https://mqa-internet.doh.state.fl.us/MQASearchServices/HealthCareProviders/ExportToCsvLVP

IMPORTANT — why we harvest per FL COUNTY, not the whole state at once:
  FL DOH's "city" is the licensee's ADDRESS OF RECORD, which for ~25% of dentists
  is OUT OF STATE (New York, Atlanta, Chicago ...). The export has no state
  column, and the city string alone can't tell you the state ("San Antonio" and
  "Oakland" are both real FL towns AND big out-of-state cities). The ONLY reliable
  "this address is in Florida" signal is FL DOH's own county assignment. So we
  query each Florida county in turn and keep only dentists FL DOH files under one.
  Those cities are safe to show as "City, FL"; everyone else gets no city rather
  than a wrong state. Correctness over coverage.

We keep only rows whose profession is "Dentist" (license type DN / prof code 701
— the population build_dentists.py ships, oral surgeons included), keyed by the
license digits (DN12370 -> 12370).

Output: data/raw/doh-city.json          { "<digits-of-license>": "City Name", ... }
        data/raw/doh-city-progress.json  resume state (done counties)
"""
import csv, io, json, os, re, sys, time, urllib.request, urllib.parse

HERE = os.path.dirname(__file__)
OUT = os.path.join(HERE, "..", "data", "raw", "doh-city.json")
PROGRESS = os.path.join(HERE, "..", "data", "raw", "doh-city-progress.json")

SEARCH = ("https://mqa-internet.doh.state.fl.us/MQASearchServices/HealthCareProviders")
EXPORT = SEARCH + "/ExportToCsvLVP"
BOARD_DENTISTRY = "7"
DELAY = 0.4  # polite pause between county requests


def digits(s):
    """Same key build_dentists.py uses: digits only, leading zeros stripped."""
    return "".join(ch for ch in str(s) if ch.isdigit()).lstrip("0") or "0"


def _open(url, timeout=180):
    req = urllib.request.Request(url, headers={"User-Agent": "vetera-city-harvest/3.0"})
    return urllib.request.urlopen(req, timeout=timeout)


def fl_counties():
    """Read the real Florida county code list from the search form dropdown."""
    with _open(SEARCH, timeout=60) as r:
        html = r.read().decode("utf-8", "replace")
    m = re.search(r'id="SearchDto_County".*?</select>', html, re.S)
    if not m:
        sys.exit("could not find county dropdown on FL DOH search page")
    out = []
    for val, name in re.findall(r'<option value="([^"]*)"[^>]*>([^<]*)</option>', m.group(0)):
        if val.strip():  # skip the "-- Any --" blank
            out.append((val.strip(), name.strip()))
    return out


def export_county(code):
    model = {
        "Id": 0, "Board": BOARD_DENTISTRY, "Profession": None,
        "SpecialtyOrCertification": None, "OtherSpecialtyOrCertification": None,
        "LicenseNumber": None, "FirstName": None, "LastName": None,
        "BusinessName": None, "City": None, "County": code, "ZipCode": None,
        "LicenseStatus": None, "IsAuthorizedToOrderCannabis": None,
    }
    url = EXPORT + "?" + urllib.parse.urlencode({"jsonModel": json.dumps(model)})
    for attempt in range(4):
        try:
            with _open(url) as r:
                return r.read().decode("utf-8", "replace")
        except Exception as e:
            if attempt == 3:
                raise
            time.sleep(2 * (attempt + 1))


def main():
    city_map = json.load(open(OUT)) if os.path.exists(OUT) else {}
    done = set()
    if os.path.exists(PROGRESS):
        done = set(json.load(open(PROGRESS)).get("done", []))

    counties = fl_counties()
    print(f"Florida counties to query: {len(counties)}")
    for i, (code, name) in enumerate(counties, 1):
        if code in done:
            continue
        try:
            rows = list(csv.reader(io.StringIO(export_county(code))))
        except Exception as e:
            print(f"[{i}/{len(counties)}] {name}: ERROR {e} (will retry on re-run)")
            continue
        kept = 0
        for row in rows[1:]:
            if len(row) < 5:
                continue
            lic, _name, prof, city, _status = (c.strip() for c in row[:5])
            if prof != "Dentist" or not city:
                continue
            city_map[digits(lic)] = city.title()
            kept += 1
        done.add(code)
        json.dump(city_map, open(OUT, "w"), ensure_ascii=False)
        json.dump({"done": sorted(done)}, open(PROGRESS, "w"))
        print(f"[{i}/{len(counties)}] {name}: {kept} dentists  (total {len(city_map)})")
        time.sleep(DELAY)

    print(f"DONE: {len(city_map)} Florida-county dentist cities -> {OUT}")


if __name__ == "__main__":
    main()
