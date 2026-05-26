#!/usr/bin/env node
// Reads /tmp/oig_leie.csv (downloaded from
// https://oig.hhs.gov/exclusions/downloadables/UPDATED.csv) and produces JS
// data files that assign to window.VETERA_OIG and window.VETERA_FL_BOARD.
// JS files load via <script> tags and work from file:// — fetch() does not.
// Run periodically to refresh.

const fs = require('fs');
const path = require('path');

const CSV_PATH = process.argv[2] || '/tmp/oig_leie.csv';
const SITE_DATA = path.resolve(__dirname, '..', 'site', 'data');
const OIG_OUT = path.join(SITE_DATA, 'oig-fl-exclusions.js');
const FL_JSON_PATH = path.join(SITE_DATA, 'fl-board-discipline.json');
const FL_OUT = path.join(SITE_DATA, 'fl-board-discipline.js');
const RETIRED_JSON_PATH = path.join(SITE_DATA, 'fl-retired.json');
const RETIRED_OUT = path.join(SITE_DATA, 'fl-retired.js');

function splitCsvLine(line) {
  const out = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"' && line[i + 1] === '"') {
      cur += '"';
      i++;
    } else if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (ch === ',' && !inQuotes) {
      out.push(cur);
      cur = '';
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out;
}

// --- OIG FL exclusions ---
const lines = fs.readFileSync(CSV_PATH, 'utf8').split(/\r?\n/);
const header = splitCsvLine(lines.shift());
const idx = {};
header.forEach((h, i) => (idx[h.trim()] = i));

const oig = [];
for (const line of lines) {
  if (!line.trim()) continue;
  const f = splitCsvLine(line);
  if ((f[idx.STATE] || '').toUpperCase() !== 'FL') continue;
  const last = (f[idx.LASTNAME] || '').trim();
  const first = (f[idx.FIRSTNAME] || '').trim();
  if (!last && !first) continue;
  oig.push({
    last,
    first,
    mid: (f[idx.MIDNAME] || '').trim(),
    npi: (f[idx.NPI] || '').trim(),
    specialty: (f[idx.SPECIALTY] || '').trim(),
    general: (f[idx.GENERAL] || '').trim(),
    city: (f[idx.CITY] || '').trim(),
    zip: (f[idx.ZIP] || '').trim(),
    excl_type: (f[idx.EXCLTYPE] || '').trim(),
    excl_date: (f[idx.EXCLDATE] || '').trim(),
    rein_date: (f[idx.REINDATE] || '').trim(),
  });
}

fs.mkdirSync(SITE_DATA, { recursive: true });
fs.writeFileSync(OIG_OUT, 'window.VETERA_OIG = ' + JSON.stringify(oig) + ';\n');
console.log(
  '✓ Wrote ' +
    oig.length +
    ' OIG FL entries to ' +
    OIG_OUT +
    ' (' +
    (fs.statSync(OIG_OUT).size / 1024).toFixed(0) +
    ' KB)'
);

// --- FL Board discipline ---
const flBoard = JSON.parse(fs.readFileSync(FL_JSON_PATH, 'utf8'));
fs.writeFileSync(
  FL_OUT,
  'window.VETERA_FL_BOARD = ' + JSON.stringify(flBoard) + ';\n'
);
console.log('✓ Wrote FL Board file to ' + FL_OUT);

// --- FL Retired providers ---
const retired = JSON.parse(fs.readFileSync(RETIRED_JSON_PATH, 'utf8'));
fs.writeFileSync(
  RETIRED_OUT,
  'window.VETERA_FL_RETIRED = ' + JSON.stringify(retired) + ';\n'
);
console.log('✓ Wrote FL Retired file to ' + RETIRED_OUT);
