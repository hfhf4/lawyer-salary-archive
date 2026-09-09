# Lawyer Salary Archive

Builds a searchable, self-contained HTML archive of the public **Lawyer Salary** thread on Salary.sg Forums:

https://forums.salary.sg/income-jobs/771-lawyer-salary.html

## Important

Salary.sg currently returns HTTP 403 to GitHub-hosted runners, so GitHub Actions cannot perform the scrape directly. The working no-install method is to run `browser-archive.js` from your normal browser while you are on the Salary.sg thread. This keeps all requests same-origin and uses your existing browser session.

## No-install browser method

1. Open the Lawyer Salary thread in Chrome/Edge.
2. Open Developer Tools (`F12`) and select **Console**.
3. Open `browser-archive.js` in this repository, copy all of it, and paste it into the Console.
4. Press Enter.
5. When prompted, enter:
   - `5` for a quick test; or
   - `0` for the whole thread.
6. Leave that Salary.sg tab open while it runs.
7. When complete, your browser downloads `lawyer-salary-archive.html`.
8. Open that file normally in Chrome/Edge. Search, year filtering and author filtering are all offline.

The browser scraper uses IndexedDB to cache downloaded forum pages. If the tab closes or the run fails, run the script again: already cached pages are reused. The newest three pages are refreshed so later runs can pick up new posts.

The scraper uses two workers with a delay between requests rather than blasting the site.

## Files

- `browser-archive.js` — recommended, no-install browser archiver.
- `archive.py` — Python fallback for environments that can reach Salary.sg directly.
- `requirements.txt` — Python fallback dependencies.

## Notes

This is an independent personal archive tool and is not affiliated with Salary.sg. Use the archive responsibly.
