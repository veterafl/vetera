# Deploy & Git Reconciliation Guide

_Written 2026-06-13 by Claude during the QA/launch-prep session. Read this before pushing._

## TL;DR

Your local `main` is the real, complete site. The GitHub repo (`origin/main`) holds a
**stale, unrelated manual upload** that's missing `dentists.json` and 7 other files.
To deploy, overwrite GitHub with local (one force-push), then let Vercel build.

```bash
# from /Users/floricaiqbal/Desktop/Buisness
git push --force origin main
```

That's the whole deploy, **if** Vercel is connected to this GitHub repo (verify below).

---

## Why a force-push (and why it's safe)

`origin/main` and local `main` have **no common ancestor** — origin is two
"Add files via upload" commits (files uploaded through GitHub's web UI), a
separate history from your real development work.

I compared the two file-by-file:

- **Files on origin but missing locally:** none. Origin is a *strict subset*.
- **Files local has that origin is missing (8):** `site/data/dentists.json` (the
  3.3 MB dataset with city), `site/pricing.html`, `site/favicon.svg`,
  `scripts/build_dentists.py`, `scripts/harvest_city.py`, `.gitignore`,
  `.vercelignore`, `.claude/settings.json`.

So force-pushing local over origin **discards nothing unique** — it just replaces an
older snapshot with the current one. (If you want to double-check first:
`git ls-tree -r --name-only origin/main` shows everything origin has.)

---

## Does Vercel auto-deploy from GitHub?

The Vercel project is linked (`.vercel/project.json` → project "vetera"). Two cases:

1. **Vercel is connected to the GitHub repo** (the intended setup per CLAUDE.md notes):
   the force-push above triggers a production build automatically. Watch it at
   vercel.com → project "vetera" → Deployments.
2. **Vercel is NOT connected to GitHub** (only CLI-linked): the push won't deploy.
   You'd deploy with `vercel --prod` from the repo — but note your earlier issue
   where `api.vercel.com` timed out on your network. If CLI still times out, connect
   the GitHub repo in the Vercel dashboard (Project → Settings → Git) and use case 1.

If you're unsure which case you're in, the dashboard's Settings → Git tab tells you.

---

## After deploy — required for analytics to work

Search tracking ("1,000 uses" metric) needs Web Analytics turned on:

- Vercel dashboard → project "vetera" → **Analytics tab → Enable**.
- It's free on the Hobby plan and includes the custom `search` events.
- Until enabled, the site works fine but records nothing.

Then verify on the live URL:
- Run a search → confirm results show with city + colored status.
- In Analytics → Events, after a few searches you should see `search` events
  (with `found` / `none`).

---

## Heads-up: a parallel session is committing to this repo

During this session, commits appeared on local `main` that I didn't make (e.g.
city was added through another channel while my harvest ran). If you have another
agent/window working here, **coordinate before force-pushing** so you don't clobber
each other. Safe sequence: make sure all local work is committed, then push.

---

## What changed this session (local commits, not yet pushed)

- `Show one color-coded Florida status line per dentist` — condensed, severity-colored status (Revoked / On probation / Active — in good standing / Retired), no false alarm on good-standing dentists.
- `Track each search as a Vercel Web Analytics event` — privacy-safe `search` event (found/none), no names sent.
- `Make privacy policy match actual analytics behavior` — disclosed the cookieless analytics; reworded the "we don't track searches" claim to be accurate.
- `Match dentists when the query includes an honorific` — "Dr. Adelson" now returns results.

All four passed QA: 9 pages render on desktop + mobile, all internal links resolve,
12/12 search edge-case tests pass, no real console errors (the only 404 is Vercel's
analytics script, which only exists on the deployed site).
